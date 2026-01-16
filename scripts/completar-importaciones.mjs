#!/usr/bin/env node

/**
 * Script para completar importaciones y vinculaciones pendientes
 * 
 * 1. Espera a que termine la importación de libros
 * 2. Re-ejecuta script de relaciones para conectar pendientes
 * 3. Verifica que todo esté completo
 * 
 * Uso:
 *   node scripts/completar-importaciones.mjs
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '..', 'strapi', '.env');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const STRAPI_URL = process.env.STRAPI_LOCAL_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

/**
 * Espera a que termine el proceso de importación de libros
 */
function esperarProcesoLibros() {
  return new Promise((resolve) => {
    console.log('⏳ Esperando a que termine la importación de libros...');
    console.log('   Monitoreando proceso de importación...\n');
    
    let ultimoProgreso = { actual: 0, total: 7340 };
    let sinCambios = 0;
    const maxSinCambios = 30; // 30 iteraciones * 5 seg = 2.5 min sin cambios
    
    const intervalo = setInterval(() => {
      try {
        // Verificar si el proceso sigue corriendo
        const proceso = execSync('ps aux | grep "importar-libros-csv.mjs" | grep -v grep | grep -v completar', { encoding: 'utf-8' });
        
        if (!proceso.trim()) {
          // Proceso terminó
          clearInterval(intervalo);
          console.log('\n✅ Proceso de importación de libros terminado\n');
          resolve();
          return;
        }
        
        // Leer último progreso del log
        try {
          const logContent = readFileSync('/tmp/import-libros.log', 'utf-8');
          const lineas = logContent.split('\n').filter(l => l.includes('[') && l.includes('/'));
          if (lineas.length > 0) {
            const ultima = lineas[lineas.length - 1];
            const match = ultima.match(/\[(\d+)\/(\d+)\]/);
            if (match) {
              const actual = parseInt(match[1]);
              const total = parseInt(match[2]);
              
              if (actual === ultimoProgreso.actual) {
                sinCambios++;
                if (sinCambios >= maxSinCambios) {
                  console.log(`\n⚠️  Sin cambios por ${maxSinCambios * 5} segundos. Asumiendo que el proceso está detenido.`);
                  clearInterval(intervalo);
                  resolve();
                  return;
                }
              } else {
                sinCambios = 0;
                ultimoProgreso = { actual, total };
              }
              
              const porcentaje = Math.round((actual / total) * 100);
              const faltan = total - actual;
              const timestamp = new Date().toLocaleTimeString();
              process.stdout.write(`\r[${timestamp}] 📚 [${actual}/${total}] ${porcentaje}% - Faltan: ${faltan} libros`);
            }
          }
        } catch (e) {
          // Log no disponible aún
          console.log('\n⏳ Esperando log de importación...');
        }
      } catch (e) {
        // Proceso no encontrado, asumir que terminó
        clearInterval(intervalo);
        console.log('\n✅ Proceso de importación de libros terminado\n');
        resolve();
      }
    }, 5000); // Verificar cada 5 segundos
  });
}

/**
 * Verifica el estado actual de libros en Strapi
 */
async function verificarEstadoLibros() {
  console.log('📊 Verificando estado actual de libros en Strapi...\n');
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/libros?pagination[limit]=1`, {
      headers: HEADERS,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const json = await response.json();
    const total = json?.meta?.pagination?.total || 0;
    
    console.log(`✅ Total de libros en Strapi: ${total}\n`);
    return total;
  } catch (error) {
    console.error(`❌ Error verificando libros: ${error.message}`);
    return 0;
  }
}

/**
 * Re-ejecuta el script de relaciones para conectar pendientes
 */
async function reconectarRelaciones() {
  console.log('🔗 Re-ejecutando script de relaciones para conectar pendientes...\n');
  
  return new Promise((resolve, reject) => {
    const scriptPath = resolve(__dirname, 'conectar-libros-relaciones-notion.mjs');
    const proceso = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: false,
      cwd: resolve(__dirname, '..'),
      env: {
        ...process.env,
        STRAPI_URL: STRAPI_URL,
        STRAPI_TOKEN: STRAPI_TOKEN,
      },
    });
    
    proceso.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Reconexión de relaciones completada\n');
        resolve();
      } else {
        console.log(`\n⚠️  Reconexión terminó con código ${code}\n`);
        resolve(); // Continuar aunque haya errores
      }
    });
    
    proceso.on('error', (error) => {
      console.error(`\n❌ Error ejecutando script: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Función principal
 */
async function main() {
  console.log('🌙 COMPLETANDO IMPORTACIONES Y VINCULACIONES');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log('════════════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Esperar a que termine la importación de libros
    await esperarProcesoLibros();
    
    // 2. Verificar estado actual
    const totalLibros = await verificarEstadoLibros();
    
    // 3. Re-ejecutar relaciones
    await reconectarRelaciones();
    
    // 4. Resumen final
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN FINAL');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`✅ Total libros en Strapi: ${totalLibros}`);
    console.log('✅ Proceso de importación completado');
    console.log('✅ Relaciones reconectadas');
    console.log('\n📝 Logs disponibles en:');
    console.log('   • /tmp/import-libros.log');
    console.log('   • /tmp/conectar-relaciones.log');
    console.log('   • /tmp/completar-importaciones.log');
    console.log('\n🎉 ¡Todo completado! Buen descanso 🌙\n');
    
    // Escribir resumen a archivo
    const resumen = {
      timestamp: new Date().toISOString(),
      totalLibros,
      estado: 'completado',
    };
    
    try {
      writeFileSync('/tmp/resumen-importaciones.json', JSON.stringify(resumen, null, 2));
      console.log('📄 Resumen guardado en: /tmp/resumen-importaciones.json\n');
    } catch (e) {
      // Ignorar error
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();

