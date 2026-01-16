#!/usr/bin/env node

/**
 * Monitor de procesos de importación
 * Muestra el estado y progreso de todas las importaciones corriendo
 * 
 * Uso:
 *   node scripts/monitor-importaciones.mjs
 *   node scripts/monitor-importaciones.mjs --watch  # Actualización automática
 */

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

const LOGS = {
  autores: '/tmp/import-autores-clean.log',
  editoriales: '/tmp/import-editoriales.log',
  libros: '/tmp/import-libros.log',
  relaciones: '/tmp/conectar-relaciones.log',
};

const PIDS = {
  autores: null,
  editoriales: null,
  libros: null,
  relaciones: null,
};

// Detectar PIDs de procesos corriendo
function detectarPIDs() {
  try {
    const { execSync } = require('child_process');
    
    // Buscar procesos de importación
    let procesos = '';
    try {
      procesos = execSync('ps aux | grep -E "importar|conectar-libros" | grep -v grep | grep -v monitor', { encoding: 'utf-8' });
    } catch (e) {
      procesos = '';
    }
    
    const lineas = procesos.split('\n').filter(l => l.trim());
    
    for (const linea of lineas) {
      // Extraer PID (segunda columna de ps aux)
      const partes = linea.trim().split(/\s+/);
      if (partes.length < 2) continue;
      
      const pid = partes[1];
      
      // Buscar patrones de scripts
      if (linea.includes('importar-autores-csv')) {
        PIDS.autores = pid;
      } else if (linea.includes('importar-editoriales')) {
        PIDS.editoriales = pid;
      } else if (linea.includes('importar-libros-csv')) {
        PIDS.libros = pid;
      } else if (linea.includes('conectar-libros-relaciones')) {
        PIDS.relaciones = pid;
      }
    }

    // También verificar si el log está creciendo (indicador de proceso activo)
    for (const [nombre, ruta] of Object.entries(LOGS)) {
      if (existsSync(ruta) && !PIDS[nombre]) {
        // Si el archivo se modificó en los últimos 10 segundos, probablemente está corriendo
        try {
          const stats = require('fs').statSync(ruta);
          const ahora = Date.now();
          const modificado = stats.mtimeMs;
          const segundosDesdeModificacion = (ahora - modificado) / 1000;
          
          if (segundosDesdeModificacion < 15) {
            PIDS[nombre] = 'activo';
          }
        } catch (e) {
          // Ignorar
        }
      }
    }
  } catch (error) {
    // Ignorar errores
  }
}

// Leer últimas líneas de un log
function leerLog(ruta, lineas = 50) {
  if (!existsSync(ruta)) {
    return { existe: false, contenido: '', ultimasLineas: [] };
  }

  try {
    const contenido = readFileSync(ruta, 'utf-8');
    const todasLineas = contenido.split('\n').filter(l => l.trim());
    const ultimasLineas = todasLineas.slice(-lineas);
    
    return {
      existe: true,
      contenido,
      ultimasLineas,
      totalLineas: todasLineas.length,
    };
  } catch (error) {
    return { existe: false, contenido: '', ultimasLineas: [], error: error.message };
  }
}

