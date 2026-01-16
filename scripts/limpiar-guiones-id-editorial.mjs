#!/usr/bin/env node

/**
 * Script para limpiar guiones (-) en id_editorial y dejarlos como NULL
 */

import { readFileSync, existsSync } from 'fs';
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
    
    console.log('🔄 Limpiando guiones en id_editorial de libros');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Buscar libros con id_editorial que sea "-" o similar
    console.log('📊 Buscando libros con id_editorial = "-" o valores inválidos...');
    const query = `
      SELECT document_id, id_editorial, nombre_libro
      FROM libros
      WHERE id_editorial = '-' 
         OR id_editorial = 'null'
         OR id_editorial = ''
         OR CAST(id_editorial AS TEXT) = '-'
         OR (id_editorial IS NOT NULL AND CAST(id_editorial AS TEXT) NOT GLOB '[0-9]*')
    `;
    
    const librosConGuion = db.prepare(query).all();
    console.log(`   Encontrados ${librosConGuion.length} libros con id_editorial inválido\n`);
    
    if (librosConGuion.length === 0) {
      console.log('✅ No se encontraron libros con guiones. Todo está correcto.\n');
      db.close();
      return;
    }
    
    // Mostrar algunos ejemplos
    console.log('📋 Ejemplos de libros a limpiar:');
    librosConGuion.slice(0, 10).forEach((libro, idx) => {
      const nombre = libro.nombre_libro || 'Sin nombre';
      console.log(`   ${idx + 1}. "${nombre.substring(0, 50)}" → id_editorial: "${libro.id_editorial}"`);
    });
    if (librosConGuion.length > 10) {
      console.log(`   ... y ${librosConGuion.length - 10} más\n`);
    } else {
      console.log('');
    }
    
    // 2. Actualizar a NULL
    console.log('🔄 Actualizando a NULL...');
    const updateQuery = `
      UPDATE libros
      SET id_editorial = NULL
      WHERE id_editorial = '-' 
         OR id_editorial = 'null'
         OR id_editorial = ''
         OR CAST(id_editorial AS TEXT) = '-'
         OR (id_editorial IS NOT NULL AND CAST(id_editorial AS TEXT) NOT GLOB '[0-9]*')
    `;
    
    const result = db.prepare(updateQuery).run();
    console.log(`   ✅ ${result.changes} libros actualizados (id_editorial = NULL)\n`);
    
    // 3. Verificar resultado
    console.log('✅ Verificando resultado...');
    const verificarQuery = `
      SELECT COUNT(*) as total
      FROM libros
      WHERE id_editorial = '-' 
         OR id_editorial = 'null'
         OR id_editorial = ''
         OR CAST(id_editorial AS TEXT) = '-'
         OR (id_editorial IS NOT NULL AND CAST(id_editorial AS TEXT) NOT GLOB '[0-9]*')
    `;
    const verificar = db.prepare(verificarQuery).get();
    
    // Contar cuántos tienen id_editorial NULL ahora
    const countNull = db.prepare('SELECT COUNT(*) as total FROM libros WHERE id_editorial IS NULL').get();
    const countConValor = db.prepare('SELECT COUNT(*) as total FROM libros WHERE id_editorial IS NOT NULL').get();
    
    db.close();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   ✅ Libros actualizados (ahora NULL): ${result.changes}`);
    console.log(`   ⚠️  Libros aún con valores inválidos: ${verificar.total}`);
    console.log(`   📊 Total libros con id_editorial NULL: ${countNull.total}`);
    console.log(`   📊 Total libros con id_editorial válido: ${countConValor.total}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

