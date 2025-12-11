// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ordersRoutes = require('./routes');

const app = express();
app.use(express.json());
app.use(cors());

// Rutas
app.use('/orders', ordersRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'orders-api' });
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`🚀 Orders API lista en http://localhost:${port}`);
});