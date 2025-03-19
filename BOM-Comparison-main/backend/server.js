const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const cors = require('cors');
const { comparePDFAndBOMs, updateQuantityInBOM } = require('./readBom'); // Import your comparison logic
const pool = require('./db'); // Import PostgreSQL connection from db.js

const app = express();
const port = 3015;

app.use(fileUpload());

// Middleware to parse JSON data from the frontend (for quantity update)
app.use(express.json());
app.use(cors());

// Upload route for handling PDF and multiple BOMs
app.post('/upload', async (req, res) => {
    // Validate file uploads
    if (!req.files || !req.files.pdfFile || !req.files.bomFiles) {
        return res.status(400).send('PDF and BOM files are required.');
    }

    const pdfFile = req.files.pdfFile;
    const bomFiles = Array.isArray(req.files.bomFiles) ? req.files.bomFiles : [req.files.bomFiles]; // Handle multiple BOMs

    const pdfPath = path.join(__dirname, 'uploads', pdfFile.name);
    const bomPaths = bomFiles.map(bomFile => path.join(__dirname, 'uploads', bomFile.name));

    // Move the PDF file to the uploads directory
    pdfFile.mv(pdfPath, (err) => {
        if (err) {
            console.error('Error uploading PDF file:', err);
            return res.status(500).send('Error uploading PDF file.');
        }

        // Move each BOM file to the uploads directory
        const bomUploadPromises = bomFiles.map(bomFile => {
            return new Promise((resolve, reject) => {
                const bomPath = path.join(__dirname, 'uploads', bomFile.name);
                bomFile.mv(bomPath, (err) => {
                    if (err) {
                        console.error('Error uploading BOM file:', err);
                        reject(err);
                    } else {
                        resolve(bomPath);
                    }
                });
            });
        });

        // After all files are uploaded, compare them
        Promise.all(bomUploadPromises).then(async (uploadedBomPaths) => {
            const uniquePartNumbers = new Set(); // Use a Set to hold unique part numbers
            
            // Loop through each BOM file and extract part numbers
            for (const bomPath of uploadedBomPaths) {
                const parts = await extractPartNumbersFromBOM(bomPath); // Implement this function to extract part numbers
                parts.forEach(part => uniquePartNumbers.add(part)); // Add unique part numbers to the Set
            }

            // Insert unique part numbers into the database
            for (const partNo of uniquePartNumbers) {
                try {
                    // Use 'ON CONFLICT' to avoid duplicates based on the part_no
                    await pool.query(`
                        INSERT INTO parts (part_no) 
                        VALUES ($1) 
                        ON CONFLICT (part_no) 
                        DO NOTHING
                    `, [partNo]);  // This will skip any part_no that already exists
                } catch (err) {
                    console.error('Error inserting part number:', err);
                }
            }

            // Now proceed with the PDF and BOM comparison
            comparePDFAndBOMs(pdfPath, uploadedBomPaths, (comparisonResults) => {
                if (comparisonResults.error) {
                    console.error('Error during comparison:', comparisonResults.error);
                    return res.status(500).send('Error during comparison.');
                }
                res.json(comparisonResults); // Return the comparison results to the frontend
            });
        }).catch((err) => {
            console.error('Error uploading BOM files:', err);
            res.status(500).send('Error uploading BOM files.');
        });
    });
});

// Function to extract part numbers from the BOM
async function extractPartNumbersFromBOM(bomPath) {
    // Implement your logic to read the BOM file and extract part numbers
    // Return an array of part numbers
    return []; // Placeholder return
}

// Route to update the quantity of common parts
app.post('/update-quantity', (req, res) => {
    const updates = req.body; // Array of updates

    if (!Array.isArray(updates)) {
        return res.status(400).send('Updates should be an array.');
    }

    const updatePromises = updates.map(update => {
        const { bomPath, row, newQuantity } = update;

        return new Promise((resolve, reject) => {
            if (!bomPath || row === undefined || newQuantity === undefined) {
                return reject('Missing required fields.');
            }

            updateQuantityInBOM(bomPath, row, newQuantity, (err) => {
                if (err) {
                    console.error('Error updating quantity:', err);
                    reject(err);
                } else {
                    resolve('Quantity updated successfully');
                }
            });
        });
    });

    // Resolve all promises
    Promise.all(updatePromises).then(results => {
        res.send(results); // Send success response
    }).catch(err => {
        res.status(500).send('Error updating quantities: ' + err);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
