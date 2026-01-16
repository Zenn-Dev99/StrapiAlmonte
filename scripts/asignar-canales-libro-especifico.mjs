#!/usr/bin/env node

/**
 * Script para asignar canales a un libro específico
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
    
    const documentId = process.argv[2] || 'tguhfegy2d8qd767t10jn6k2';
    
    console.log(`🔄 Asignando canales al libro: ${documentId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Buscar el libro
    const libro = db.prepare(`
      SELECT l.id, l.document_id, l.nombre_libro, e.id_editorial, e.nombre_editorial
      FROM libros l
      LEFT JOIN libros_editorial_lnk le ON le.libro_id = l.id
      LEFT JOIN editoriales e ON e.id = le.editorial_id
      WHERE l.document_id = ?
    `).get(documentId);
    
    if (!libro) {
      console.log(`❌ No se encontró el libro con document_id: ${documentId}`);
      db.close();
      return;
    }
    
    console.log(`📚 Libro encontrado: "${libro.nombre_libro}"`);
    console.log(`   Editorial: ${libro.nombre_editorial || 'Sin editorial'} (id_editorial: ${libro.id_editorial || 'N/A'})\n`);
    
    // 2. Buscar canales
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
    
    // 3. Verificar canales actuales
    const canalesActuales = db.prepare(`
      SELECT c.id, c.name
      FROM libros_canales_lnk lc
      JOIN canales c ON c.id = lc.canal_id
      WHERE lc.libro_id = ?
    `).all(libro.id);
    
    console.log(`📋 Canales actuales: ${canalesActuales.length}`);
    canalesActuales.forEach(c => console.log(`   - ${c.name} (ID: ${c.id})`));
    console.log('');
    
    // 4. Añadir canal "escolar" si no lo tiene
    const tieneEscolar = canalesActuales.some(c => c.id === canalEscolar.id);
    if (!tieneEscolar) {
      console.log('🔄 Añadiendo canal "escolar"...');
      try {
        db.prepare(`
          INSERT INTO libros_canales_lnk (libro_id, canal_id, canal_ord)
          VALUES (?, ?, 1.0)
        `).run(libro.id, canalEscolar.id);
        console.log('   ✅ Canal "escolar" añadido\n');
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    } else {
      console.log('   ⚪ Ya tiene canal "escolar"\n');
    }
    
    // 5. Añadir canal "moraleja" si es editorial Moraleja y no lo tiene
    if (libro.id_editorial === 1 && canalMoraleja) {
      const tieneMoraleja = canalesActuales.some(c => c.id === canalMoraleja.id);
      if (!tieneMoraleja) {
        console.log('🔄 Añadiendo canal "moraleja"...');
        try {
          db.prepare(`
            INSERT INTO libros_canales_lnk (libro_id, canal_id, canal_ord)
            VALUES (?, ?, 1.0)
          `).run(libro.id, canalMoraleja.id);
          console.log('   ✅ Canal "moraleja" añadido\n');
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}\n`);
        }
      } else {
        console.log('   ⚪ Ya tiene canal "moraleja"\n');
      }
    }
    
    // 6. Verificar resultado final
    const canalesFinales = db.prepare(`
      SELECT c.id, c.name
      FROM libros_canales_lnk lc
      JOIN canales c ON c.id = lc.canal_id
      WHERE lc.libro_id = ?
    `).all(libro.id);
    
    db.close();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Canales finales:');
    canalesFinales.forEach(c => console.log(`   ✅ ${c.name} (ID: ${c.id})`));
    if (canalesFinales.length === 0) {
      console.log('   ⚠️  Sin canales asignados');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

