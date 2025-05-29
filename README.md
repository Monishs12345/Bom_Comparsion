🧾 BOM Comparison and PCB Management System
A complete web-based system for uploading and comparing Bill of Materials (BOM) files, managing part inventories, and tracking PCB assemblies using a PostgreSQL database. This project is designed to streamline electronic component inventory management in a B2B setup.

🚀 Features
🔍 Component Database

Search Part: Autocomplete search by part number or shelf.

Upload BOMs: Upload multiple Excel BOM files. Duplicate BOMs are automatically rejected using file hashing.

Manual Quantity Entry: Enter parts and their quantities linked to a PO number.

Comparison: Automatically identifies common parts between uploaded BOMs and manual entries.

Export: Results can be downloaded as a CSV file.

🖥️ PCB Entry and Management
Create PCB Entries: Add entries with fields such as PCB name, assembled quantity, non-assembled quantity, shelf, and responsible person.

Track Usage: Fields for date taken and return date.

CRUD Operations: (Optional) Includes backend support for creating, reading, updating, and deleting PCB entries.

🛠️ Technologies Used
Frontend: HTML, CSS, JavaScript

Backend: Node.js with Express

Database: PostgreSQL

Libraries: multer, csv-parser, xlsx, crypto, pg
