/**
 * Script para forzar la sincronización de un pedido específico
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_API_KEY = process.env.STRAPI_API_KEY;
const PEDIDO_ID = process.env.PEDIDO_ID || '62';

if (!STRAPI_API_KEY) {
  console.error('❌ Error: Token de API no está definida');
  process.exit(1);
}

const fetchAPI = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${STRAPI_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_API_KEY}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    throw { status: response.status, text: errorText, data: errorData };
  }
  
  return response.json();
};

async function forzarSincronizacion() {
  console.log(`\n🔄 Forzando sincronización del pedido ${PEDIDO_ID}\n`);
  
  try {
    // 1. Obtener el pedido
    const pedido = await fetchAPI(`/api/wo-pedidos/${PEDIDO_ID}?populate=*`);
    const pedidoData = pedido.data || pedido;
    const attrs = pedidoData.attributes || pedidoData;
    
    console.log('📋 Pedido actual:');
    console.log(`   ID: ${pedidoData.id}`);
    console.log(`   Número: ${attrs.numero_pedido}`);
    console.log(`   Estado: ${attrs.estado}`);
    console.log(`   wooId: ${attrs.wooId}`);
    console.log(`   Items: ${(attrs.items || []).length}`);
    console.log(`   externalIds: ${JSON.stringify(attrs.externalIds || {})}`);
    
    // 2. Agregar items si no tiene
    if (!attrs.items || attrs.items.length === 0) {
      console.log('\n📦 Agregando items al pedido...');
      
      const pedidoActualizado = await fetchAPI(`/api/wo-pedidos/${PEDIDO_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            items: [
              {
                nombre: 'Item de Prueba Mapper 1',
                sku: 'TEST-MAPPER-1',
                cantidad: 2,
                precio_unitario: 10000,
                total: 20000,
              },
              {
                nombre: 'Item de Prueba Mapper 2',
                sku: 'TEST-MAPPER-2',
                cantidad: 1,
                precio_unitario: 5000,
                total: 5000,
              },
            ],
            total: 25000,
          },
        }),
      });
      
      console.log('✅ Items agregados');
    }
    
    // 3. Forzar actualización para activar afterUpdate
    console.log('\n🔄 Forzando actualización para activar sincronización...');
    
    const pedidoActualizado = await fetchAPI(`/api/wo-pedidos/${PEDIDO_ID}`, {
      method: 'PUT',
      body: JSON.stringify({
        data: {
          estado: attrs.estado || 'pending', // Forzar actualización
        },
      }),
    });
    
    console.log('✅ Pedido actualizado');
    
    // 4. Esperar un momento
    console.log('\n⏳ Esperando 5 segundos para que se procese la sincronización...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 5. Verificar resultado
    const pedidoFinal = await fetchAPI(`/api/wo-pedidos/${PEDIDO_ID}?populate=*`);
    const pedidoFinalData = pedidoFinal.data || pedidoFinal;
    const attrsFinal = pedidoFinalData.attributes || pedidoFinalData;
    const externalIds = attrsFinal.externalIds || {};
    
    console.log('\n📊 Resultado de sincronización:');
    console.log(`   externalIds: ${JSON.stringify(externalIds)}`);
    
    if (externalIds.woo_moraleja && externalIds.woo_moraleja.orderId) {
      console.log(`   ✅ Sincronizado a WooCommerce: Order ID ${externalIds.woo_moraleja.orderId}`);
    } else {
      console.log(`   ⚠️  No sincronizado aún o falló la sincronización`);
      console.log(`   💡 Revisa los logs de Strapi para ver si los mappers se usaron`);
      console.log(`   💡 Los logs deberían mostrar mensajes sobre mappers`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.status, error.data || error.text);
    if (error.data && error.data.error) {
      console.error('   Detalles:', JSON.stringify(error.data.error, null, 2));
    }
  }
}

forzarSincronizacion();
