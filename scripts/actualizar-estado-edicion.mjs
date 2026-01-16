#!/usr/bin/env node

/**
 * Script para actualizar todos los libros a estado_edicion = 'Vigente'
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
    
    console.log('🔄 Actualizando estado_edicion a "Vigente"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verificar si la columna existe
    const tableInfo = db.prepare("PRAGMA table_info(libros)").all();
    const tieneColumna = tableInfo.some(col => col.name === 'estado_edicion');
    
    if (!tieneColumna) {
      console.log('⚠️  La columna estado_edicion aún no existe.');
      console.log('   Espera a que Strapi termine de reiniciar y ejecuta este script nuevamente.\n');
      db.close();
      return;
    }
    
    // Actualizar todos los libros a 'Vigente'
    const result = db.prepare(`
      UPDATE libros
      SET estado_edicion = 'Vigente'
      WHERE estado_edicion IS NULL OR estado_edicion = ''
    `).run();
    
    // Verificar resultado
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN estado_edicion = 'Vigente' THEN 1 END) as vigentes,
        COUNT(CASE WHEN estado_edicion = 'Stock Limitado' THEN 1 END) as stock_limitado,
        COUNT(CASE WHEN estado_edicion = 'Descatalogado' THEN 1 END) as descatalogados
      FROM libros
    `).get();
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resultado:');
    console.log(`   ✅ Libros actualizados: ${result.changes}`);
    console.log(`   📚 Total libros: ${stats.total}`);
    console.log(`   ✅ Vigentes: ${stats.vigentes}`);
    console.log(`   ⚠️  Stock Limitado: ${stats.stock_limitado}`);
    console.log(`   ❌ Descatalogados: ${stats.descatalogados}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

