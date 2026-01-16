#!/usr/bin/env node

/**
 * Script maestro para importar todos los datos relacionados con libros
 * en el orden correcto: editoriales -> sellos -> autores -> libros
 * 
 * Uso:
 *   node scripts/importar-todos-libros.mjs
 * 
 * O para importar solo un tipo:
 *   IMPORTAR=editoriales node scripts/importar-todos-libros.mjs
 *   IMPORTAR=sellos node scripts/importar-todos-libros.mjs
 *   IMPORTAR=autores node scripts/importar-todos-libros.mjs
 *   IMPORTAR=libros node scripts/importar-todos-libros.mjs
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPTS_DIR = resolve(__dirname);
const CSV_DIR = resolve(__dirname, '..', 'data', 'csv', 'import');

// Configuración de importaciones
const IMPORTACIONES = [
  {
    nombre: 'Editoriales',
    archivo: 'editoriales2.csv',
    script: 'importar-editoriales2-csv.mjs',
    descripcion: 'Editoriales base para sellos y libros'
  },
  {
    nombre: 'Sellos',
    archivo: 'sellos3.csv',
    script: 'importar-sellos3-csv.mjs',
    descripcion: 'Sellos editoriales (requiere editoriales)'
  },
  {
    nombre: 'Autores',
    archivo: 'autores3.csv',
    script: 'importar-autores-csv.mjs',
    descripcion: 'Autores de libros (Persona o Empresa)'
  },
  {
    nombre: 'Libros',
    archivo: 'libros.csv',
    script: 'importar-libros-csv.mjs',
    descripcion: 'Libros (requiere editoriales, sellos y autores)'
  }
];

function ejecutarScript(scriptPath, archivoCsv) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  Ejecutando: ${scriptPath}`);
    console.log(`   Archivo: ${archivoCsv}`);
    console.log('─'.repeat(60));

    const proceso = spawn('node', [scriptPath, archivoCsv], {
      stdio: 'inherit',
      shell: false,
      cwd: resolve(__dirname, '..'),
    });

    proceso.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ Completado exitosamente (código ${code})`);
        resolve(code);
      } else {
        console.error(`\n❌ Finalizado con error (código ${code})`);
        reject(new Error(`Script falló con código ${code}`));
      }
    });

    proceso.on('error', (error) => {
      console.error(`\n❌ Error ejecutando script: ${error.message}`);
      reject(error);
    });
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📚 Importador Maestro de Datos de Libros');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Verificar qué se debe importar
  const queImportar = process.env.IMPORTAR?.toLowerCase();
  const importaciones = queImportar
    ? IMPORTACIONES.filter(imp => imp.nombre.toLowerCase() === queImportar)
    : IMPORTACIONES;

  if (importaciones.length === 0) {
    console.error(`❌ No se encontró tipo de importación: ${queImportar}`);
    console.error('Tipos disponibles:', IMPORTACIONES.map(i => i.nombre.toLowerCase()).join(', '));
    process.exit(1);
  }

  console.log(`\n📋 Importaciones programadas: ${importaciones.map(i => i.nombre).join(' → ')}`);
  console.log(`\n💡 Para importar solo un tipo, usa: IMPORTAR=<tipo> node scripts/importar-todos-libros.mjs`);
  console.log(`   Ejemplo: IMPORTAR=autores node scripts/importar-todos-libros.mjs\n`);

  let exitos = 0;
  let errores = 0;

  for (let i = 0; i < importaciones.length; i++) {
    const importacion = importaciones[i];
    const scriptPath = resolve(SCRIPTS_DIR, importacion.script);
    const archivoCsv = resolve(CSV_DIR, importacion.archivo);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${importaciones.length}] ${importacion.nombre}`);
    console.log(`   ${importacion.descripcion}`);
    console.log(`${'='.repeat(60)}`);

    try {
      await ejecutarScript(scriptPath, archivoCsv);
      exitos++;
      
      // Pequeña pausa entre importaciones
      if (i < importaciones.length - 1) {
        console.log('\n⏳ Esperando 2 segundos antes de la siguiente importación...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`\n❌ Error en importación de ${importacion.nombre}:`, error.message);
      errores++;
      
      // Preguntar si continuar
      const continuar = process.env.CONTINUAR_ON_ERROR === '1';
      if (!continuar) {
        console.error('\n⚠️  Deteniendo importación debido a error.');
        console.error('   Para continuar a pesar de errores, usa: CONTINUAR_ON_ERROR=1');
        process.exit(1);
      } else {
        console.log('\n⚠️  Continuando con las siguientes importaciones...');
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen Final:');
  console.log(`   ✅ Exitosas: ${exitos}`);
  console.log(`   ❌ Con errores: ${errores}`);
  console.log(`   📦 Total: ${importaciones.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errores > 0) {
    console.error('⚠️  Algunas importaciones tuvieron errores. Revisa los logs arriba.');
    process.exit(1);
  } else {
    console.log('🎉 ¡Todas las importaciones se completaron exitosamente!');
  }
}

main().catch((error) => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

