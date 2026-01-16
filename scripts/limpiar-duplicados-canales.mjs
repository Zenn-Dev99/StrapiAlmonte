#!/usr/bin/env node

/**
 * Script para limpiar registros duplicados en libros_canales_lnk
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { resolve } = await import('path');
    
    const strapiNodeModules = resolve(__dirname, '..', 'strapi', 'node_modules');
    const Database = require(resolve(strapiNodeModules, 'better-sqlite3'));
    
    const dbPath = resolve(__dirname, '..', 'strapi', '.tmp', 'data.db');
    const db = new Database(dbPath);
    
    console.log('🔄 Limpiando duplicados en libros_canales_lnk');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Contar duplicados
    const duplicados = db.prepare(`
      SELECT libro_id, canal_id, COUNT(*) as cantidad
      FROM libros_canales_lnk
      GROUP BY libro_id, canal_id
      HAVING COUNT(*) > 1
    `).all();
    
    console.log(`📊 Registros duplicados encontrados: ${duplicados.length}\n`);
    
    if (duplicados.length === 0) {
      console.log('✅ No hay duplicados. Todo está correcto.\n');
      db.close();
      return;
    }
    
    // 2. Eliminar duplicados, manteniendo solo uno
    console.log('🔄 Eliminando duplicados...');
    let eliminados = 0;
    
    for (const dup of duplicados) {
      // Obtener todos los IDs de los registros duplicados
      const registros = db.prepare(`
        SELECT id
        FROM libros_canales_lnk
        WHERE libro_id = ? AND canal_id = ?
        ORDER BY id
      `).all(dup.libro_id, dup.canal_id);
      
      // Mantener el primero, eliminar el resto
      if (registros.length > 1) {
        const idsAEliminar = registros.slice(1).map(r => r.id);
        
        for (const id of idsAEliminar) {
          db.prepare('DELETE FROM libros_canales_lnk WHERE id = ?').run(id);
          eliminados++;
        }
      }
    }
    
    console.log(`   ✅ ${eliminados} registros duplicados eliminados\n`);
    
    // 3. Verificar resultado
    const duplicadosRestantes = db.prepare(`
      SELECT COUNT(*) as total
      FROM (
        SELECT libro_id, canal_id
        FROM libros_canales_lnk
        GROUP BY libro_id, canal_id
        HAVING COUNT(*) > 1
      )
    `).get();
    
    const totalRegistros = db.prepare('SELECT COUNT(*) as total FROM libros_canales_lnk').get();
    const totalLibros = db.prepare('SELECT COUNT(DISTINCT libro_id) as total FROM libros_canales_lnk').get();
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   ✅ Registros duplicados eliminados: ${eliminados}`);
    console.log(`   ⚠️  Duplicados restantes: ${duplicadosRestantes.total}`);
    console.log(`   📚 Total registros en libros_canales_lnk: ${totalRegistros.total}`);
    console.log(`   📚 Total libros con canales: ${totalLibros.total}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