// Extraer estadísticas de un log
function extraerEstadisticas(nombre, log) {
  const stats = {
    nombre,
    corriendo: false,
    pid: PIDS[nombre] || null,
    progreso: null,
    total: null,
    porcentaje: null,
    creados: null,
    actualizados: null,
    omitidos: null,
    errores: null,
    ultimaAccion: null,
    resumen: null,
  };

  if (!log.existe || log.ultimasLineas.length === 0) {
    stats.corriendo = PIDS[nombre] !== null;
    return stats;
  }

  // Detectar si el proceso está corriendo
  stats.corriendo = PIDS[nombre] !== null;
  
  // También verificar si el log se está actualizando (indicador de proceso activo)
  if (log.existe) {
    try {
      const stats_fs = require('fs').statSync(LOGS[nombre]);
      const ahora = Date.now();
      const modificado = stats_fs.mtimeMs;
      const segundosDesdeModificacion = (ahora - modificado) / 1000;
      
      // Si se modificó hace menos de 30 segundos, probablemente está corriendo
      if (segundosDesdeModificacion < 30) {
        stats.corriendo = true;
        if (!PIDS[nombre] || PIDS[nombre] === 'activo') {
          PIDS[nombre] = PIDS[nombre] || 'activo';
        }
      }
    } catch (e) {
      // Ignorar
    }
  }

  // Extraer progreso (ej: [47/7357])
  const progresoMatch = log.contenido.match(/\[(\d+)\/(\d+)\]/g);
  if (progresoMatch && progresoMatch.length > 0) {
    const ultimo = progresoMatch[progresoMatch.length - 1];
    const match = ultimo.match(/\[(\d+)\/(\d+)\]/);
    if (match) {
      stats.progreso = parseInt(match[1]);
      stats.total = parseInt(match[2]);
      stats.porcentaje = Math.round((stats.progreso / stats.total) * 100);
    }
  }

  // Extraer resumen final
  const resumenMatch = log.contenido.match(/📊 Resumen:[\s\S]*?✅ Creados?: (\d+)[\s\S]*?⚠️.*?(\d+)[\s\S]*?❌ Errores?: (\d+)/);
  if (resumenMatch) {
    stats.creados = parseInt(resumenMatch[1]) || 0;
    stats.omitidos = parseInt(resumenMatch[2]) || 0;
    stats.errores = parseInt(resumenMatch[3]) || 0;
    stats.resumen = true;
  }

  // Buscar resumen de relaciones
  const relacionesMatch = log.contenido.match(/✅ Actualizados con relaciones: (\d+)[\s\S]*?⏭️.*?(\d+)[\s\S]*?❌ Errores?: (\d+)/);
  if (relacionesMatch) {
    stats.actualizados = parseInt(relacionesMatch[1]) || 0;
    stats.omitidos = parseInt(relacionesMatch[2]) || 0;
    stats.errores = parseInt(relacionesMatch[3]) || 0;
    stats.resumen = true;
  }

  // Última acción
  if (log.ultimasLineas.length > 0) {
    const ultimaLinea = log.ultimasLineas[log.ultimasLineas.length - 1];
    if (ultimaLinea) {
      stats.ultimaAccion = ultimaLinea.trim().substring(0, 80);
    }
  }

  return stats;
}

// Mostrar estado de un proceso
function mostrarEstado(stats) {
  const iconos = {
    corriendo: '🟢',
    detenido: '🔴',
    completado: '✅',
  };

  const estado = stats.resumen ? 'completado' : (stats.corriendo ? 'corriendo' : 'detenido');
  const icono = iconos[estado];

  console.log(`\n${icono} ${stats.nombre.toUpperCase()}`);
  console.log('━'.repeat(80));
  
  if (stats.pid) {
    console.log(`   PID: ${stats.pid}`);
  }

  if (stats.progreso !== null && stats.total !== null) {
    const barraLargo = 50;
    const barraProgreso = Math.round((stats.progreso / stats.total) * barraLargo);
    const barra = '█'.repeat(barraProgreso) + '░'.repeat(barraLargo - barraProgreso);
    console.log(`   Progreso: ${stats.progreso}/${stats.total} (${stats.porcentaje}%)`);
    console.log(`   ${barra}`);
  }

  if (stats.creados !== null) {
    console.log(`   ✅ Creados: ${stats.creados}`);
  }
  
  if (stats.actualizados !== null) {
    console.log(`   ✅ Actualizados: ${stats.actualizados}`);
  }

  if (stats.omitidos !== null) {
    console.log(`   ⏭️  Omitidos: ${stats.omitidos}`);
  }

  if (stats.errores !== null) {
    console.log(`   ❌ Errores: ${stats.errores}`);
  }

  if (stats.ultimaAccion) {
    console.log(`   📄 Última acción: ${stats.ultimaAccion}`);
  }

  if (stats.resumen) {
    console.log(`   ✅ Proceso completado`);
  } else if (!stats.corriendo && stats.existe) {
    console.log(`   ⚠️  Proceso detenido o finalizado`);
  }
}

