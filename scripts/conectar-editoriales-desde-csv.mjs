#!/usr/bin/env node

/**
 * Script para conectar libros con editoriales desde el CSV de Notion
 * Enfocado en los libros que tienen editorial en el CSV pero no en Strapi
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
    
    console.log('🔄 Conectando editoriales desde CSV de Notion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Leer CSV
    const csvPath = resolve(__dirname, '..', 'data', 'csv', 'import', 'libros_notion.csv');
    
    if (!existsSync(csvPath)) {
      console.log('⚠️  No se encontró el archivo libros_notion.csv');
      db.close();
      return;
    }
    
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    function parseCSV(content) {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) return [];
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < lines[i].length; j++) {
          const char = lines[i][j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        
        if (values.length > 0 && values.some(v => v)) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      }
      
      return data;
    }
    
    const records = parseCSV(csvContent);
    
    // 2. Crear mapa de ISBN -> Editorial del CSV
    const csvMap = new Map();
    const columnasEditorial = ['Nombre Editorial', 'Editorial', 'editorial'];
    const columnasISBN = ['ISBN', 'isbn', 'ISBN Libro'];
    
    records.forEach(record => {
      // Buscar ISBN
      let isbn = null;
      for (const col of columnasISBN) {
        if (record[col] && record[col].trim()) {
          isbn = record[col].trim();
          break;
        }
      }
      
      if (!isbn) return;
      
      // Buscar editorial
      let editorial = null;
      for (const col of columnasEditorial) {
        if (record[col] && record[col].trim() && record[col].trim() !== '-') {
          editorial = record[col].trim();
          break;
        }
      }
      
      if (editorial) {
        csvMap.set(isbn, editorial);
      }
    });
    
    console.log(`📄 CSV procesado: ${csvMap.size} libros con editorial en CSV\n`);
    
    // 3. Obtener todos los libros de Strapi sin editorial
    const librosSinEditorial = db.prepare(`
      SELECT 
        l.id,
        l.document_id,
        l.isbn_libro,
        l.nombre_libro
      FROM libros l
      LEFT JOIN libros_editorial_lnk le ON le.libro_id = l.id
      WHERE le.libro_id IS NULL
        AND l.isbn_libro IS NOT NULL
        AND l.isbn_libro != ''
        AND l.isbn_libro NOT LIKE 'TEMP-%'
    `).all();
    
    console.log(`📦 Libros sin editorial en Strapi: ${librosSinEditorial.length}\n`);
    
    // 4. Obtener todas las editoriales de Strapi
    const editorialesStrapi = db.prepare(`
      SELECT 
        e.id,
        e.document_id,
        e.nombre_editorial,
        e.id_editorial
      FROM editoriales e
    `).all();
    
    // Crear mapa de nombre_editorial -> id
    const editorialesMap = new Map();
    editorialesStrapi.forEach(editorial => {
      const nombre = (editorial.nombre_editorial || '').trim().toLowerCase();
      if (nombre) {
        // Normalizar nombre (quitar espacios extra, etc.)
        const nombreNormalizado = nombre.replace(/\s+/g, ' ').trim();
        if (!editorialesMap.has(nombreNormalizado)) {
          editorialesMap.set(nombreNormalizado, {
            id: editorial.id,
            document_id: editorial.document_id,
            nombre: editorial.nombre_editorial,
            id_editorial: editorial.id_editorial
          });
        }
      }
    });
    
    console.log(`📚 Editoriales en Strapi: ${editorialesMap.size}\n`);
    
    // 5. Conectar libros con editoriales
    let librosConectados = 0;
    let librosNoEncontrados = 0;
    let editorialesNoEncontradas = new Set();
    const ejemplos = [];
    
    console.log('🔄 Conectando editoriales...\n');
    
    for (const libro of librosSinEditorial) {
      const isbn = libro.isbn_libro;
      const editorialNombre = csvMap.get(isbn);
      
      if (!editorialNombre) {
        continue;
      }
      
      // Normalizar nombre de editorial
      const nombreNormalizado = editorialNombre.trim().toLowerCase().replace(/\s+/g, ' ').trim();
      const editorial = editorialesMap.get(nombreNormalizado);
      
      if (!editorial) {
        editorialesNoEncontradas.add(editorialNombre);
        librosNoEncontrados++;
        continue;
      }
      
      // Insertar relación en libros_editorial_lnk
      try {
        db.prepare(`
          INSERT INTO libros_editorial_lnk (libro_id, editorial_id, libro_ord)
          VALUES (?, ?, 1.0)
        `).run(libro.id, editorial.id);
        
        // Actualizar id_editorial en la tabla libros
        db.prepare(`
          UPDATE libros
          SET id_editorial = ?
          WHERE id = ?
        `).run(editorial.id_editorial, libro.id);
        
        librosConectados++;
        
        if (ejemplos.length < 10) {
          ejemplos.push({
            nombre: libro.nombre_libro,
            isbn: isbn,
            editorial: editorial.nombre
          });
        }
      } catch (error) {
        // Si ya existe la relación, ignorar
        if (!error.message.includes('UNIQUE constraint')) {
          console.error(`   ❌ Error al conectar libro ${libro.id}:`, error.message);
        }
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   ✅ Libros conectados: ${librosConectados}`);
    console.log(`   ⚠️  Libros no conectados (editorial no encontrada): ${librosNoEncontrados}`);
    console.log(`   📚 Editoriales no encontradas: ${editorialesNoEncontradas.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (ejemplos.length > 0) {
      console.log('📋 Ejemplos de libros conectados:');
      ejemplos.forEach((libro, idx) => {
        const nombre = libro.nombre || 'Sin nombre';
        console.log(`   ${idx + 1}. "${nombre.substring(0, 50)}" (ISBN: ${libro.isbn})`);
        console.log(`      → Editorial: ${libro.editorial}`);
      });
      if (librosConectados > 10) {
        console.log(`   ... y ${librosConectados - 10} más\n`);
      } else {
        console.log('');
      }
    }
    
    if (editorialesNoEncontradas.size > 0) {
      console.log('⚠️  Editoriales del CSV no encontradas en Strapi (primeras 20):');
      Array.from(editorialesNoEncontradas).slice(0, 20).forEach((nombre, idx) => {
        console.log(`   ${idx + 1}. "${nombre}"`);
      });
      if (editorialesNoEncontradas.size > 20) {
        console.log(`   ... y ${editorialesNoEncontradas.size - 20} más\n`);
      } else {
        console.log('');
      }
    }
    
    // 6. Verificar resultado final
    const finalStats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM libros) as total_libros,
        (SELECT COUNT(DISTINCT libro_id) FROM libros_editorial_lnk) as con_editorial,
        (SELECT COUNT(*) FROM libros) - (SELECT COUNT(DISTINCT libro_id) FROM libros_editorial_lnk) as sin_editorial
    `).get();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Estado final:');
    console.log(`   📚 Total libros: ${finalStats.total_libros}`);
    console.log(`   ✅ Con editorial: ${finalStats.con_editorial}`);
    console.log(`   ⚠️  Sin editorial: ${finalStats.sin_editorial}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    db.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

