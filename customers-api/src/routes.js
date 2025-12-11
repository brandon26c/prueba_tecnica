const express = require('express');
const router = express.Router();
const pool = require('./db');
const { z } = require('zod');

// Esquema de validación con Zod (Requisito del documento)
const customerSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    email: z.string().email("Debe ser un email válido"),
    phone: z.string().optional()
});

// 1. Crear Cliente
router.post('/', async (req, res) => {
    try {
        // Validar datos de entrada
        const data = customerSchema.parse(req.body);

        // Insertar en Base de Datos
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
        // Manejo de errores (ej: email duplicado o validación fallida)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: error.message });
    }
});

// 2. Obtener Cliente por ID
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

module.exports = router;