// Mostrar resumen general
function mostrarResumenGeneral(statsArray) {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMEN GENERAL DE IMPORTACIONES');
  console.log('═'.repeat(80));

  const totales = {
    procesos: statsArray.length,
    corriendo: statsArray.filter(s => s.corriendo && !s.resumen).length,
    completados: statsArray.filter(s => s.resumen).length,
    detenidos: statsArray.filter(s => !s.corriendo && !s.resumen && s.existe).length,
  };

  console.log(`\n📦 Total de procesos: ${totales.procesos}`);
  console.log(`🟢 Corriendo: ${totales.corriendo}`);
  console.log(`✅ Completados: ${totales.completados}`);
  console.log(`🔴 Detenidos: ${totales.detenidos}`);

  const totalProcesados = statsArray
    .map(s => s.progreso || 0)
    .reduce((a, b) => a + b, 0);

  const totalItems = statsArray
    .map(s => s.total || 0)
    .reduce((a, b) => a + b, 0);

  if (totalItems > 0) {
    const porcentajeGeneral = Math.round((totalProcesados / totalItems) * 100);
    console.log(`\n📊 Progreso general: ${totalProcesados}/${totalItems} (${porcentajeGeneral}%)`);
  }

  console.log('\n' + '═'.repeat(80));
}

// Función principal
function monitorear() {
  // Limpiar pantalla
  process.stdout.write('\x1b[2J\x1b[0f');

  console.log('🔍 MONITOR DE IMPORTACIONES');
  console.log('═'.repeat(80));
  console.log(`⏰ ${new Date().toLocaleString()}`);
  console.log('═'.repeat(80));

  // Detectar PIDs
  detectarPIDs();

  // Leer logs y extraer estadísticas
  const stats = [];

  // Autores
  const logAutores = leerLog(LOGS.autores);
  const statsAutores = extraerEstadisticas('autores', logAutores);
  statsAutores.existe = logAutores.existe;
  stats.push(statsAutores);

  // Editoriales
  const logEditoriales = leerLog(LOGS.editoriales);
  const statsEditoriales = extraerEstadisticas('editoriales', logEditoriales);
  statsEditoriales.existe = logEditoriales.existe;
  stats.push(statsEditoriales);

  // Libros
  const logLibros = leerLog(LOGS.libros);
  const statsLibros = extraerEstadisticas('libros', logLibros);
  statsLibros.existe = logLibros.existe;
  stats.push(statsLibros);

  // Relaciones
  const logRelaciones = leerLog(LOGS.relaciones);
  const statsRelaciones = extraerEstadisticas('relaciones', logRelaciones);
  statsRelaciones.existe = logRelaciones.existe;
  stats.push(statsRelaciones);

  // Mostrar estados
  for (const stat of stats) {
    mostrarEstado(stat);
  }

  // Mostrar resumen general
  mostrarResumenGeneral(stats);

  // Instrucciones
  console.log('\n💡 Instrucciones:');
  console.log('   - Presiona Ctrl+C para salir');
  console.log('   - Usa --watch para actualización automática cada 5 segundos');
  console.log('   - Los logs están en /tmp/import-*.log');
}

// Modo watch (actualización automática)
const modoWatch = process.argv.includes('--watch') || process.argv.includes('-w');

if (modoWatch) {
  console.log('🔄 Modo watch activado. Actualizando cada 5 segundos...\n');
  
  setInterval(() => {
    monitorear();
  }, 5000);

  // Primera ejecución
  monitorear();
} else {
  // Ejecución única
  monitorear();
  
  console.log('\n💡 Ejecuta con --watch para actualización automática:');
  console.log('   node scripts/monitor-importaciones.mjs --watch');
}

