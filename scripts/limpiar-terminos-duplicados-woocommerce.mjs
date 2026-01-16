#!/usr/bin/env node

/**
 * Script para identificar y limpiar términos duplicados en WooCommerce
 * 
 * Este script:
 * 1. Lista todos los atributos de producto en WooCommerce
 * 2. Para cada atributo, obtiene todos los términos
 * 3. Identifica términos duplicados (mismo nombre, case-insensitive)
 * 4. Muestra un reporte de duplicados
 * 5. Opcionalmente, elimina los duplicados manteniendo el primero encontrado
 * 
 * Uso:
 *   # Solo reportar duplicados (dry-run)
 *   node scripts/limpiar-terminos-duplicados-woocommerce.mjs --platform=woo_moraleja
 *   
 *   # Eliminar duplicados (requiere confirmación)
 *   node scripts/limpiar-terminos-duplicados-woocommerce.mjs --platform=woo_moraleja --delete
 *   
 *   # Procesar ambas plataformas
 *   node scripts/limpiar-terminos-duplicados-woocommerce.mjs --all --delete
 * 
 * Variables de entorno requeridas:
 *   WOO_MORALEJA_URL, WOO_MORALEJA_CONSUMER_KEY, WOO_MORALEJA_CONSUMER_SECRET
 *   WOO_ESCOLAR_URL, WOO_ESCOLAR_CONSUMER_KEY, WOO_ESCOLAR_CONSUMER_SECRET
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

const WOO_CONFIGS = {
  woo_moraleja: {
    url: process.env.WOO_MORALEJA_URL || '',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET || '',
  },
  woo_escolar: {
    url: process.env.WOO_ESCOLAR_URL || '',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET || '',
  },
};

function getWooAuth(config) {
  return Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
}

/**
 * Obtener todos los atributos de producto
 */
async function getAllAttributes(config) {
  const attributes = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const auth = getWooAuth(config);
      const response = await fetch(
        `${config.url}/wp-json/wc/v3/products/attributes?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`Error obteniendo atributos: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      attributes.push(...data);
      page++;

      if (data.length < perPage) {
        break;
      }
    }
  } catch (error) {
    console.error('Error obteniendo atributos:', error.message);
  }

  return attributes;
}

/**
 * Obtener todos los términos de un atributo
 */
async function getAllTerms(config, attributeId) {
  const terms = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const auth = getWooAuth(config);
      const response = await fetch(
        `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // El atributo no tiene términos o no existe
          break;
        }
        console.error(`Error obteniendo términos del atributo ${attributeId}: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      terms.push(...data);
      page++;

      if (data.length < perPage) {
        break;
      }
    }
  } catch (error) {
    console.error(`Error obteniendo términos del atributo ${attributeId}:`, error.message);
  }

  return terms;
}

/**
 * Identificar términos duplicados
 */
function findDuplicates(terms) {
  const duplicates = [];
  const seen = new Map(); // nombre normalizado -> primer término encontrado

  for (const term of terms) {
    const normalizedName = term.name.toLowerCase().trim();
    
    if (seen.has(normalizedName)) {
      // Es un duplicado
      const firstTerm = seen.get(normalizedName);
      duplicates.push({
        name: term.name,
        normalizedName,
        originalId: firstTerm.id,
        originalName: firstTerm.name,
        duplicateId: term.id,
        duplicateName: term.name,
      });
    } else {
      // Primera vez que vemos este nombre
      seen.set(normalizedName, term);
    }
  }

  return duplicates;
}

/**
 * Eliminar un término duplicado
 */
