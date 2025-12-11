## Estructura
- **customers-api**: Microservicio de gestión de clientes (Node.js + Express + MySQL).
- **orders-api**: Microservicio de gestión de pedidos e inventario (Node.js + Express + MySQL + Transacciones).
- **lambda-orchestrator**: Función Serverless para orquestar la compra.
- **db**: Scripts de inicialización de base de datos.

## Pre-requisitos
- Docker y Docker Compose
- Node.js (v18 o superior recomendado)
- Serverless Framework v4

## Instrucciones de Instalación

### 1. Base de Datos
Levantar el contenedor de MySQL:
```bash
docker-compose up -d

## Pruebas y Ejemplos (cURL)

El sistema utiliza un token simple para seguridad interna. 
Token por defecto: `token_super_secreto_123`

### 2. Crear Cliente (Customers API)
```bash
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_super_secreto_123" \
  -d '{
    "name": "Cliente Demo",
    "email": "demo@test.com",
    "phone": "+593999999"
  }'

  curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_super_secreto_123" \
  -d '{
    "customerId": 1,
    "items": [
      { "productId": 1, "qty": 1 }
    ]
  }'

  curl -X POST http://localhost:3000/dev/order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "items": [
      { "productId": 2, "qty": 2 }
    ]
  }'

  curl -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer token_super_secreto_123" \
  -H "X-Idempotency-Key: clave-unica-abc-123"