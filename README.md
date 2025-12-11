# Sistema de Gestión de Pedidos B2B (Backend Challenge)

## Estructura
* **customers-api**: Microservicio de gestión de clientes (Node.js + Express + MySQL).
* **orders-api**: Microservicio de gestión de pedidos e inventario (Node.js + Express + MySQL + Transacciones).
* **lambda-orchestrator**: Función Serverless para orquestar la compra (Validación + Creación + Confirmación).
* **db**: Scripts SQL de inicialización y datos de prueba.

##  Pre-requisitos
* Docker y Docker Compose
* Node.js (v18 o superior)
* Serverless Framework v4

## Instrucciones de Instalación

### 1. Base de Datos
Levantar el contenedor de MySQL:
```bash
docker-compose up -d
```

### 2. Ejecutar Servicios

```bash
### service customers
cd customers-api
npm install
npm run dev

### service
cd orders-api
npm install
npm run dev

cd lambda-orchestrator
npm run dev
```
### Ejemplos Curl
### Crear Cliente (Customers API)
```bash
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_super_secreto_123" \
  -d '{
    "name": "Cliente Demo",
    "email": "demo_curl@test.com",
    "phone": "+593999999"
  }'
```
### Ver Productos Disponibles (Orders API)
```bash
curl -X GET "http://localhost:3002/orders/products?search=Laptop" \
  -H "Authorization: Bearer token_super_secreto_123"
```

### Lambda
```bash
curl -X POST http://localhost:3000/dev/orchestrator/create-and-confirm-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "items": [
      { "product_id": 2, "qty": 1 }
    ],
    "idempotency_key": "key-unica-prueba-final",
    "correlation_id": "trace-101"
  }'
  ```

### Crear Orden Manualmente
```bash
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_super_secreto_123" \
  -d '{
    "customerId": 1,
    "items": [
      { "productId": 1, "qty": 1 }
    ]
  }'
```
### Confirmar Orden
```bash
curl -X POST http://localhost:3002/orders/1/confirm \
  -H "Authorization: Bearer token_super_secreto_123" \
  -H "X-Idempotency-Key: mi-clave-segura-001"
```
### Cancelar Orden (Prueba de Stock)
```bash
curl -X POST http://localhost:3002/orders/1/cancel \
  -H "Authorization: Bearer token_super_secreto_123"
```

### Buscar Órdenes (Filtros)
```bash
curl -X GET "http://localhost:3002/orders?status=CONFIRMED&limit=5" \
  -H "Authorization: Bearer token_super_secreto_123"
```
