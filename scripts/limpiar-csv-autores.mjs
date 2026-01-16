#!/usr/bin/env node

/**
 * Script para limpiar espacios en blanco adicionales en el CSV de autores
 * - Elimina espacios dobles/múltiples
 * - Elimina espacios al inicio y final de cada campo
 * - Normaliza espacios en nombres de autores
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = resolve(__dirname, '..', 'data', 'csv', 'import', 'autores4.csv');
const CSV_BACKUP = resolve(__dirname, '..', 'data', 'csv', 'import', 'autores4.csv.backup');

function limpiarTexto(texto) {
  if (!texto || typeof texto !== 'string') return '';
  
  // Eliminar espacios al inicio y final
  let limpio = texto.trim();
  
  // Eliminar espacios múltiples y reemplazarlos por un solo espacio
  limpio = limpio.replace(/\s+/g, ' ');
  
  // Eliminar espacios extra alrededor de comas (si hay)
  limpio = limpio.replace(/\s*,\s*/g, ',');
  
  return limpio;
}

function limpiarCSV(csvPath) {
  console.log('🧹 Limpiando CSV de autores...');
  console.log(`📂 Archivo: ${csvPath}`);
  
  // Hacer backup del archivo original
  console.log(`💾 Creando backup: ${CSV_BACKUP}`);
  const contenidoOriginal = readFileSync(csvPath, 'utf-8');
  writeFileSync(CSV_BACKUP, contenidoOriginal, 'utf-8');
  
  // Leer el CSV
  const lineas = contenidoOriginal.split('\n');
  console.log(`📄 Total de líneas: ${lineas.length}`);
  
  const lineasLimpias = [];
  let cambios = 0;
  
  // Procesar cada línea
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    
    // Si es la primera línea (encabezados), limpiarla pero mantener estructura
    if (i === 0) {
      const encabezados = linea.split(',').map(h => limpiarTexto(h));
      lineasLimpias.push(encabezados.join(','));
      continue;
    }
    
    // Si la línea está vacía, omitirla
    if (!linea.trim()) {
      continue;
    }
    
    // Para las demás líneas, parsear CSV correctamente (manejar comillas)
    let campos = [];
    let campoActual = '';
    let dentroDeComillas = false;
    let lineaCambiada = false;
    
    for (let j = 0; j < linea.length; j++) {
      const char = linea[j];
      
      if (char === '"') {
        dentroDeComillas = !dentroDeComillas;
        campoActual += char;
      } else if (char === ',' && !dentroDeComillas) {
        // Fin del campo
        const campoLimpio = limpiarTexto(campoActual);
        if (campoLimpio !== campoActual) {
          lineaCambiada = true;
        }
        campos.push(campoLimpio);
        campoActual = '';
      } else {
        campoActual += char;
      }
    }
    
    // Agregar el último campo
    const campoLimpio = limpiarTexto(campoActual);
    if (campoLimpio !== campoActual) {
      lineaCambiada = true;
    }
    campos.push(campoLimpio);
    
    // Si se hicieron cambios, incrementar contador
    if (lineaCambiada) {
      cambios++;
    }
    
    // Reconstruir la línea limpiando cada campo
    const lineaNueva = campos.map(campo => {
      // Si el campo contiene comas, espacios o comillas, envolverlo en comillas
      if (campo.includes(',') || campo.includes('"') || campo.includes('\n')) {
        // Escapar comillas dobles
        const campoEscapado = campo.replace(/"/g, '""');
        return `"${campoEscapado}"`;
      }
      return campo;
    }).join(',');
    
    lineasLimpias.push(lineaNueva);
    
    // Mostrar progreso cada 500 líneas
    if ((i + 1) % 500 === 0) {
      console.log(`   📊 Procesadas ${i + 1}/${lineas.length} líneas...`);
    }
  }
  
  // Escribir el archivo limpio
  const contenidoLimpio = lineasLimpias.join('\n');
  writeFileSync(csvPath, contenidoLimpio, 'utf-8');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Limpieza completada:');
  console.log(`   📄 Total de líneas procesadas: ${lineas.length}`);
  console.log(`   ✨ Líneas con cambios: ${cambios}`);
  console.log(`   💾 Backup guardado en: ${CSV_BACKUP}`);
  console.log(`   📂 Archivo limpio: ${csvPath}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

try {
  limpiarCSV(CSV_PATH);
} catch (error) {
  console.error('❌ Error limpiando CSV:', error.message);
  process.exit(1);
}

