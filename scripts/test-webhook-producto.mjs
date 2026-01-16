/**
 * Script para probar el endpoint de webhook de producto
 * Simula el envío de un producto desde WooCommerce
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const PLATFORM = process.env.PLATFORM || 'woo_moraleja';

// Producto de ejemplo similar al que envía WooCommerce
const productoEjemplo = {
  id: 999,
  name: 'Libro de Prueba Webhook',
  slug: 'libro-de-prueba-webhook',
  permalink: 'https://staging.moraleja.cl/product/libro-de-prueba-webhook/',
  type: 'simple',
  status: 'publish',
  featured: false,
  catalog_visibility: 'visible',
  description: 'Este es un libro de prueba para verificar que el webhook funciona correctamente',
  short_description: 'Libro de prueba',
  sku: 'TEST-WEBHOOK-001',
  price: '10000',
  regular_price: '12000',
  sale_price: '10000',
  on_sale: true,
  purchasable: true,
  total_sales: 0,
  virtual: false,
  downloadable: false,
  downloads: [],
  download_limit: -1,
  download_expiry: -1,
  external_url: '',
  button_text: '',
  tax_status: 'taxable',
  tax_class: '',
  manage_stock: true,
  stock_quantity: 10,
  stock_status: 'instock',
  backorders: 'no',
  backorders_allowed: false,
  backordered: false,
  sold_individually: false,
  weight: '0.5',
  dimensions: {
    length: '20',
    width: '15',
    height: '2',
  },
  shipping_required: true,
  shipping_taxable: true,
  shipping_class: '',
  shipping_class_id: 0,
  reviews_allowed: true,
  average_rating: '0.00',
  rating_count: 0,
  related_ids: [],
  upsell_ids: [],
  cross_sell_ids: [],
  parent_id: 0,
  purchase_note: '',
  categories: [
    {
      id: 1,
      name: 'Categoría de Prueba',
      slug: 'categoria-de-prueba',
    },
  ],
  tags: [
    {
      id: 1,
      name: 'Prueba',
      slug: 'prueba',
    },
  ],
  images: [
    {
      id: 1,
      src: 'https://via.placeholder.com/300',
      name: 'Imagen de prueba',
      alt: 'Imagen de prueba',
    },
  ],
  attributes: [
    {
      id: 1,
      name: 'Autor',
      slug: 'autor',
      position: 0,
      visible: true,
      variation: false,
      options: ['Autor de Prueba'],
    },
    {
      id: 2,
      name: 'Editorial',
      slug: 'editorial',
      position: 1,
      visible: true,
      variation: false,
      options: ['Editorial de Prueba'],
    },
  ],
  default_attributes: [],
  variations: [],
  grouped_products: [],
  menu_order: 0,
  meta_data: [
    {
      id: 1,
      key: 'isbn',
      value: '9781234567890',
    },
  ],
  date_created: new Date().toISOString(),
  date_created_gmt: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  date_modified_gmt: new Date().toISOString(),
};

async function testWebhook() {
  const url = `${STRAPI_URL}/api/woo-webhook/product/${PLATFORM}`;
  
  console.log('🧪 Probando webhook de producto...');
  console.log(`📍 URL: ${url}`);
  console.log(`📦 Platform: ${PLATFORM}`);
  console.log(`📋 Producto ID: ${productoEjemplo.id}`);
  console.log(`📖 Nombre: ${productoEjemplo.name}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WooCommerce/Test-Webhook',
      },
      body: JSON.stringify(productoEjemplo),
    });
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }
    
    console.log(`\n✅ Status: ${response.status} ${response.statusText}`);
    console.log('📥 Response:', JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log('\n✨ Webhook procesado exitosamente!');
    } else {
      console.log('\n❌ Error en el webhook');
    }
  } catch (error) {
    console.error('\n❌ Error al enviar webhook:', error.message);
    console.error('Stack:', error.stack);
  }
}

testWebhook();
