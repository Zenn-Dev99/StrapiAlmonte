#!/usr/bin/env node

/**
 * Script para limpiar cualquier valor no numérico en id_editorial
 * Incluyendo guiones, strings vacíos, etc.
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
    
    console.log('🔄 Limpiando valores no numéricos en id_editorial');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Buscar todos los valores que no sean números enteros válidos
    console.log('📊 Buscando valores no numéricos...');
    
    // Obtener todos los valores únicos de id_editorial
    const todosValores = db.prepare(`
      SELECT DISTINCT id_editorial
      FROM libros
      WHERE id_editorial IS NOT NULL
    `).all();
    
    const valoresInvalidos = [];
    for (const row of todosValores) {
      const valor = row.id_editorial;
      if (valor === null || valor === undefined) continue;
      
      const valorStr = String(valor).trim();
      
      // Verificar si es un número entero válido
      const esNumero = /^-?\d+$/.test(valorStr);
      
      if (!esNumero || valorStr === '-' || valorStr === '' || valorStr === 'null' || valorStr === 'NULL') {
        valoresInvalidos.push(valorStr);
      }
    }
    
    if (valoresInvalidos.length > 0) {
      console.log(`   ⚠️  Encontrados ${valoresInvalidos.length} valores inválidos: ${valoresInvalidos.join(', ')}\n`);
      
      // Contar cuántos libros tienen estos valores
      const countQuery = `
        SELECT COUNT(*) as total
        FROM libros
        WHERE id_editorial IS NOT NULL
          AND (
            CAST(id_editorial AS TEXT) = '-'
            OR CAST(id_editorial AS TEXT) = ''
            OR CAST(id_editorial AS TEXT) = 'null'
            OR CAST(id_editorial AS TEXT) = 'NULL'
            OR CAST(id_editorial AS TEXT) NOT GLOB '[0-9]*'
          )
      `;
      const count = db.prepare(countQuery).get();
      console.log(`   📊 Libros afectados: ${count.total}\n`);
      
      // Actualizar a NULL
      console.log('🔄 Actualizando valores inválidos a NULL...');
      const updateQuery = `
        UPDATE libros
        SET id_editorial = NULL
        WHERE id_editorial IS NOT NULL
          AND (
            CAST(id_editorial AS TEXT) = '-'
            OR CAST(id_editorial AS TEXT) = ''
            OR CAST(id_editorial AS TEXT) = 'null'
            OR CAST(id_editorial AS TEXT) = 'NULL'
            OR CAST(id_editorial AS TEXT) NOT GLOB '[0-9]*'
          )
      `;
      
      const result = db.prepare(updateQuery).run();
      console.log(`   ✅ ${result.changes} libros actualizados (id_editorial = NULL)\n`);
    } else {
      console.log('   ✅ No se encontraron valores no numéricos\n');
    }
    
    // 2. Verificar resultado final
    const countNull = db.prepare('SELECT COUNT(*) as total FROM libros WHERE id_editorial IS NULL').get();
    const countValidos = db.prepare('SELECT COUNT(*) as total FROM libros WHERE id_editorial IS NOT NULL').get();
    const total = db.prepare('SELECT COUNT(*) as total FROM libros').get();
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen final:');
    console.log(`   📦 Total libros: ${total.total}`);
    console.log(`   ✅ Con id_editorial válido (número): ${countValidos.total}`);
    console.log(`   ⚪ Sin id_editorial (NULL): ${countNull.total}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Nota: Los valores NULL se mostrarán vacíos en Strapi.');
    console.log('   Si aún ves guiones, puede ser caché del navegador. Recarga con Ctrl+Shift+R\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

