#!/usr/bin/env node

/**
 * Script para asegurar que TODOS los libros tengan canal "escolar"
 * Y que los libros de editorial Moraleja tengan ambos canales
 * Incluye verificación de duplicados
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
    
    console.log('🔄 Asegurando canales en TODOS los libros');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Buscar canales (usar el publicado)
    const canalEscolar = db.prepare(`
      SELECT id, name, key
      FROM canales
      WHERE (LOWER(name) = 'escolar' OR LOWER(key) = 'escolar')
        AND published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 1
    `).get();
    
    const canalMoraleja = db.prepare(`
      SELECT id, name, key
      FROM canales
      WHERE (LOWER(name) = 'moraleja' OR LOWER(key) = 'moraleja')
        AND published_at IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 1
    `).get();
    
    if (!canalEscolar) {
      console.log('❌ No se encontró el canal "escolar"');
      db.close();
      return;
    }
    
    console.log(`📚 Canales encontrados:`);
    console.log(`   ✅ Escolar: ID ${canalEscolar.id}`);
    if (canalMoraleja) {
      console.log(`   ✅ Moraleja: ID ${canalMoraleja.id}`);
    }
    console.log('');
    
    // 2. Obtener todos los libros (incluyendo duplicados)
    const totalLibros = db.prepare('SELECT COUNT(*) as total FROM libros').get().total;
    console.log(`📦 Total libros en BD: ${totalLibros}\n`);
    
    // 3. Añadir canal "escolar" a todos los libros que no lo tengan
    console.log('🔄 Añadiendo canal "escolar" a todos los libros...');
    const librosSinEscolar = db.prepare(`
      SELECT DISTINCT l.id
      FROM libros l
      LEFT JOIN libros_canales_lnk lc ON lc.libro_id = l.id AND lc.canal_id = ?
      WHERE lc.libro_id IS NULL
    `).all(canalEscolar.id);
    
    console.log(`   📚 Libros sin canal "escolar": ${librosSinEscolar.length}`);
    
    let escolarAñadidos = 0;
    for (const libro of librosSinEscolar) {
      try {
        db.prepare(`
          INSERT INTO libros_canales_lnk (libro_id, canal_id, canal_ord)
          VALUES (?, ?, 1.0)
        `).run(libro.id, canalEscolar.id);
        escolarAñadidos++;
      } catch (error) {
        if (!error.message.includes('UNIQUE constraint')) {
          console.error(`   ❌ Error en libro ${libro.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`   ✅ ${escolarAñadidos} libros actualizados\n`);
    
    // 4. Añadir canal "moraleja" a libros con editorial Moraleja
    if (canalMoraleja) {
      console.log('🔄 Añadiendo canal "moraleja" a libros con editorial Moraleja...');
      
      const librosMoralejaSinCanal = db.prepare(`
        SELECT DISTINCT l.id
        FROM libros l
        JOIN libros_editorial_lnk le ON le.libro_id = l.id
        JOIN editoriales e ON e.id = le.editorial_id
        LEFT JOIN libros_canales_lnk lc ON lc.libro_id = l.id AND lc.canal_id = ?
        WHERE e.id_editorial = 1
          AND lc.libro_id IS NULL
      `).all(canalMoraleja.id);
      
      console.log(`   📚 Libros de Moraleja sin canal "moraleja": ${librosMoralejaSinCanal.length}`);
      
      let moralejaAñadidos = 0;
      for (const libro of librosMoralejaSinCanal) {
        try {
          db.prepare(`
            INSERT INTO libros_canales_lnk (libro_id, canal_id, canal_ord)
            VALUES (?, ?, 1.0)
          `).run(libro.id, canalMoraleja.id);
          moralejaAñadidos++;
        } catch (error) {
          if (!error.message.includes('UNIQUE constraint')) {
            console.error(`   ❌ Error en libro ${libro.id}: ${error.message}`);
          }
        }
      }
      
      console.log(`   ✅ ${moralejaAñadidos} libros actualizados\n`);
    }
    
    // 5. Verificación final
    const conEscolar = db.prepare(`
      SELECT COUNT(DISTINCT libro_id) as total
      FROM libros_canales_lnk
      WHERE canal_id = ?
    `).get(canalEscolar.id).total;
    
    let conMoraleja = 0;
    if (canalMoraleja) {
      conMoraleja = db.prepare(`
        SELECT COUNT(DISTINCT libro_id) as total
        FROM libros_canales_lnk
        WHERE canal_id = ?
      `).get(canalMoraleja.id).total;
    }
    
    // Verificar el libro específico
    const libroEspecifico = db.prepare(`
      SELECT l.id, l.document_id, l.nombre_libro, l.published_at,
             COUNT(DISTINCT lc.canal_id) as num_canales,
             GROUP_CONCAT(DISTINCT c.name) as canales
      FROM libros l
      LEFT JOIN libros_canales_lnk lc ON lc.libro_id = l.id
      LEFT JOIN canales c ON c.id = lc.canal_id
      WHERE l.document_id = 'tguhfegy2d8qd767t10jn6k2'
      GROUP BY l.id
      ORDER BY l.published_at DESC NULLS LAST, l.id
    `).all();
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen final:');
    console.log(`   📚 Total libros: ${totalLibros}`);
    console.log(`   ✅ Con canal "escolar": ${conEscolar}`);
    if (canalMoraleja) {
      console.log(`   ✅ Con canal "moraleja": ${conMoraleja}`);
    }
    console.log('');
    console.log('📋 Libro específico (tguhfegy2d8qd767t10jn6k2):');
    libroEspecifico.forEach(libro => {
      const publicado = libro.published_at ? '✅ Publicado' : '⚠️  No publicado';
      console.log(`   ID ${libro.id}: "${libro.nombre_libro}" - ${publicado}`);
      console.log(`      Canales: ${libro.canales || 'Ninguno'} (${libro.num_canales})`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

