require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ordersRoutes = require('./routes');

const app = express();
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
    if (req.path === '/health') return next();

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);
    if (token !== process.env.SERVICE_TOKEN) return res.sendStatus(403);

    next();
});
app.use('/orders', ordersRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'orders-api' });
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
    console.log(`Orders API lista en http://localhost:${port}`);
});