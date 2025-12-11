require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true 
};

async function runSqlFile(fileName) {
    const filePath = path.join(__dirname, '../../../db', fileName);
    
    console.log(`Leyendo archivo: ${filePath}`);

    try {
        const sql = fs.readFileSync(filePath, 'utf8');
        const connection = await mysql.createConnection(dbConfig);
        
        console.log('🔌 Conectado a la BD. Ejecutando SQL...');
        await connection.query(sql);
        
        console.log(`${fileName} ejecutado correctamente.`);
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando SQL:', error.message);
        process.exit(1);
    }
}

const fileToRun = process.argv[2];
if (!fileToRun) {
    console.error('Debes especificar el archivo SQL a ejecutar');
    process.exit(1);
}

runSqlFile(fileToRun);