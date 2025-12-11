const axios = require('axios'); 
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { z } = require('zod');

const orderSchema = z.object({
    customerId: z.number(),
    items: z.array(z.object({
        productId: z.number(),
        qty: z.number().min(1)
    })).min(1)
});

const productSchema = z.object({
    sku: z.string().min(3, "SKU es requerido"),
    name: z.string().min(1, "Nombre es requerido"),
    price_cents: z.number().int().positive(),
    stock: z.number().int().min(0)
});

router.get('/products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = parseInt(req.query.cursor) || 0;
        const search = req.query.search || '';

        let query = 'SELECT * FROM products WHERE id > ?';
        const params = [cursor];

        if (search) {
            query += ' AND (name LIKE ? OR sku LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY id ASC LIMIT ?';
        params.push(limit);

        const [rows] = await pool.query(query, params);

        let nextCursor = null;
        if (rows.length > 0) {
            nextCursor = rows[rows.length - 1].id;
        }

        res.json({
            data: rows,
            pagination: {
                nextCursor: rows.length === limit ? nextCursor : null,
                limit
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/products/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const data = productSchema.parse(req.body);
        
        const [result] = await pool.query(
            'INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)',
            [data.sku, data.name, data.price_cents, data.stock]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Producto creado exitosamente',
            data
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El SKU ya existe' });
        }
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const { stock, price_cents } = req.body;
        
        if (stock === undefined && price_cents === undefined) {
            return res.status(400).json({ error: 'Debes enviar stock o price_cents para actualizar' });
        }

        const fields = [];
        const params = [];

        if (stock !== undefined) {
            fields.push('stock = ?');
            params.push(stock);
        }
        if (price_cents !== undefined) {
            fields.push('price_cents = ?');
            params.push(price_cents);
        }

        params.push(req.params.id);

        const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = parseInt(req.query.cursor) || 0;
        const { status, from, to } = req.query;

        let query = 'SELECT * FROM orders WHERE id > ?';
        const params = [cursor];

        if (status) query += ' AND status = ?', params.push(status);
        if (from) query += ' AND created_at >= ?', params.push(new Date(from));
        if (to) query += ' AND created_at <= ?', params.push(new Date(to));

        query += ' ORDER BY id ASC LIMIT ?';
        params.push(limit);

        const [rows] = await pool.query(query, params);

        let nextCursor = null;
        if (rows.length > 0) nextCursor = rows[rows.length - 1].id;

        res.json({
            data: rows,
            pagination: { nextCursor: rows.length === limit ? nextCursor : null, limit }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    const CUSTOMERS_API = process.env.CUSTOMERS_API_URL || 'http://localhost:3001';
    const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'token_super_secreto_123';
    const connection = await pool.getConnection();

    try {
        const { customerId, items } = orderSchema.parse(req.body);

        try {
            await axios.get(`${CUSTOMERS_API}/internal/customers/${customerId}`, {
                headers: { Authorization: `Bearer ${SERVICE_TOKEN}` }
            });
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return res.status(404).json({ error: `El cliente ID ${customerId} no existe` });
            }
            throw new Error('Error conectando con Customers API');
        }

        await connection.beginTransaction();

        let totalCents = 0;
        const orderItemsData = [];

        for (const item of items) {
            const [rows] = await connection.query(
                'SELECT id, price_cents, stock FROM products WHERE id = ? FOR UPDATE', 
                [item.productId]
            );

            if (rows.length === 0) throw new Error(`Producto ID ${item.productId} no encontrado`);
            const product = rows[0];

            if (product.stock < item.qty) throw new Error(`Stock insuficiente para producto ${item.productId}`);

            const subtotal = Math.round(product.price_cents * item.qty);
            totalCents += subtotal;

            orderItemsData.push({
                product_id: item.productId, qty: item.qty, unit_price: product.price_cents, subtotal: subtotal
            });

            await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.qty, item.productId]);
        }

        const [orderResult] = await connection.query(
            'INSERT INTO orders (customer_id, total_cents, status) VALUES (?, ?, ?)',
            [customerId, totalCents, 'CREATED']
        );
        const orderId = orderResult.insertId;

        for (const data of orderItemsData) {
            await connection.query(
                'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
                [orderId, data.product_id, data.qty, data.unit_price, data.subtotal]
            );
        }

        await connection.commit();
        res.status(201).json({ id: orderId, status: 'CREATED', total_cents: totalCents, message: 'Orden creada exitosamente' });

    } catch (error) {
        await connection.rollback();
        if (!res.headersSent) res.status(400).json({ error: error.message || 'Error procesando la orden' });
    } finally {
        connection.release();
    }
});

router.post('/:id/confirm', async (req, res) => {
    const orderId = req.params.id;
    const idempotencyKey = req.headers['x-idempotency-key'];

    if (!idempotencyKey) return res.status(400).json({ error: 'Falta cabecera X-Idempotency-Key' });

    try {
        const [keys] = await pool.query('SELECT * FROM idempotency_keys WHERE `key` = ?', [idempotencyKey]);
        
        if (keys.length > 0) {
            const savedResponse = keys[0];
            return res.status(savedResponse.status).json(savedResponse.response_body);
        }

        const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

        const order = rows[0];
        if (order.status !== 'CREATED') return res.status(400).json({ error: `No se puede confirmar una orden en estado ${order.status}` });

        await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CONFIRMED', orderId]);

        const responseBody = { id: orderId, status: 'CONFIRMED', message: 'Orden confirmada exitosamente' };

        await pool.query(
            'INSERT INTO idempotency_keys (`key`, response_body, status) VALUES (?, ?, ?)',
            [idempotencyKey, JSON.stringify(responseBody), 200]
        );

        res.status(200).json(responseBody);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/cancel', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
        if (rows.length === 0) throw new Error('Orden no encontrada');
        
        const order = rows[0];

        if (order.status === 'CANCELED') throw new Error('La orden ya está cancelada');

        if (order.status === 'CONFIRMED') {
            const now = new Date();
            const orderDate = new Date(order.created_at);
            const diffMinutes = (now - orderDate) / 1000 / 60;
            if (diffMinutes > 10) throw new Error('El tiempo de cancelación para órdenes confirmadas (10 min) ha expirado');
        }

        const [items] = await connection.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [order.id]);

        for (const item of items) {
            await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
        }

        await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELED', order.id]);

        await connection.commit();
        res.json({ message: 'Orden cancelada y stock restaurado' });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

router.get('/:id', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (orders.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
        
        const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);

        res.json({ ...orders[0], items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;