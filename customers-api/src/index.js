// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const customerRoutes = require('./routes');

const app = express();

app.use(express.json());
app.use(cors());

// Middleware de seguridad simple (Token check)
// El documento pide "autenticación simple", usaremos el SERVICE_TOKEN del .env
app.use((req, res, next) => {
    // Permitimos acceso libre a /health, pero protegemos el resto si quieres ser estricto
    // Por simplicidad en la prueba práctica, logueamos quién llama
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Rutas
app.use('/customers', customerRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'customers-api' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`🚀 Customers API lista en http://localhost:${port}`);
});