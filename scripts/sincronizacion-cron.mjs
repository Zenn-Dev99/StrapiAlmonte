/**
 * Script optimizado para ejecución automática cada 45 minutos
 * 
 * Optimizaciones:
 * - recentHours=1 (suficiente para capturar cambios en ventana de 45 minutos)
 * - Timeout de 5 minutos para evitar ejecuciones colgadas
 * - Logging optimizado
 * - Manejo de errores mejorado
 * 
 * Uso en Railway Cron:
 *   Cada 45 minutos: */45 * * * *
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const PLATFORM = process.env.PLATFORM || 'woo_moraleja';
const RECENT_HOURS = parseInt(process.env.RECENT_HOURS || '1'); // 1 hora es suficiente para 45 min

// Timeout de 5 minutos para evitar ejecuciones colgadas
const TIMEOUT_MS = 5 * 60 * 1000;

if (!STRAPI_API_TOKEN) {
  console.error('❌ Error: STRAPI_API_TOKEN no está configurado');
  process.exit(1);
}

async function syncAll() {
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] 🔄 Iniciando sincronización automática...`);
  console.log(`📍 Strapi URL: ${STRAPI_URL}`);
  console.log(`🌐 Plataforma: ${PLATFORM}`);
  console.log(`⏰ Ventana de tiempo: ${RECENT_HOURS} hora(s)`);

  try {
    const url = new URL(`/api/woo-webhook/sync-all/${PLATFORM}`, STRAPI_URL);
    url.searchParams.set('recentHours', RECENT_HOURS.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.success) {
      const summary = result.data.summary;
      const results = result.data.results;
      
      console.log(`✅ Sincronización completada en ${duration}s`);
      console.log(`📊 Total: ${summary.totalSincronizados} sincronizados, ${summary.totalOmitidos} omitidos, ${summary.totalErrores} errores`);
      console.log(`📥 Woo→Strapi: ${results.wooToStrapi.nuevos} nuevos, ${results.wooToStrapi.actualizados} actualizados`);
      console.log(`📤 Strapi→Woo: ${results.strapiToWoo.nuevos} nuevos, ${results.strapiToWoo.actualizados} actualizados`);
      
      // Exit code 0 = éxito
      process.exit(0);
    } else {
      console.error('❌ Error en la sincronización:', result.message || 'Error desconocido');
      process.exit(1);
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (error.name === 'AbortError') {
      console.error(`❌ Timeout después de ${duration}s (límite: ${TIMEOUT_MS/1000}s)`);
    } else {
      console.error(`❌ Error después de ${duration}s:`, error.message);
    }
    
    process.exit(1);
  }
}

// Ejecutar sincronización
syncAll();




