/**
 * Script para ejecutar sincronización periódica bidireccional de términos
 * 
 * IMPORTANTE: Solo sincroniza cambios nuevos o modificados, NO re-sincroniza todo
 * 
 * Uso:
 *   node scripts/sincronizacion-periodica.mjs woo_moraleja
 *   node scripts/sincronizacion-periodica.mjs woo_moraleja --recent-hours=3
 *   node scripts/sincronizacion-periodica.mjs woo_moraleja --dry-run
 *   node scripts/sincronizacion-periodica.mjs woo_moraleja --attribute-types="Autor,Obra"
 * 
 * Recomendación para ejecución cada 2 horas:
 *   --recent-hours=3 (para tener margen de seguridad)
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
// El endpoint sync-all requiere STRAPI_API_TOKEN específicamente
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

// Parsear argumentos de línea de comandos
const args = process.argv.slice(2);
const platform = args[0] || process.env.PLATFORM || 'woo_moraleja';

let recentHours = 24;
let attributeTypes = undefined;
let dryRun = false;

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--recent-hours=')) {
    recentHours = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--attribute-types=')) {
    attributeTypes = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    dryRun = true;
  }
}

if (!STRAPI_API_TOKEN) {
  console.error('❌ Error: STRAPI_API_TOKEN no está configurado');
  console.error('   Configura STRAPI_API_TOKEN, STRAPI_TOKEN o IMPORT_TOKEN en .env');
  console.error('   Nota: El endpoint sync-all requiere STRAPI_API_TOKEN específicamente');
  process.exit(1);
}

if (platform !== 'woo_moraleja' && platform !== 'woo_escolar') {
  console.error('❌ Error: Platform debe ser "woo_moraleja" o "woo_escolar"');
  process.exit(1);
}

async function syncAll() {
  console.log('🔄 Ejecutando sincronización periódica bidireccional...\n');
  console.log(`📍 Strapi URL: ${STRAPI_URL}`);
  console.log(`🌐 Plataforma: ${platform}`);
  console.log(`⏰ Horas recientes: ${recentHours}`);
  console.log(`📋 Tipos de atributos: ${attributeTypes || 'todos'}`);
  console.log(`🧪 Dry run: ${dryRun ? 'Sí' : 'No'}`);
  console.log(`\n💡 Nota: Solo sincronizará cambios nuevos o modificados, NO re-sincronizará todo\n`);

  try {
    const url = new URL(`/api/woo-webhook/sync-all/${platform}`, STRAPI_URL);
    url.searchParams.set('recentHours', recentHours.toString());
    if (attributeTypes) {
      url.searchParams.set('attributeTypes', attributeTypes);
    }
    if (dryRun) {
      url.searchParams.set('dryRun', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Sincronización periódica completada!\n');
      console.log('📊 Resumen:');
      console.log(`   - Total sincronizados: ${result.data.summary.totalSincronizados}`);
      console.log(`   - Total omitidos: ${result.data.summary.totalOmitidos}`);
      console.log(`   - Total errores: ${result.data.summary.totalErrores}\n`);
      
      console.log('📥 WooCommerce → Strapi:');
      console.log(`   - Nuevos: ${result.data.results.wooToStrapi.nuevos}`);
      console.log(`   - Actualizados: ${result.data.results.wooToStrapi.actualizados}`);
      console.log(`   - Omitidos: ${result.data.results.wooToStrapi.omitidos}`);
      console.log(`   - Errores: ${result.data.results.wooToStrapi.errores}\n`);
      
      console.log('📤 Strapi → WooCommerce:');
      console.log(`   - Nuevos: ${result.data.results.strapiToWoo.nuevos}`);
      console.log(`   - Actualizados: ${result.data.results.strapiToWoo.actualizados}`);
      console.log(`   - Omitidos: ${result.data.results.strapiToWoo.omitidos}`);
      console.log(`   - Errores: ${result.data.results.strapiToWoo.errores}\n`);
      
      console.log('📝 Revisa los logs de Strapi para más detalles.');
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

syncAll();




