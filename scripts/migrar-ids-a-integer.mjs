#!/usr/bin/env node

/**
 * Script para migrar todos los campos id_* de string a integer
 * Incluye: id_autor, id_sello, id_coleccion, id_obra (en libros)
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
    
    console.log('🔄 Migrando campos id_* de string a integer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const migrations = [
      {
        table: 'autores',
        field: 'id_autor',
        name: 'id_autor en autores'
      },
      {
        table: 'sellos',
        field: 'id_sello',
        name: 'id_sello en sellos'
      },
      {
        table: 'colecciones',
        field: 'id_coleccion',
        name: 'id_coleccion en colecciones'
      },
      {
        table: 'libros',
        field: 'id_autor',
        name: 'id_autor en libros'
      },
      {
        table: 'libros',
        field: 'id_sello',
        name: 'id_sello en libros'
      },
      {
        table: 'libros',
        field: 'id_coleccion',
        name: 'id_coleccion en libros'
      },
      {
        table: 'libros',
        field: 'id_obra',
        name: 'id_obra en libros'
      }
    ];
    
    for (const migration of migrations) {
      console.log(`📊 Procesando: ${migration.name}`);
      
      // 1. Verificar valores no numéricos
      const invalidQuery = `
        SELECT COUNT(*) as total
        FROM ${migration.table}
        WHERE ${migration.field} IS NOT NULL
          AND (
            CAST(${migration.field} AS TEXT) = '-'
            OR CAST(${migration.field} AS TEXT) = ''
            OR CAST(${migration.field} AS TEXT) = 'null'
            OR CAST(${migration.field} AS TEXT) = 'NULL'
            OR CAST(${migration.field} AS TEXT) NOT GLOB '[0-9]*'
          )
      `;
      
      const invalid = db.prepare(invalidQuery).get();
      
      if (invalid.total > 0) {
        console.log(`   ⚠️  Encontrados ${invalid.total} valores no numéricos. Limpiando a NULL...`);
        
        const cleanQuery = `
          UPDATE ${migration.table}
          SET ${migration.field} = NULL
          WHERE ${migration.field} IS NOT NULL
            AND (
              CAST(${migration.field} AS TEXT) = '-'
              OR CAST(${migration.field} AS TEXT) = ''
              OR CAST(${migration.field} AS TEXT) = 'null'
              OR CAST(${migration.field} AS TEXT) = 'NULL'
              OR CAST(${migration.field} AS TEXT) NOT GLOB '[0-9]*'
            )
        `;
        
        const cleanResult = db.prepare(cleanQuery).run();
        console.log(`   ✅ ${cleanResult.changes} registros limpiados (ahora NULL)`);
      }
      
      // 2. Verificar que todos los valores restantes sean numéricos válidos
      const checkQuery = `
        SELECT COUNT(*) as total
        FROM ${migration.table}
        WHERE ${migration.field} IS NOT NULL
          AND CAST(${migration.field} AS TEXT) NOT GLOB '[0-9]*'
      `;
      
      const stillInvalid = db.prepare(checkQuery).get();
      
      if (stillInvalid.total > 0) {
        console.log(`   ⚠️  Aún quedan ${stillInvalid.total} valores no numéricos. Saltando migración.`);
        continue;
      }
      
      // 3. Contar registros con valores
      const countQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(${migration.field}) as con_valor,
          COUNT(*) - COUNT(${migration.field}) as sin_valor
        FROM ${migration.table}
      `;
      
      const counts = db.prepare(countQuery).get();
      console.log(`   📊 Total: ${counts.total}, Con valor: ${counts.con_valor}, Sin valor (NULL): ${counts.sin_valor}`);
      
      // 4. La migración de tipo se hará automáticamente cuando Strapi reinicie
      // Solo necesitamos asegurarnos de que los valores sean numéricos válidos
      console.log(`   ✅ ${migration.name} listo para migración\n`);
    }
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migración completada');
    console.log('💡 Los tipos se actualizarán automáticamente cuando Strapi reinicie');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

