/**
 * Script para verificar los pedidos creados y ver si los mappers funcionaron
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_API_KEY = process.env.STRAPI_API_KEY;

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
    throw { status: response.status, text: errorText };
  }
  
  return response.json();
};

async function verificarPedidos() {
  console.log('\n🔍 Verificando pedidos creados...\n');
  
  try {
    // Obtener los últimos pedidos
    const response = await fetchAPI('/api/wo-pedidos?pagination[limit]=10&sort=createdAt:desc&populate=*');
    const pedidos = response.data || [];
    
    console.log(`📦 Encontrados ${pedidos.length} pedidos\n`);
    
    for (const pedido of pedidos.slice(0, 5)) {
      const attrs = pedido.attributes || pedido;
      console.log('='.repeat(70));
      console.log(`📋 Pedido ID: ${pedido.id}`);
      console.log(`   Número: ${attrs.numero_pedido || 'N/A'}`);
      console.log(`   Estado: ${attrs.estado || 'N/A'}`);
      console.log(`   wooId: ${attrs.wooId || 'N/A'}`);
      console.log(`   externalIds: ${JSON.stringify(attrs.externalIds || {})}`);
      console.log(`   Origen: ${attrs.origen || 'N/A'}`);
      console.log(`   Método pago: ${attrs.metodo_pago || 'N/A'}`);
      console.log(`   Moneda: ${attrs.moneda || 'N/A'}`);
      console.log(`   Total: ${attrs.total || 'N/A'}`);
      console.log(`   Items: ${(attrs.items || []).length}`);
      
      if (attrs.items && attrs.items.length > 0) {
        console.log('\n   📦 Items:');
        attrs.items.forEach((item, i) => {
          console.log(`      ${i + 1}. ${item.nombre || 'Sin nombre'}`);
          console.log(`         - SKU: ${item.sku || 'N/A'}`);
          console.log(`         - Product ID: ${item.producto_id || 'N/A'}`);
          console.log(`         - Cantidad: ${item.cantidad || 'N/A'}`);
          console.log(`         - Precio: $${item.precio_unitario || 'N/A'}`);
          console.log(`         - Total: $${item.total || 'N/A'}`);
          console.log(`         - Libro ID: ${item.libro ? (item.libro.id || item.libro) : 'N/A'}`);
        });
      }
      
      if (attrs.publishedAt) {
        console.log(`\n   ✅ Publicado: ${new Date(attrs.publishedAt).toLocaleString()}`);
      } else {
        console.log(`\n   ⚠️  No publicado aún`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error verificando pedidos:', error.status, error.text);
  }
}

verificarPedidos();
