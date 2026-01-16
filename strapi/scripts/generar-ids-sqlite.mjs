#!/usr/bin/env node

/**
 * Script para generar id_coleccion directamente en SQLite
 * Esto evita el problema del error 500 de la API REST
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = resolve(__dirname, '..', '.tmp', 'data.db');
console.log('📂 Base de datos:', dbPath);

const db = new Database(dbPath);

try {
  console.log('=== Generar id_coleccion para Colecciones ===\n');
  
  // Obtener todas las colecciones
  const todas = db.prepare('SELECT id, document_id, id_coleccion, nombre_coleccion FROM colecciones ORDER BY id ASC').all();
  
  console.log(`📚 Total de colecciones: ${todas.length}`);
  
  // Separar con y sin id_coleccion
  const conId = todas.filter(c => c.id_coleccion !== null && c.id_coleccion !== undefined);
  const sinId = todas.filter(c => c.id_coleccion === null || c.id_coleccion === undefined);
  
  console.log(`   Con id_coleccion: ${conId.length}`);
  console.log(`   Sin id_coleccion: ${sinId.length}\n`);
  
  if (sinId.length === 0) {
    console.log('✅ Todas las colecciones ya tienen id_coleccion');
    db.close();
    process.exit(0);
  }
  
  // Obtener máximo ID existente
  const idsExistentes = new Set(conId.map(c => c.id_coleccion).filter(id => id !== null && id !== undefined));
  const maxId = idsExistentes.size > 0 ? Math.max(...Array.from(idsExistentes)) : 0;
  
  console.log(`🔢 ID máximo existente: ${maxId}`);
  console.log(`📝 Generando IDs a partir de: ${maxId + 1}\n`);
  
  // Preparar statement de actualización
  const updateStmt = db.prepare('UPDATE colecciones SET id_coleccion = ? WHERE id = ?');
  const updateMany = db.transaction((updates) => {
    for (const { id, id_coleccion } of updates) {
      updateStmt.run(id_coleccion, id);
    }
  });
  
  // Generar IDs
  let siguienteId = maxId + 1;
  const actualizaciones = [];
  
  for (const coleccion of sinId) {
    while (idsExistentes.has(siguienteId)) {
      siguienteId++;
    }
    
    actualizaciones.push({
      id: coleccion.id,
      id_coleccion: siguienteId,
      nombre: coleccion.nombre_coleccion || 'Sin nombre',
    });
    
    idsExistentes.add(siguienteId);
    siguienteId++;
  }
  
  console.log(`🔄 Actualizando ${actualizaciones.length} colecciones...\n`);
  
  // Ejecutar actualizaciones en transacción
  updateMany(actualizaciones);
  
  console.log(`✅ ${actualizaciones.length} colecciones actualizadas exitosamente`);
  console.log('\n🎉 ¡Listo!');
  
  db.close();
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  db.close();
  process.exit(1);
}