async function deleteTerm(config, attributeId, termId) {
  try {
    const auth = getWooAuth(config);
    const response = await fetch(
      `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms/${termId}?force=true`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error(`Error eliminando término ${termId}:`, error.message);
    return false;
  }
}

/**
 * Procesar una plataforma
 */
async function processPlatform(platform, deleteDuplicates = false) {
  const config = WOO_CONFIGS[platform];
  
  if (!config.url || !config.consumerKey || !config.consumerSecret) {
    console.error(`❌ Configuración incompleta para ${platform}`);
    return { attributes: 0, duplicates: 0, deleted: 0 };
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Procesando ${platform.toUpperCase()}`);
  console.log(`${'='.repeat(70)}\n`);

  // Obtener atributos
  console.log('🔍 Obteniendo atributos...');
  const attributes = await getAllAttributes(config);
  console.log(`✅ ${attributes.length} atributo(s) encontrado(s)\n`);

  let totalDuplicates = 0;
  let totalDeleted = 0;

  for (const attribute of attributes) {
    console.log(`\n📦 Atributo: "${attribute.name}" (ID: ${attribute.id})`);
    
    // Obtener términos
    const terms = await getAllTerms(config, attribute.id);
    console.log(`   ${terms.length} término(s)`);

    if (terms.length === 0) {
      continue;
    }

    // Identificar duplicados
    const duplicates = findDuplicates(terms);

    if (duplicates.length === 0) {
      console.log(`   ✅ Sin duplicados`);
      continue;
    }

    totalDuplicates += duplicates.length;
    console.log(`   ⚠️  ${duplicates.length} duplicado(s) encontrado(s):`);

    for (const dup of duplicates) {
      console.log(`      - "${dup.duplicateName}" (ID: ${dup.duplicateId}) es duplicado de "${dup.originalName}" (ID: ${dup.originalId})`);

      if (deleteDuplicates) {
        const deleted = await deleteTerm(config, attribute.id, dup.duplicateId);
        if (deleted) {
          console.log(`        ✅ Eliminado`);
          totalDeleted++;
        } else {
          console.log(`        ❌ Error al eliminar`);
        }
        // Pequeña pausa para no sobrecargar la API
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  return {
    attributes: attributes.length,
    duplicates: totalDuplicates,
    deleted: deleteDuplicates ? totalDeleted : 0,
  };
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const deleteDuplicates = args.includes('--delete');
  const allPlatforms = args.includes('--all');
  
  let platforms = [];
  if (allPlatforms) {
    platforms = ['woo_moraleja', 'woo_escolar'];
  } else {
    const platformArg = args.find(arg => arg.startsWith('--platform='));
    if (platformArg) {
      const platform = platformArg.split('=')[1];
      if (platform === 'woo_moraleja' || platform === 'woo_escolar') {
        platforms = [platform];
      } else {
        console.error('❌ Plataforma inválida. Use: woo_moraleja o woo_escolar');
        process.exit(1);
      }
    } else {
      console.error('❌ Debes especificar --platform=<platform> o --all');
      console.error('\nUso:');
      console.error('  node scripts/limpiar-terminos-duplicados-woocommerce.mjs --platform=woo_moraleja');
      console.error('  node scripts/limpiar-terminos-duplicados-woocommerce.mjs --platform=woo_moraleja --delete');
      console.error('  node scripts/limpiar-terminos-duplicados-woocommerce.mjs --all --delete');
      process.exit(1);
    }
  }

  console.log('🧹 LIMPIEZA DE TÉRMINOS DUPLICADOS EN WOOCOMMERCE');
  console.log('='.repeat(70));
  
  if (deleteDuplicates) {
    console.log('⚠️  MODO ELIMINACIÓN ACTIVADO - Los duplicados serán eliminados\n');
  } else {
    console.log('📊 MODO DRY-RUN - Solo reportar duplicados (no eliminar)\n');
    console.log('💡 Para eliminar duplicados, ejecuta con --delete\n');
  }

  const results = {};
  
  for (const platform of platforms) {
    const result = await processPlatform(platform, deleteDuplicates);
    results[platform] = result;
  }

  // Resumen final
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 RESUMEN');
  console.log(`${'='.repeat(70)}\n`);

  for (const [platform, result] of Object.entries(results)) {
    console.log(`${platform.toUpperCase()}:`);
    console.log(`   Atributos procesados: ${result.attributes}`);
    console.log(`   Duplicados encontrados: ${result.duplicates}`);
    if (deleteDuplicates) {
      console.log(`   Duplicados eliminados: ${result.deleted}`);
    }
    console.log('');
  }

  const totalDuplicates = Object.values(results).reduce((sum, r) => sum + r.duplicates, 0);
  const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);

  console.log('TOTALES:');
  console.log(`   Duplicados encontrados: ${totalDuplicates}`);
  if (deleteDuplicates) {
    console.log(`   Duplicados eliminados: ${totalDeleted}`);
    console.log('\n✅ Limpieza completada');
  } else {
    console.log('\n💡 Para eliminar estos duplicados, ejecuta el script con --delete');
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
