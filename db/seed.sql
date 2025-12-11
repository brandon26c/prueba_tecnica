-- Insertar Clientes de prueba
INSERT INTO customers (name, email, phone) VALUES 
('Luisito Manya', 'luisitom@gmail.com', '0983250604'),
('Cristian Romero', 'cr@hotmail.com', '0981136523');

-- Insertar Productos de prueba
-- Laptop: $1500.00 (150000 centavos), Mouse: $25.00, Teclado: $80.00
INSERT INTO products (sku, name, price_cents, stock) VALUES 
('LPT-001', 'Laptop Gamer', 150000, 10),
('MSE-002', 'Mouse Wireless', 2500, 50),
('KBD-003', 'Teclado Mecanico', 8000, 20);