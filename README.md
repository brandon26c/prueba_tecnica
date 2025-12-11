# Prueba Técnica - Senior Backend

Sistema de microservicios para gestión de pedidos orquestados.

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