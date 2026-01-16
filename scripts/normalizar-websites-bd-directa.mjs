#!/usr/bin/env node

/**
 * Script para normalizar websites directamente en la base de datos
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Normalizar URL: quitar protocolos y www
function normalizarWebsite(url) {
  if (!url || !url.trim()) {
    return null;
  }

  let normalized = url.trim();

  // Quitar protocolos
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Quitar www.
  normalized = normalized.replace(/^www\./i, '');
  
  // Quitar barra final
  normalized = normalized.replace(/\/+$/, '');
  
  // Quitar espacios
  normalized = normalized.trim();

  // Si quedó vacío, retornar null
  if (!normalized) {
    return null;
  }

  return normalized;
}

async function main() {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { resolve } = await import('path');
    
    const strapiNodeModules = resolve(__dirname, '..', 'strapi', 'node_modules');
    const Database = require(resolve(strapiNodeModules, 'better-sqlite3'));
    
    const dbPath = resolve(__dirname, '..', 'strapi', '.tmp', 'data.db');
    const db = new Database(dbPath);
    
    console.log('🔄 Normalizando websites directamente en la base de datos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Obtener todas las editoriales
    const editoriales = db.prepare('SELECT document_id, website, nombre_editorial FROM editoriales').all();
    console.log(`📊 Encontradas ${editoriales.length} editoriales\n`);
    
    let actualizadas = 0;
    let sinCambios = 0;
    
    // 2. Procesar cada editorial
    const updateStmt = db.prepare('UPDATE editoriales SET website = ? WHERE document_id = ?');
    
    for (const editorial of editoriales) {
      const websiteActual = editorial.website;
      const websiteNormalizado = normalizarWebsite(websiteActual);
      const nombre = editorial.nombre_editorial || 'Sin nombre';
      
      // Si no hay cambios, saltar
      if (websiteNormalizado === websiteActual) {
        sinCambios++;
        continue;
      }
      
      // Si ambos son null/vacío, saltar
      if (!websiteNormalizado && !websiteActual) {
        sinCambios++;
        continue;
      }
      
      // Actualizar
      updateStmt.run(websiteNormalizado, editorial.document_id);
      actualizadas++;
      
      if (actualizadas <= 20) {
        const cambio = websiteActual 
          ? `"${websiteActual.substring(0, 50)}${websiteActual.length > 50 ? '...' : ''}" → "${websiteNormalizado || '(vacío)'}"`
          : `(vacío) → "${websiteNormalizado}"`;
        console.log(`[${actualizadas}] ${nombre.substring(0, 40)}... ✅ ${cambio}`);
      }
    }
    
    db.close();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   📦 Total procesadas: ${editoriales.length}`);
    console.log(`   ✅ Actualizadas: ${actualizadas}`);
    console.log(`   ⏭️  Sin cambios: ${sinCambios}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Normalización completada. Los cambios están guardados en la base de datos.');
    console.log('💡 Recarga la página de Strapi para ver los cambios.\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

