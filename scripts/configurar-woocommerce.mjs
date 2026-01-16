#!/usr/bin/env node

/**
 * Script para configurar y verificar la conexión con WooCommerce
 * Soporta ambas tiendas: Moraleja y Librería Escolar
 * 
 * Uso:
 *   node scripts/configurar-woocommerce.mjs
 *   node scripts/configurar-woocommerce.mjs --test moraleja
 *   node scripts/configurar-woocommerce.mjs --test escolar
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
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
}

// Configuraciones de las tiendas
const STORES = {
  moraleja: {
    name: 'Moraleja',
    url: process.env.WOO_MORALEJA_URL || 'https://moraleja.cl',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
    envVars: {
      url: 'WOO_MORALEJA_URL',
      key: 'WOO_MORALEJA_CONSUMER_KEY',
      secret: 'WOO_MORALEJA_CONSUMER_SECRET',
    },
  },
  escolar: {
    name: 'Librería Escolar',
    url: process.env.WOO_ESCOLAR_URL || 'https://libreriaescolar.cl',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
    envVars: {
      url: 'WOO_ESCOLAR_URL',
      key: 'WOO_ESCOLAR_CONSUMER_KEY',
      secret: 'WOO_ESCOLAR_CONSUMER_SECRET',
    },
  },
};

/**
 * Verifica la conexión con una tienda WooCommerce
 */
