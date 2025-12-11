// handler.js
const axios = require('axios');

// URLs de los microservicios (leyendo de variables de entorno o usando localhost por defecto)
const CUSTOMERS_API = process.env.CUSTOMERS_API_URL || 'http://localhost:3001';
const ORDERS_API = process.env.ORDERS_API_URL || 'http://localhost:3002';

module.exports.createOrder = async (event) => {
  try {
    // 1. Parsear el cuerpo de la solicitud
    const body = JSON.parse(event.body);
    const { customerId, items } = body;

    if (!customerId || !items) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos: customerId e items son requeridos' }),
      };
    }

    console.log(`🔍 [Orquestador] Validando cliente ID: ${customerId}...`);

    // 2. Validar Cliente (Llamada a Customers API)
    let customer;
    try {
      const customerResponse = await axios.get(`${CUSTOMERS_API}/customers/${customerId}`);
      customer = customerResponse.data;
      console.log('✅ Cliente validado:', customer.name);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `El cliente con ID ${customerId} no existe` }),
        };
      }
      throw error; // Si es otro error (ej: API caída), que pase al catch general
    }

    console.log('📦 [Orquestador] Creando pedido en Orders API...');

    // 3. Crear Pedido (Llamada a Orders API)
    // Nota: Pasamos el mismo body que recibimos
    const orderResponse = await axios.post(`${ORDERS_API}/orders`, body);
    const orderData = orderResponse.data;

    console.log('✅ Pedido creado ID:', orderData.id);

    // 4. Retornar JSON Consolidado (Cliente + Pedido)
    // El requisito pide un "JSON consolidado"
    const response = {
      message: 'Orquestación exitosa',
      customer_summary: {
        id: customer.id,
        name: customer.name,
        email: customer.email
      },
      order_details: orderData
    };

    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Error en orquestador:', error.message);
    
    // Manejo de errores seguro
    const status = error.response ? error.response.status : 500;
    const errorMessage = error.response && error.response.data 
      ? error.response.data 
      : { error: error.message };

    return {
      statusCode: status,
      body: JSON.stringify(errorMessage),
    };
  }
};