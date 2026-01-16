/**
 * Script de diagnóstico para comparar canales Moraleja vs Escolar
 * 
 * Verifica:
 * 1. Variables de entorno configuradas
 * 2. Conectividad con ambas plataformas WooCommerce
 * 3. Permisos de API
 * 
 * Uso:
 *   node strapi/scripts/test-sync-canales.mjs
 */

import dotenv from 'dotenv';
dotenv.config();

async function testSyncCanales() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO: Canales Moraleja vs Escolar');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  let moralejaOk = true;
  let escolarOk = true;
  
  // 1. Verificar variables de entorno
  console.log('1️⃣  VARIABLES DE ENTORNO');
  console.log('─'.repeat(55));
  console.log('');
  
  console.log('📦 WooCommerce Moraleja:');
  const moralejaUrl = process.env.WOO_MORALEJA_URL;
  const moralejaKey = process.env.WOO_MORALEJA_CONSUMER_KEY;
  const moralejaSecret = process.env.WOO_MORALEJA_CONSUMER_SECRET;
  
  if (moralejaUrl) {
    console.log(`   ✅ WOO_MORALEJA_URL: ${moralejaUrl}`);
  } else {
    console.log('   ❌ WOO_MORALEJA_URL: NO CONFIGURADA');
    moralejaOk = false;
  }
  
  if (moralejaKey) {
    console.log(`   ✅ WOO_MORALEJA_CONSUMER_KEY: ${moralejaKey.substring(0, 10)}...`);
  } else {
    console.log('   ❌ WOO_MORALEJA_CONSUMER_KEY: NO CONFIGURADA');
    moralejaOk = false;
  }
  
  if (moralejaSecret) {
    console.log(`   ✅ WOO_MORALEJA_CONSUMER_SECRET: ${moralejaSecret.substring(0, 10)}...`);
  } else {
    console.log('   ❌ WOO_MORALEJA_CONSUMER_SECRET: NO CONFIGURADA');
    moralejaOk = false;
  }
  
  console.log('');
  console.log('📦 WooCommerce Escolar:');
  const escolarUrl = process.env.WOO_ESCOLAR_URL;
  const escolarKey = process.env.WOO_ESCOLAR_CONSUMER_KEY;
  const escolarSecret = process.env.WOO_ESCOLAR_CONSUMER_SECRET;
  
  if (escolarUrl) {
    console.log(`   ✅ WOO_ESCOLAR_URL: ${escolarUrl}`);
  } else {
    console.log('   ❌ WOO_ESCOLAR_URL: NO CONFIGURADA');
    escolarOk = false;
  }
  
  if (escolarKey) {
    console.log(`   ✅ WOO_ESCOLAR_CONSUMER_KEY: ${escolarKey.substring(0, 10)}...`);
  } else {
    console.log('   ❌ WOO_ESCOLAR_CONSUMER_KEY: NO CONFIGURADA');
    escolarOk = false;
  }
  
  if (escolarSecret) {
    console.log(`   ✅ WOO_ESCOLAR_CONSUMER_SECRET: ${escolarSecret.substring(0, 10)}...`);
  } else {
    console.log('   ❌ WOO_ESCOLAR_CONSUMER_SECRET: NO CONFIGURADA');
    escolarOk = false;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 2. Probar conexión a WooCommerce Moraleja
  console.log('2️⃣  CONECTIVIDAD WOO COMMERCE MORALEJA');
  console.log('─'.repeat(55));
  console.log('');
  
  if (!moralejaOk) {
    console.log('   ⏭️  Omitido: variables de entorno no configuradas');
  } else {
    try {
      const url = `${moralejaUrl}/wp-json/wc/v3/system_status`;
      const auth = Buffer.from(`${moralejaKey}:${moralejaSecret}`).toString('base64');
      
      console.log(`   📡 Probando: ${url}`);
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Conexión exitosa a WooCommerce Moraleja');
        console.log(`   📊 Versión WooCommerce: ${data.environment?.version || 'N/A'}`);
        console.log(`   📊 Versión WordPress: ${data.environment?.wp_version || 'N/A'}`);
      } else {
        console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.log(`   📄 Respuesta: ${text.substring(0, 200)}`);
        moralejaOk = false;
      }
    } catch (error) {
      console.log('   ❌ Error de conexión:', error.message);
      moralejaOk = false;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 3. Probar conexión a WooCommerce Escolar
  console.log('3️⃣  CONECTIVIDAD WOOCOMMERCE ESCOLAR');
  console.log('─'.repeat(55));
  console.log('');
  
  if (!escolarOk) {
    console.log('   ⏭️  Omitido: variables de entorno no configuradas');
  } else {
    try {
      const url = `${escolarUrl}/wp-json/wc/v3/system_status`;
      const auth = Buffer.from(`${escolarKey}:${escolarSecret}`).toString('base64');
      
      console.log(`   📡 Probando: ${url}`);
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Conexión exitosa a WooCommerce Escolar');
        console.log(`   📊 Versión WooCommerce: ${data.environment?.version || 'N/A'}`);
        console.log(`   📊 Versión WordPress: ${data.environment?.wp_version || 'N/A'}`);
      } else {
        console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.log(`   📄 Respuesta: ${text.substring(0, 200)}`);
        escolarOk = false;
      }
    } catch (error) {
      console.log('   ❌ Error de conexión:', error.message);
      escolarOk = false;
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 4. Probar permisos de API (leer productos)
  console.log('4️⃣  PERMISOS DE API (LECTURA)');
  console.log('─'.repeat(55));
  console.log('');
  
  console.log('📦 WooCommerce Moraleja:');
  if (!moralejaOk) {
    console.log('   ⏭️  Omitido: problemas de configuración/conectividad');
  } else {
    try {
      const url = `${moralejaUrl}/wp-json/wc/v3/products?per_page=1`;
      const auth = Buffer.from(`${moralejaKey}:${moralejaSecret}`).toString('base64');
      
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` }
      });
      
      if (response.ok) {
        const products = await response.json();
        console.log(`   ✅ Lectura OK - ${products.length} producto(s) encontrado(s)`);
      } else {
        console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
        if (response.status === 401 || response.status === 403) {
          console.log('   ⚠️  Problema de autenticación - verifica las credenciales');
        }
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }
  }
  
  console.log('');
  console.log('📦 WooCommerce Escolar:');
  if (!escolarOk) {
    console.log('   ⏭️  Omitido: problemas de configuración/conectividad');
  } else {
    try {
      const url = `${escolarUrl}/wp-json/wc/v3/products?per_page=1`;
      const auth = Buffer.from(`${escolarKey}:${escolarSecret}`).toString('base64');
      
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` }
      });
      
      if (response.ok) {
        const products = await response.json();
        console.log(`   ✅ Lectura OK - ${products.length} producto(s) encontrado(s)`);
      } else {
        console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
        if (response.status === 401 || response.status === 403) {
          console.log('   ⚠️  Problema de autenticación - verifica las credenciales');
        }
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Resumen
  console.log('📋 RESUMEN');
  console.log('─'.repeat(55));
  console.log('');
  
  if (moralejaOk) {
    console.log('✅ WooCommerce Moraleja: FUNCIONANDO');
  } else {
    console.log('❌ WooCommerce Moraleja: CON PROBLEMAS');
    console.log('   Revisa:');
    console.log('   - Variables de entorno en Railway');
    console.log('   - Credenciales API en WooCommerce');
    console.log('   - Permisos de las credenciales (Read/Write)');
  }
  
  console.log('');
  
  if (escolarOk) {
    console.log('✅ WooCommerce Escolar: FUNCIONANDO');
  } else {
    console.log('❌ WooCommerce Escolar: CON PROBLEMAS');
    console.log('   Revisa:');
    console.log('   - Variables de entorno en Railway');
    console.log('   - Credenciales API en WooCommerce');
    console.log('   - Permisos de las credenciales (Read/Write)');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Conclusión
  if (moralejaOk && escolarOk) {
    console.log('🎉 AMBAS PLATAFORMAS ESTÁN FUNCIONANDO CORRECTAMENTE');
    console.log('');
    console.log('Si los productos no se sincronizan a Moraleja, verifica:');
    console.log('1. El libro tiene el canal "moraleja" asignado');
    console.log('2. El canal tiene key="moraleja" (minúsculas, sin prefijo)');
    console.log('3. El estado de publicación es "Publicado"');
  } else if (!moralejaOk && escolarOk) {
    console.log('⚠️  PROBLEMA CONFIRMADO: WooCommerce Moraleja no funciona');
    console.log('');
    console.log('Esto explica por qué los productos solo se sincronizan a Escolar.');
    console.log('');
    console.log('🔧 SOLUCIÓN:');
    console.log('1. Ve a Railway → Variables');
    console.log('2. Verifica/actualiza las variables de WooCommerce Moraleja');
    console.log('3. Ve a WooCommerce Moraleja → Settings → REST API');
    console.log('4. Genera nuevas credenciales con permisos Read/Write');
    console.log('5. Actualiza las variables de entorno');
    console.log('6. Reinicia el servicio de Strapi');
  } else {
    console.log('❌ PROBLEMA CON AMBAS PLATAFORMAS');
    console.log('');
    console.log('Revisa la configuración de variables de entorno en Railway.');
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
}

testSyncCanales().catch(console.error);

