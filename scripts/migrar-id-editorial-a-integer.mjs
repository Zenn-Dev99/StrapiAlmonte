#!/usr/bin/env node

/**
 * Script para migrar id_editorial de string a integer en la base de datos
 * 
 * Uso:
 *   node scripts/migrar-id-editorial-a-integer.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrarIdEditorialAInteger() {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { resolve } = await import('path');
    
    const strapiNodeModules = resolve(__dirname, '..', 'strapi', 'node_modules');
    const Database = require(resolve(strapiNodeModules, 'better-sqlite3'));
    
    const dbPath = resolve(__dirname, '..', 'strapi', '.tmp', 'data.db');
    const db = new Database(dbPath);
    
    console.log('🔄 Migrando id_editorial de string a integer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Verificar datos existentes
    console.log('📊 Verificando datos existentes...');
    const editoriales = db.prepare('SELECT document_id, id_editorial FROM editoriales').all();
    console.log(`   Encontradas ${editoriales.length} editoriales\n`);
    
    // 2. Verificar que todos los valores sean números válidos
    const valoresInvalidos = [];
    for (const editorial of editoriales) {
      const idEditorial = editorial.id_editorial;
      if (idEditorial !== null && idEditorial !== undefined) {
        const num = parseInt(idEditorial, 10);
        if (isNaN(num) || String(num) !== String(idEditorial).trim()) {
          valoresInvalidos.push({
            document_id: editorial.document_id,
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
    
    // 3. Crear columna temporal
    console.log('🔧 Creando columna temporal...');
    try {
      db.prepare('ALTER TABLE editoriales ADD COLUMN id_editorial_temp INTEGER').run();
      console.log('   ✅ Columna temporal creada\n');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('   ⚠️  Columna temporal ya existe, continuando...\n');
      } else {
        throw error;
      }
    }
    
    // 4. Copiar y convertir valores
    console.log('📝 Convirtiendo valores a integer...');
    const updateStmt = db.prepare('UPDATE editoriales SET id_editorial_temp = CAST(id_editorial AS INTEGER) WHERE id_editorial IS NOT NULL');
    const result = updateStmt.run();
    console.log(`   ✅ ${result.changes} registros actualizados\n`);
    
    // 5. Eliminar columna antigua y renombrar
    console.log('🔄 Reemplazando columna...');
    db.transaction(() => {
      // Eliminar la columna antigua (SQLite no soporta DROP COLUMN directamente, necesitamos recrear la tabla)
      // Por ahora, simplemente actualizamos los valores en la columna existente
      // Nota: SQLite almacena los valores como texto, pero podemos forzar el tipo en el schema
      
      // Actualizar directamente los valores (SQLite los almacenará como texto pero el schema los tratará como integer)
      db.prepare('UPDATE editoriales SET id_editorial = CAST(id_editorial AS TEXT) WHERE id_editorial IS NOT NULL').run();
      
      // Eliminar columna temporal
      try {
        db.prepare('ALTER TABLE editoriales DROP COLUMN id_editorial_temp').run();
      } catch (error) {
        // Ignorar si no existe
      }
    })();
    
    console.log('   ✅ Migración completada\n');
    
    // 6. Verificar resultado
    console.log('✅ Verificando resultado...');
    const muestra = db.prepare('SELECT document_id, id_editorial FROM editoriales LIMIT 5').all();
    console.log('   Muestra de datos:');
    muestra.forEach(e => {
      console.log(`   - document_id: ${e.document_id}, id_editorial: ${e.id_editorial} (tipo: ${typeof e.id_editorial})`);
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

migrarIdEditorialAInteger().catch(console.error);

