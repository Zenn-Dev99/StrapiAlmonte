#!/usr/bin/env node

/**
 * Script de diagnóstico para problemas con update-core.php en WordPress
 * Verifica conectividad, configuración y posibles causas del problema
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (err) {
  // .env no existe o no se puede leer
}

const WORDPRESS_URL = process.env.WOO_MORALEJA_URL || 'https://staging.moraleja.cl';
const WOO_KEY = process.env.WOO_MORALEJA_CONSUMER_KEY;
const WOO_SECRET = process.env.WOO_MORALEJA_CONSUMER_SECRET;

console.log('🔍 Diagnóstico de update-core.php en WordPress\n');
console.log(`📍 URL: ${WORDPRESS_URL}\n`);
console.log('═'.repeat(60) + '\n');

const resultados = {
  conectividadWordPress: null,
  conectividadAPI: null,
  apiWordPressOrg: null,
  updateCorePage: null,
  problemas: [],
  soluciones: []
};

// 1. Verificar conectividad básica con WordPress
async function verificarConectividadWordPress() {
  console.log('1️⃣ Verificando conectividad básica con WordPress...');
  try {
    const response = await fetch(`${WORDPRESS_URL}/`, {
      method: 'GET',
      redirect: 'follow',
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('   ✅ WordPress responde correctamente\n');
      resultados.conectividadWordPress = true;
    } else {
      console.log(`   ⚠️  WordPress responde con código: ${response.status}\n`);
      resultados.conectividadWordPress = false;
      resultados.problemas.push(`WordPress responde con código HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}\n`);
    resultados.conectividadWordPress = false;
    resultados.problemas.push(`No se puede conectar a WordPress: ${error.message}`);
    resultados.soluciones.push('Verificar que el servidor esté en línea y accesible');
  }
}

// 2. Verificar API REST de WordPress
async function verificarAPIRest() {
  console.log('2️⃣ Verificando API REST de WordPress...');
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/`, {
      method: 'GET',
      redirect: 'follow',
      timeout: 10000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API REST funciona correctamente');
      console.log(`   📋 Versión WordPress: ${data.version || 'No disponible'}\n`);
      resultados.conectividadAPI = true;
    } else {
      console.log(`   ⚠️  API REST responde con código: ${response.status}\n`);
      resultados.conectividadAPI = false;
      resultados.problemas.push(`API REST responde con código HTTP ${response.status}`);
      resultados.soluciones.push('Verificar que la API REST de WordPress esté habilitada');
    }
  } catch (error) {
    console.log(`   ❌ Error accediendo a API REST: ${error.message}\n`);
    resultados.conectividadAPI = false;
    resultados.problemas.push(`Error en API REST: ${error.message}`);
  }
}

// 3. Verificar conectividad con api.wordpress.org (crítico para update-core.php)
async function verificarAPIWordPressOrg() {
  console.log('3️⃣ Verificando conectividad con api.wordpress.org...');
  console.log('   (Esta es la causa más común del problema)\n');
  
  try {
    const response = await fetch('https://api.wordpress.org/core/version-check/1.7/', {
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'WordPress/Diagnostic'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Conexión con api.wordpress.org exitosa');
      console.log(`   📦 Última versión disponible: ${data.offers?.[0]?.version || 'No disponible'}\n`);
      resultados.apiWordPressOrg = true;
    } else {
      console.log(`   ⚠️  api.wordpress.org responde con código: ${response.status}\n`);
      resultados.apiWordPressOrg = false;
      resultados.problemas.push(`No se puede conectar a api.wordpress.org (HTTP ${response.status})`);
      resultados.soluciones.push('🔴 CRÍTICO: El servidor no puede conectarse a api.wordpress.org');
      resultados.soluciones.push('   - Verificar firewall del servidor');
      resultados.soluciones.push('   - Verificar configuración de proxy');
      resultados.soluciones.push('   - Verificar DNS del servidor');
    }
  } catch (error) {
    console.log(`   ❌ Error conectando a api.wordpress.org: ${error.message}\n`);
    resultados.apiWordPressOrg = false;
    resultados.problemas.push(`No se puede conectar a api.wordpress.org: ${error.message}`);
    resultados.soluciones.push('🔴 CRÍTICO: El servidor no puede conectarse a api.wordpress.org');
    resultados.soluciones.push('   - Verificar firewall del servidor');
    resultados.soluciones.push('   - Verificar configuración de proxy');
    resultados.soluciones.push('   - Verificar DNS del servidor');
    resultados.soluciones.push('   - Verificar que el servidor tenga salida a internet');
  }
}

// 4. Intentar acceder a update-core.php (simulando navegador)
async function verificarUpdateCorePage() {
  console.log('4️⃣ Verificando acceso a update-core.php...');
  console.log('   (Nota: Requiere autenticación, solo verificamos si la página existe)\n');
  
  try {
    const response = await fetch(`${WORDPRESS_URL}/wp-admin/update-core.php`, {
      method: 'GET',
      redirect: 'follow',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    
    if (status === 200) {
      const text = await response.text();
      if (text.includes('update-core') || text.includes('WordPress Updates')) {
        console.log('   ✅ La página update-core.php existe y responde');
        console.log('   ℹ️  (Puede requerir autenticación para funcionar completamente)\n');
        resultados.updateCorePage = true;
      } else if (text.includes('login') || text.includes('redirect')) {
        console.log('   ⚠️  La página redirige a login (normal si no estás autenticado)');
        console.log('   ℹ️  Esto indica que la página existe pero requiere autenticación\n');
        resultados.updateCorePage = true;
      } else {
        console.log('   ⚠️  La página responde pero el contenido es inesperado');
        console.log(`   📄 Content-Type: ${contentType}\n`);
        resultados.updateCorePage = false;
        resultados.problemas.push('La página update-core.php no muestra el contenido esperado');
      }
    } else if (status === 302 || status === 301) {
      console.log('   ⚠️  La página redirige (posiblemente a login)');
      console.log('   ℹ️  Esto es normal si no estás autenticado\n');
      resultados.updateCorePage = true;
    } else if (status === 403) {
      console.log('   ❌ Error 403: Acceso prohibido');
      console.log('   💡 Posibles causas:');
      console.log('      - Plugin de seguridad bloqueando el acceso');
      console.log('      - Reglas en .htaccess');
      console.log('      - Permisos de archivos incorrectos\n');
      resultados.updateCorePage = false;
      resultados.problemas.push('Error 403 al acceder a update-core.php');
      resultados.soluciones.push('Verificar plugins de seguridad (Wordfence, iThemes Security, etc.)');
      resultados.soluciones.push('Revisar archivo .htaccess por reglas restrictivas');
      resultados.soluciones.push('Verificar permisos de archivos (644 para archivos, 755 para directorios)');
    } else if (status === 404) {
      console.log('   ❌ Error 404: Página no encontrada');
      console.log('   💡 Posible causa: Archivos de WordPress corruptos o faltantes\n');
      resultados.updateCorePage = false;
      resultados.problemas.push('Error 404 al acceder a update-core.php');
      resultados.soluciones.push('Verificar que los archivos de WordPress estén completos');
      resultados.soluciones.push('Considerar reemplazar archivos del core de WordPress');
    } else if (status === 500) {
      console.log('   ❌ Error 500: Error interno del servidor');
      console.log('   💡 Posible causa: Error PHP fatal o problema de configuración\n');
      resultados.updateCorePage = false;
      resultados.problemas.push('Error 500 al acceder a update-core.php');
      resultados.soluciones.push('Habilitar WP_DEBUG en wp-config.php para ver el error');
      resultados.soluciones.push('Revisar logs de PHP del servidor');
      resultados.soluciones.push('Verificar plugins conflictivos');
    } else {
      console.log(`   ⚠️  Código HTTP inesperado: ${status}\n`);
      resultados.updateCorePage = false;
      resultados.problemas.push(`Código HTTP ${status} al acceder a update-core.php`);
    }
  } catch (error) {
    console.log(`   ❌ Error accediendo a update-core.php: ${error.message}\n`);
    resultados.updateCorePage = false;
    resultados.problemas.push(`Error al acceder a update-core.php: ${error.message}`);
  }
}

// 5. Verificar si WooCommerce API funciona (para contexto)
async function verificarWooCommerceAPI() {
  if (!WOO_KEY || !WOO_SECRET) {
    console.log('5️⃣ Verificando WooCommerce API...');
    console.log('   ⚠️  Credenciales no configuradas, omitiendo verificación\n');
    return;
  }
  
  console.log('5️⃣ Verificando WooCommerce API...');
  try {
    const auth = Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64');
    const response = await fetch(`${WORDPRESS_URL}/wp-json/wc/v3/system_status`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('   ✅ WooCommerce API funciona correctamente\n');
    } else {
      console.log(`   ⚠️  WooCommerce API responde con código: ${response.status}\n`);
    }
  } catch (error) {
    console.log(`   ⚠️  Error en WooCommerce API: ${error.message}\n`);
  }
}

// Ejecutar todas las verificaciones
async function ejecutarDiagnostico() {
  await verificarConectividadWordPress();
  await verificarAPIRest();
  await verificarAPIWordPressOrg();
  await verificarUpdateCorePage();
  await verificarWooCommerceAPI();
  
  // Resumen
  console.log('═'.repeat(60));
  console.log('📊 RESUMEN DEL DIAGNÓSTICO\n');
  
  console.log('Estado de las verificaciones:');
  console.log(`  ${resultados.conectividadWordPress ? '✅' : '❌'} Conectividad WordPress`);
  console.log(`  ${resultados.conectividadAPI ? '✅' : '❌'} API REST de WordPress`);
  console.log(`  ${resultados.apiWordPressOrg ? '✅' : '❌'} Conexión con api.wordpress.org`);
  console.log(`  ${resultados.updateCorePage ? '✅' : '❌'} Página update-core.php\n`);
  
  if (resultados.problemas.length > 0) {
    console.log('🚨 PROBLEMAS DETECTADOS:\n');
    resultados.problemas.forEach((problema, index) => {
      console.log(`   ${index + 1}. ${problema}`);
    });
    console.log('');
  }
  
  if (resultados.soluciones.length > 0) {
    console.log('💡 SOLUCIONES RECOMENDADAS:\n');
    resultados.soluciones.forEach((solucion, index) => {
      console.log(`   ${index + 1}. ${solucion}`);
    });
    console.log('');
  }
  
  // Diagnóstico final
  if (!resultados.apiWordPressOrg) {
    console.log('🔴 DIAGNÓSTICO PRINCIPAL:');
    console.log('   El problema más probable es que el servidor NO puede conectarse');
    console.log('   a api.wordpress.org. Esta es la causa más común de que');
    console.log('   update-core.php no cargue correctamente.\n');
    console.log('   SOLUCIÓN PRIORITARIA:');
    console.log('   1. Verificar firewall del servidor/hosting');
    console.log('   2. Verificar configuración de proxy (si aplica)');
    console.log('   3. Verificar DNS del servidor');
    console.log('   4. Contactar al proveedor de hosting si es necesario\n');
  } else if (!resultados.updateCorePage) {
    console.log('🔴 DIAGNÓSTICO PRINCIPAL:');
    console.log('   La página update-core.php existe pero hay un problema');
    console.log('   al acceder a ella. Revisa los problemas detectados arriba.\n');
  } else if (resultados.problemas.length === 0) {
    console.log('✅ No se detectaron problemas obvios.');
    console.log('   Si update-core.php aún no carga, puede ser:');
    console.log('   - Un problema de plugins (desactiva plugins de seguridad)');
    console.log('   - Un problema de memoria PHP (aumenta memory_limit)');
    console.log('   - Un timeout (aumenta max_execution_time)\n');
  }
  
  console.log('═'.repeat(60));
}

ejecutarDiagnostico().catch(error => {
  console.error('❌ Error ejecutando diagnóstico:', error);
  process.exit(1);
});









