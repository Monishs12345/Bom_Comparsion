const fs = require('fs');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const client = require('./db');

// Function to extract text from PDF
function extractPDFText(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }
            pdf(data).then((data) => {
                resolve(data.text);
            }).catch(err => reject(err));
        });
    });
}

// Function to extract specific part numbers from PDF text
function extractPartsFromPDFText(pdfText) {
    const lines = pdfText.split(/\r?\n/);  // Split PDF text into lines
    const partNumbers = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const partPattern = /(?:[A-Z0-9]+-)?([A-Z0-9]+[-][A-Z0-9]+[-_]*[A-Z0-9]+)/;

        const match = line.match(partPattern);
        if (match && match[1]) {
            const cleanedPart = cleanPartNumber(match[1]);
            partNumbers.push(cleanedPart);
        }
    }
    return partNumbers;
}

// Function to clean part numbers (exclude part before first dash and remove other characters)
// Function to clean part numbers, with option to remove the first hyphen (only for PDF)
function cleanPartNumber(part, isFromPDF = false) {
    if (isFromPDF) {
        const firstHyphenIndex = part.indexOf('-');
        if (firstHyphenIndex !== -1) {
            const cleanedPart = part.slice(firstHyphenIndex + 1).replace(/[-_.\/\\]/g, '');
            return cleanedPart.trim().toUpperCase();
        }
    }
    return part.replace(/[-_.\/\\]/g, '').trim().toUpperCase(); // For Excel, keep the first hyphen
}


// Function to extract part numbers from Excel BOM
function extractPartNumbersFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const partNumbers = [];
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const headers = {};
    let partNoColumnIndex = -1;
    const startingRow = 5;

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: startingRow, c: col });
        const cell = worksheet[cellAddress];
        if (cell) {
            const headerValue = cell.v.trim();
            headers[headerValue] = col;
            if (headerValue === 'MPN') {
                partNoColumnIndex = col;
            }
        }
    }

    if (partNoColumnIndex === -1) {
        throw new Error('MPN column not found in the Excel file.');
    }

    for (let row = startingRow + 1; row <= range.e.r; row++) {
        const partNoCell = worksheet[xlsx.utils.encode_cell({ r: row, c: partNoColumnIndex })];
        if (partNoCell) {
            let partNo = cleanPartNumber(partNoCell.v.toString());
            partNumbers.push(partNo);
        }
    }

    return partNumbers;
}

// Function to extract part details from BOM
function getPartDetailsFromExcel(filePath, partNo) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const headers = {};
    let partNoColumnIndex = -1;
    const startingRow = 5;

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: startingRow, c: col });
        const cell = worksheet[cellAddress];
        if (cell) {
            const headerValue = cell.v.trim();
            headers[headerValue] = col;
            if (headerValue === 'MPN') {
                partNoColumnIndex = col;
            }
        }
    }

    for (let row = startingRow + 1; row <= range.e.r; row++) {
        const partNoCell = worksheet[xlsx.utils.encode_cell({ r: row, c: partNoColumnIndex })];
        if (partNoCell && cleanPartNumber(partNoCell.v.toString()) === partNo) {
            const valueCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Value'] })];
            const packageCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Package'] })];
            const qualificationCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Qualification'] })];
            const qtyCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Qty'] })];
    
            const value = valueCell ? valueCell.v : '';
            const pkg = packageCell ? packageCell.v : '';
            const qualification = qualificationCell ? qualificationCell.v : '';
            const qty = qtyCell ? qtyCell.v : '';
    
            return { partNo, value, package: pkg, qualification, qty, row };
        }
    }
    return null;
}

function getAllPartDetailsFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    const headers = {};
    let partNoColumnIndex = -1;
    const startingRow = 5; // Adjust this if your data starts on a different row

    // Get header information
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: startingRow, c: col });
        const cell = worksheet[cellAddress];
        if (cell) {
            const headerValue = cell.v.trim();
            headers[headerValue] = col;
            if (headerValue === 'MPN') {
                partNoColumnIndex = col;
            }
        }
    }

    const parts = []; // Array to store all parts

    // Read each part
    for (let row = startingRow + 1; row <= range.e.r; row++) {
        const partNoCell = worksheet[xlsx.utils.encode_cell({ r: row, c: partNoColumnIndex })];
        if (partNoCell) {
            const partNo = partNoCell.v; // Get the value of the MPN cell
            const valueCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Value'] })];
            const packageCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Package'] })];
            const qualificationCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Qualification'] })];
            const qtyCell = worksheet[xlsx.utils.encode_cell({ r: row, c: headers['Qty'] })];
    
            const value = valueCell ? valueCell.v : '';
            const pkg = packageCell ? packageCell.v : '';
            const qualification = qualificationCell ? qualificationCell.v : '';
            const qty = qtyCell ? qtyCell.v : '';

            // Push the part details into the array
            parts.push({ partNo, value, package: pkg, qualification, qty, row });
        }
    }

    return parts; // Return the array of parts
}

// Function to compare PDF parts with BOM parts
function comparePDFWithBOM(pdfParts, bomPartNumbers, bomFilePath) {
    const commonParts = [];
    pdfParts.forEach(pdfPart => {
        if (bomPartNumbers.includes(pdfPart)) {
            const partDetails = getPartDetailsFromExcel(bomFilePath, pdfPart);
            if (partDetails) {
                commonParts.push(partDetails);
            }
        }
    });
    return commonParts;
}

// Main comparison function
function comparePDFAndBOMs(pdfPath, bomPaths, callback) {
    extractPDFText(pdfPath).then((pdfText) => {
        const pdfParts = extractPartsFromPDFText(pdfText);

        let commonParts = [];
        bomPaths.forEach(bomPath => {
            const bomParts = extractPartNumbersFromExcel(bomPath);
            const matchedParts = comparePDFWithBOM(pdfParts, bomParts, bomPath);
            commonParts = commonParts.concat(matchedParts);

            // Store BOM parts in the database with duplicate check
            const partDetails = getAllPartDetailsFromExcel(bomPath);
            partDetails.forEach(part => {
                const { partNo, value, package: pkg, qualification, qty } = part;

                // Check if the part already exists in the database
                const checkQuery = 'SELECT 1 FROM bom_parts WHERE part_no = $1 LIMIT 1';
                client.query(checkQuery, [partNo], (checkErr, result) => {
                    if (checkErr) {
                        console.error('Error checking part existence:', checkErr.stack);
                    } else if (result.rowCount === 0) {
                        // Part does not exist, insert it
                        const insertQuery = `
                            INSERT INTO bom_parts (part_no, value, package, qualification, quantity)
                            VALUES ($1, $2, $3, $4, $5)`;
                        
                        client.query(insertQuery, [partNo, value, pkg, qualification, qty], (insertErr) => {
                            if (insertErr) {
                                console.error('Error inserting BOM part:', insertErr.stack);
                            }
                        });
                    } else {
                        console.log(`Part ${partNo} already exists in the database, skipping insertion.`);
                    }
                });
            });
        });

        callback(commonParts);
    }).catch((err) => {
        callback({ error: err.message });
    });
}


module.exports = { comparePDFAndBOMs };
