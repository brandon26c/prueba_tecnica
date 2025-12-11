require('dotenv').config();
const express = require('express');
const cors = require('cors');
const customerRoutes = require('./routes');

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

app.use('/customers', customerRoutes);
app.use('/internal/customers', customerRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'customers-api' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Customers API lista en http://localhost:${port}`);
});