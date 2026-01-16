#!/usr/bin/env node

/**
 * Script para sincronizar todos los autores y editoriales existentes a WooCommerce
 * 
 * Uso:
 *   node scripts/sincronizar-autores-editoriales-woo.mjs [platform]
 * 
 * platform: 'woo_moraleja' o 'woo_escolar' (opcional, por defecto sincroniza ambos)
 */

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
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

const STRAPI_URL = process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  console.error('   Configura en .env o exporta la variable');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

const platform = process.argv[2]; // 'woo_moraleja' o 'woo_escolar'
const platforms = platform 
  ? [platform] 
  : ['woo_moraleja', 'woo_escolar'];

async function syncAttribute(type, platform) {
  const endpoint = type === 'autor' ? 'woo-autor' : 'woo-editorial';
  const url = `${STRAPI_URL}/api/${endpoint}/sync-attribute?platform=${platform}`;
  
  console.log(`\n📋 Creando/verificando atributo "${type === 'autor' ? 'Autor' : 'Editorial'}" en ${platform}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`   ✅ Atributo creado/verificado (ID: ${result.attributeId})`);
    return result.attributeId;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    throw error;
  }
}

async function syncAll(type, platform) {
  const endpoint = type === 'autor' ? 'woo-autor' : 'woo-editorial';
  const url = `${STRAPI_URL}/api/${endpoint}/sync-all?platform=${platform}`;
  
  console.log(`\n📦 Sincronizando todos los ${type === 'autor' ? 'autores' : 'editoriales'} a ${platform}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`   ✅ Sincronizados: ${result.successCount}/${result.total}`);
    if (result.errorCount > 0) {
      console.log(`   ⚠️  Errores: ${result.errorCount}`);
    }
    return result;
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Sincronización de Autores y Editoriales a WooCommerce');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log(`Platforms: ${platforms.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const platform of platforms) {
    console.log(`\n\n📌 Procesando ${platform}...`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 1. Crear atributos
      await syncAttribute('autor', platform);
      await syncAttribute('editorial', platform);

      // 2. Sincronizar todos los autores
      await syncAll('autor', platform);

      // 3. Sincronizar todas las editoriales
      await syncAll('editorial', platform);

      console.log(`\n✅ ${platform} completado`);
    } catch (error) {
      console.error(`\n❌ Error en ${platform}:`, error.message);
    }
  }

  console.log('\n\n🎉 Sincronización completada!');
  console.log('\n💡 Próximos pasos:');
  console.log('   - Los libros sincronizados incluirán automáticamente autor y editorial');
  console.log('   - Puedes verificar en WooCommerce: Productos → Atributos');
}

main().catch(console.error);

