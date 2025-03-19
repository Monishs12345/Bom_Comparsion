const url = "http://127.0.0.1:3015";

document.getElementById('uploadForm').addEventListener('submit', function (e) {
    e.preventDefault(); // Prevent the form from submitting normally

    const formData = new FormData();
    const pdfFile = document.getElementById('pdfFile').files[0];
    formData.append('pdfFile', pdfFile); // Append PDF file

    // Append all BOM files
    const bomFiles = document.getElementById('bomFiles').files;
    for (let i = 0; i < bomFiles.length; i++) {
        formData.append('bomFiles', bomFiles[i]);
    }

    // Log uploaded files
    console.log('PDF File:', pdfFile);
    console.log('BOM Files:', bomFiles);

    // Send the files to the server
    fetch(`${url}/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(response);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const commonPartsBody = document.getElementById('commonPartsBody');
        commonPartsBody.innerHTML = ''; // Clear previous results

        // Check if data is received and contains common parts
        if (data.length > 0) {
            data.forEach(part => {
                const row = document.createElement('tr');

                // Populate part details in table
                row.innerHTML = `
                    <td>${part.partNo}</td>
                    <td>${part.value}</td>
                    <td>${part.package}</td>
                    <td>${part.qualification}</td>
                    <td>${part.qty}</td>
                `;
                commonPartsBody.appendChild(row);
            });
        } else {
            commonPartsBody.innerHTML = '<tr><td colspan="5">No common parts found.</td></tr>';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error uploading or comparing files: ' + error.message);
    });
});
