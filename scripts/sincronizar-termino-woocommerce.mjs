/**
 * Script para sincronizar manualmente un término de atributo desde WooCommerce a Strapi
 * 
 * Uso:
 *   node scripts/sincronizar-termino-woocommerce.mjs "Autor" "Gabriel García Márquez" woo_moraleja
 * 
 * O con variables de entorno:
 *   ATTRIBUTE_NAME="Autor" TERM_NAME="Gabriel García Márquez" PLATFORM="woo_moraleja" node scripts/sincronizar-termino-woocommerce.mjs
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN || process.env.IMPORT_TOKEN;

// Obtener parámetros desde argumentos de línea de comandos o variables de entorno
const attributeName = process.argv[2] || process.env.ATTRIBUTE_NAME;
const termName = process.argv[3] || process.env.TERM_NAME;
const platform = process.argv[4] || process.env.PLATFORM || 'woo_moraleja';

if (!attributeName || !termName) {
  console.error('❌ Error: Se requieren attributeName y termName');
  console.error('\nUso:');
  console.error('  node scripts/sincronizar-termino-woocommerce.mjs "Autor" "Gabriel García Márquez" woo_moraleja');
  console.error('\nO con variables de entorno:');
  console.error('  ATTRIBUTE_NAME="Autor" TERM_NAME="Gabriel García Márquez" PLATFORM="woo_moraleja" node scripts/sincronizar-termino-woocommerce.mjs');
  process.exit(1);
}

if (!STRAPI_TOKEN) {
  console.error('❌ Error: STRAPI_TOKEN no está configurado');
  console.error('   Configura STRAPI_TOKEN, STRAPI_API_TOKEN o IMPORT_TOKEN en .env');
  process.exit(1);
}

async function syncTerm() {
  console.log('🔄 Sincronizando término desde WooCommerce a Strapi...\n');
  console.log(`📍 Strapi URL: ${STRAPI_URL}`);
  console.log(`📋 Atributo: ${attributeName}`);
  console.log(`📝 Término: ${termName}`);
  console.log(`🌐 Plataforma: ${platform}\n`);

  try {
    const url = `${STRAPI_URL}/api/woo-webhook/sync-term/${platform}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nota: El endpoint no requiere autenticación, pero puedes agregarla si lo necesitas
      },
      body: JSON.stringify({
        attributeName,
        termName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Término sincronizado exitosamente!\n');
      console.log('📊 Detalles:');
      console.log(`   - Atributo: ${result.data.attributeName}`);
      console.log(`   - Término: ${result.data.termName}`);
      console.log(`   - Descripción: ${result.data.termDescription ? '✅ Sí' : '❌ No'}`);
      console.log(`   - ID en Strapi: ${result.data.strapiId || 'N/A'}`);
      console.log(`   - ID de Atributo en WooCommerce: ${result.data.wooAttributeId}`);
      console.log(`   - ID de Término en WooCommerce: ${result.data.wooTermId}`);
      
      if (result.data.termDescription) {
        console.log(`\n📝 Descripción sincronizada:`);
        console.log(`   ${result.data.termDescription.substring(0, 200)}${result.data.termDescription.length > 200 ? '...' : ''}`);
      }
    } else {
      console.error('❌ Error en la sincronización:', result.message || 'Error desconocido');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

syncTerm();




