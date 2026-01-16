#!/usr/bin/env node

/**
 * Script para migrar id_editorial en libros de string a integer
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrarIdEditorialLibrosAInteger() {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { resolve } = await import('path');
    
    const strapiNodeModules = resolve(__dirname, '..', 'strapi', 'node_modules');
    const Database = require(resolve(strapiNodeModules, 'better-sqlite3'));
    
    const dbPath = resolve(__dirname, '..', 'strapi', '.tmp', 'data.db');
    const db = new Database(dbPath);
    
    console.log('🔄 Migrando id_editorial en libros de string a integer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Verificar datos existentes
    console.log('📊 Verificando datos existentes...');
    const libros = db.prepare('SELECT document_id, id_editorial FROM libros WHERE id_editorial IS NOT NULL').all();
    console.log(`   Encontrados ${libros.length} libros con id_editorial\n`);
    
    // 2. Verificar que todos los valores sean números válidos
    const valoresInvalidos = [];
    for (const libro of libros) {
      const idEditorial = libro.id_editorial;
      if (idEditorial !== null && idEditorial !== undefined) {
        const num = parseInt(idEditorial, 10);
        if (isNaN(num) || String(num) !== String(idEditorial).trim()) {
          valoresInvalidos.push({
            document_id: libro.document_id,
            id_editorial: idEditorial,
          });
        }
      }
    }
    
    if (valoresInvalidos.length > 0) {
      console.error('❌ Se encontraron valores no numéricos:');
      valoresInvalidos.forEach(v => {
        console.error(`   - document_id: ${v.document_id}, id_editorial: "${v.id_editorial}"`);
      });
      db.close();
      process.exit(1);
    }
    
    console.log('   ✅ Todos los valores son números válidos\n');
    
    // 3. Actualizar directamente los valores (SQLite los almacenará como texto pero el schema los tratará como integer)
    console.log('📝 Convirtiendo valores a integer...');
    const updateStmt = db.prepare('UPDATE libros SET id_editorial = CAST(id_editorial AS INTEGER) WHERE id_editorial IS NOT NULL');
    const result = updateStmt.run();
    console.log(`   ✅ ${result.changes} registros actualizados\n`);
    
    // 4. Verificar resultado
    console.log('✅ Verificando resultado...');
    const muestra = db.prepare('SELECT document_id, id_editorial FROM libros WHERE id_editorial IS NOT NULL LIMIT 5').all();
    console.log('   Muestra de datos:');
    muestra.forEach(l => {
      console.log(`   - document_id: ${l.document_id}, id_editorial: ${l.id_editorial} (tipo: ${typeof l.id_editorial})`);
    });
    
    db.close();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migración completada exitosamente');
    console.log('⚠️  IMPORTANTE: Reinicia Strapi para que el cambio de schema surta efecto');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrarIdEditorialLibrosAInteger().catch(console.error);