async function testConnection(storeKey) {
  const store = STORES[storeKey];
  if (!store) {
    console.error(`❌ Tienda desconocida: ${storeKey}`);
    return false;
  }

  console.log(`\n🔍 Verificando conexión con ${store.name}...`);
  console.log(`   URL: ${store.url}`);

  // Verificar que las credenciales estén configuradas
  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`\n❌ Credenciales no configuradas para ${store.name}`);
    console.error(`   Configura estas variables de entorno:`);
    console.error(`   - ${store.envVars.url}`);
    console.error(`   - ${store.envVars.key}`);
    console.error(`   - ${store.envVars.secret}`);
    return false;
  }

  console.log(`   Consumer Key: ${store.consumerKey.substring(0, 10)}...`);
  console.log(`   Consumer Secret: ${store.consumerSecret.substring(0, 10)}...`);

  try {
    // Construir URL de la API
    const apiUrl = `${store.url.replace(/\/$/, '')}/wp-json/wc/v3/products?per_page=1`;
    
    // Autenticación Basic Auth
    const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
    
    console.log(`\n📡 Conectando a: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      redirect: 'follow', // Seguir redirects
    });

    // Verificar el content-type de la respuesta
    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ Error de conexión: HTTP ${response.status}`);
      console.error(`   Content-Type: ${contentType}`);
      console.error(`   Respuesta: ${errorText.substring(0, 300)}`);
      
      if (response.status === 401) {
        console.error(`\n💡 Posibles causas:`);
        console.error(`   - Consumer Key o Consumer Secret incorrectos`);
        console.error(`   - El usuario de WooCommerce no tiene permisos Read/Write`);
        console.error(`   - La URL de WooCommerce es incorrecta`);
      } else if (response.status === 404) {
        console.error(`\n💡 Posibles causas:`);
        console.error(`   - La URL no es correcta (debe ser la URL base, sin /wp-json/wc/v3)`);
        console.error(`   - WooCommerce REST API no está habilitada`);
      }
      
      return false;
    }

    // Verificar que la respuesta sea JSON
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`\n❌ La respuesta no es JSON`);
      console.error(`   Content-Type recibido: ${contentType}`);
      console.error(`   Respuesta (primeros 500 chars): ${text.substring(0, 500)}`);
      console.error(`\n💡 Posibles causas:`);
      console.error(`   - La REST API de WooCommerce no está habilitada`);
      console.error(`   - Hay un problema con la configuración de WordPress`);
      console.error(`   - La URL podría estar incorrecta`);
      return false;
    }

    const data = await response.json();
    console.log(`\n✅ Conexión exitosa con ${store.name}!`);
    console.log(`   Productos encontrados: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    // Verificar permisos de escritura
    console.log(`\n🔐 Verificando permisos de escritura...`);
    const testProduct = {
      name: 'Test Product Strapi Sync',
      type: 'simple',
      sku: `TEST-STRAPI-${Date.now()}`,
      status: 'draft',
    };

    const createResponse = await fetch(`${store.url.replace(/\/$/, '')}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(testProduct),
    });

    if (createResponse.ok) {
      const created = await createResponse.json();
      console.log(`   ✅ Permisos de escritura OK`);
      
      // Eliminar producto de prueba
      await fetch(`${store.url.replace(/\/$/, '')}/wp-json/wc/v3/products/${created.id}?force=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });
      console.log(`   🗑️  Producto de prueba eliminado`);
    } else {
      console.error(`   ⚠️  Permisos de escritura limitados (HTTP ${createResponse.status})`);
      console.error(`   💡 Asegúrate de que el token tenga permisos Read/Write`);
    }

    return true;
  } catch (error) {
    console.error(`\n❌ Error de conexión:`, error.message);
    console.error(`\n💡 Verifica:`);
    console.error(`   - Que la URL sea correcta`);
    console.error(`   - Que WooCommerce esté instalado y activo`);
    console.error(`   - Que la REST API esté habilitada`);
    return false;
  }
}

/**
 * Muestra el estado de configuración
 */
function showConfig() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Configuración WooCommerce - Strapi                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  for (const [key, store] of Object.entries(STORES)) {
    console.log(`📦 ${store.name}`);
    console.log(`   URL: ${store.url || '❌ No configurada'}`);
    console.log(`   Consumer Key: ${store.consumerKey ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   Consumer Secret: ${store.consumerSecret ? '✅ Configurada' : '❌ No configurada'}`);
    console.log('');
  }
}

/**
 * Muestra instrucciones para obtener credenciales
 */
function showInstructions() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Cómo obtener credenciales de WooCommerce          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Para cada tienda (Moraleja y Librería Escolar):');
  console.log('');
  console.log('1. Accede al panel de administración de WordPress/WooCommerce');
  console.log('2. Ve a: WooCommerce → Settings → Advanced → REST API');
  console.log('3. Haz clic en "Add key"');
  console.log('4. Configura:');
  console.log('   - Description: "Strapi Sync"');
  console.log('   - User: Selecciona un usuario administrador');
  console.log('   - Permissions: "Read/Write"');
  console.log('5. Haz clic en "Generate API key"');
  console.log('6. Copia el Consumer Key y Consumer Secret');
  console.log('');
  console.log('Luego agrega estas variables a tu archivo .env:');
  console.log('');
  console.log('# WooCommerce Moraleja');
  console.log('WOO_MORALEJA_URL=https://moraleja.cl');
  console.log('WOO_MORALEJA_CONSUMER_KEY=ck_xxxxx');
  console.log('WOO_MORALEJA_CONSUMER_SECRET=cs_xxxxx');
  console.log('');
  console.log('# WooCommerce Librería Escolar');
  console.log('WOO_ESCOLAR_URL=https://libreriaescolar.cl');
  console.log('WOO_ESCOLAR_CONSUMER_KEY=ck_xxxxx');
  console.log('WOO_ESCOLAR_CONSUMER_SECRET=cs_xxxxx');
  console.log('');
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const testStore = args.find(arg => arg === '--test') ? args[args.indexOf('--test') + 1] : null;
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log('Uso:');
    console.log('  node scripts/configurar-woocommerce.mjs              # Ver configuración');
    console.log('  node scripts/configurar-woocommerce.mjs --test <store>  # Probar conexión');
    console.log('  node scripts/configurar-woocommerce.mjs --instructions  # Ver instrucciones');
    console.log('');
    console.log('Stores disponibles: moraleja, escolar');
    return;
  }

  if (args.includes('--instructions')) {
    showInstructions();
    return;
  }

  showConfig();

  if (testStore) {
    if (!STORES[testStore]) {
      console.error(`❌ Tienda desconocida: ${testStore}`);
      console.error(`   Tiendas disponibles: ${Object.keys(STORES).join(', ')}`);
      return;
    }
    await testConnection(testStore);
  } else {
    console.log('💡 Para probar la conexión, ejecuta:');
    console.log('   node scripts/configurar-woocommerce.mjs --test moraleja');
    console.log('   node scripts/configurar-woocommerce.mjs --test escolar');
    console.log('');
    console.log('💡 Para ver instrucciones:');
    console.log('   node scripts/configurar-woocommerce.mjs --instructions');
  }
}

main().catch(console.error);

