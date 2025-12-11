const express = require('express');
const router = express.Router();
const pool = require('./db');
const { z } = require('zod');

const customerSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    email: z.string().email("Debe ser un email válido"),
    phone: z.string().optional()
});
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = parseInt(req.query.cursor) || 0; 
        const search = req.query.search || '';

        let query = 'SELECT * FROM customers WHERE id > ?';
        const params = [cursor];

        if (search) {
            query += ' AND (name LIKE ? OR email LIKE ?)';
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

router.post('/', async (req, res) => {
    try {
        const data = customerSchema.parse(req.body);

        const [result] = await pool.query(
            'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
            [data.name, data.email, data.phone]
        );

        res.status(201).json({
            id: result.insertId,
            message: 'Cliente creado exitosamente',
            data
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        if (!name && !email && !phone) {
            return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
        }

        const fields = [];
        const params = [];
        if (name) { fields.push('name = ?'); params.push(name); }
        if (email) { fields.push('email = ?'); params.push(email); }
        if (phone) { fields.push('phone = ?'); params.push(phone); }
        
        params.push(req.params.id); 

        const sql = `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await pool.query(sql, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ message: 'Cliente actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        res.json({ message: 'Cliente eliminado correctamente' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'No se puede eliminar el cliente porque tiene pedidos asociados' });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;