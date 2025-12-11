const axios = require('axios');

const CUSTOMERS_API = process.env.CUSTOMERS_API_URL || 'http://localhost:3001';
const ORDERS_API = process.env.ORDERS_API_URL || 'http://localhost:3002';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;
const config = { headers: { Authorization: `Bearer ${SERVICE_TOKEN}` } };

module.exports.createOrder = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { customerId, items } = body;

    if (!customerId || !items) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos: customerId e items son requeridos' }),
      };
    }

    console.log(`[Orquestador] Validando cliente ID: ${customerId}...`);

    let customer;
    try {
      const customerResponse = await axios.get(`${CUSTOMERS_API}/customers/${customerId}`, config);      
      customer = customerResponse.data;
      console.log('Cliente validado:', customer.name);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `El cliente con ID ${customerId} no existe` }),
        };
      }
      throw error;
    }

    console.log('[Orquestador] Creando pedido en Orders API...');

    const orderResponse = await axios.post(`${ORDERS_API}/orders`, body, config);
    const orderData = orderResponse.data;

    console.log('Pedido creado ID:', orderData.id);

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
    console.error('Error en orquestador:', error.message);
    
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

module.exports.createAndConfirmOrder = async (event) => {
  try {
    const body = JSON.parse(event.body);
    
    const { customer_id, items, idempotency_key, correlation_id } = body;

    if (!customer_id || !items || !idempotency_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan datos requeridos (customer_id, items, idempotency_key)' }),
      };
    }

    if (correlation_id) console.log(`Correlation ID: ${correlation_id}`);
    console.log(`[Orquestador] Procesando para cliente ${customer_id}...`);

    let customerData;
    try {
      const customerResponse = await axios.get(`${CUSTOMERS_API}/internal/customers/${customer_id}`, config);
      customerData = customerResponse.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return { statusCode: 404, body: JSON.stringify({ error: `Cliente ${customer_id} no existe` }) };
      }
      throw error;
    }

    const itemsForApi = items.map(item => ({
        productId: item.product_id,
        qty: item.qty
    }));

    const createOrderResponse = await axios.post(`${ORDERS_API}/orders`, {
      customerId: customer_id, 
      items: itemsForApi
    }, config);
    
    const createdOrder = createOrderResponse.data;
    const orderId = createdOrder.id;

    const confirmConfig = {
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'X-Idempotency-Key': idempotency_key
      }
    };

    const confirmResponse = await axios.post(`${ORDERS_API}/orders/${orderId}/confirm`, {}, confirmConfig);
    const confirmedOrderData = confirmResponse.data;

    const responsePayload = {
      success: true,
      correlationId: correlation_id || null, 
      data: {
        customer: {
          id: customerData.id,
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone
        },
        order: {
          id: orderId,
          status: confirmedOrderData.status, 
          total_cents: createdOrder.total_cents,
          items: items.map(item => ({
              product_id: item.product_id,
              qty: item.qty,

          }))
        }
      }
    };

    return {
      statusCode: 201, 
      body: JSON.stringify(responsePayload),
    };

  } catch (error) {
    console.error(' Error:', error.message);
    const status = error.response ? error.response.status : 500;
    const errorMessage = error.response && error.response.data ? error.response.data : { error: error.message };
    return { statusCode: status, body: JSON.stringify(errorMessage) };
  }
};