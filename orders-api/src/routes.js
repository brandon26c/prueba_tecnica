// src/routes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { z } = require('zod');

// Esquema para validar creación de orden
const orderSchema = z.object({
    customerId: z.number(),
    items: z.array(z.object({
        productId: z.number(),
        qty: z.number().min(1)
    })).min(1)
});

// 1. CREAR ORDEN (Ya lo tenías, igual)
router.post('/', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { customerId, items } = orderSchema.parse(req.body);
        let totalCents = 0;
        const orderItemsData = [];

        // Verificar cliente (opcional, pero buena práctica)
        // Nota: En microservicios puros, esto se validaría antes o confiaríamos en el ID.

        for (const item of items) {
            // Bloquear fila para evitar condiciones de carrera
            const [rows] = await connection.query(
                'SELECT id, price_cents, stock FROM products WHERE id = ? FOR UPDATE', 
                [item.productId]
            );

            if (rows.length === 0) throw new Error(`Producto ID ${item.productId} no encontrado`);
            const product = rows[0];

            if (product.stock < item.qty) throw new Error(`Stock insuficiente para producto ${item.productId}`);

            const subtotal = product.price_cents * item.qty;
            totalCents += subtotal;

            orderItemsData.push({
                product_id: item.productId,
                qty: item.qty,
                unit_price: product.price_cents,
                subtotal: subtotal
            });

            // Restar stock
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
        
        res.status(201).json({
            id: orderId,
            status: 'CREATED',
            total_cents: totalCents,
            message: 'Orden creada exitosamente'
        });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message || 'Error procesando la orden' });
    } finally {
        connection.release();
    }
});

// 2. CONFIRMAR ORDEN (Con Idempotencia)
router.post('/:id/confirm', async (req, res) => {
    const orderId = req.params.id;
    const idempotencyKey = req.headers['x-idempotency-key'];

    if (!idempotencyKey) {
        return res.status(400).json({ error: 'Falta cabecera X-Idempotency-Key' });
    }

    try {
        // A. Verificar si ya existe esta llave
        const [keys] = await pool.query('SELECT * FROM idempotency_keys WHERE `key` = ?', [idempotencyKey]);
        
        if (keys.length > 0) {
            console.log('🔄 Retornando respuesta guardada (Idempotencia)');
            const savedResponse = keys[0];
            return res.status(savedResponse.status).json(savedResponse.response_body);
        }

        // B. Si no existe, procesar la confirmación
        const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

        const order = rows[0];
        if (order.status !== 'CREATED') {
            return res.status(400).json({ error: `No se puede confirmar una orden en estado ${order.status}` });
        }

        // Actualizar estado a CONFIRMED
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CONFIRMED', orderId]);

        const responseBody = {
            id: orderId,
            status: 'CONFIRMED',
            message: 'Orden confirmada exitosamente'
        };

        // C. Guardar la respuesta para el futuro (Idempotencia)
        await pool.query(
            'INSERT INTO idempotency_keys (`key`, response_body, status) VALUES (?, ?, ?)',
            [idempotencyKey, JSON.stringify(responseBody), 200]
        );

        res.status(200).json(responseBody);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. CANCELAR ORDEN (Restaurar Stock)
router.post('/:id/cancel', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
        if (rows.length === 0) throw new Error('Orden no encontrada');
        
        const order = rows[0];
        if (order.status === 'CANCELED') throw new Error('La orden ya está cancelada');

        // Obtener items para devolver stock
        const [items] = await connection.query('SELECT product_id, qty FROM order_items WHERE order_id = ?', [order.id]);

        for (const item of items) {
            await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
        }

        // Actualizar estado
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

// 4. OBTENER ORDEN (GET)
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