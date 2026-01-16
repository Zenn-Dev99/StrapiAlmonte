#!/usr/bin/env node

/**
 * Script para limpiar valores inválidos en el campo "grado" de cursos
 * Convierte valores válidos (1-8) a integer y pone NULL en valores inválidos
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

async function main() {
  try {
    console.log('🔄 Limpiando valores inválidos en campo "grado" de cursos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Cargar Strapi
    const strapiPath = resolve(__dirname, '..');
    process.chdir(strapiPath);

    const { createStrapi } = require('@strapi/strapi');
    const app = await createStrapi();

    await app.load();

    console.log('📊 Analizando valores actuales de "grado"...\n');

    // Obtener todos los cursos
    const cursos = await app.db.query('api::curso.curso').findMany({
      select: ['id', 'documentId', 'grado'],
      limit: 10000,
    });

    console.log(`   Total de cursos encontrados: ${cursos.length}\n`);

    // Analizar valores
    const valoresUnicos = new Set();
    const cursosConProblemas = [];
    const cursosParaActualizar = [];

    cursos.forEach((curso) => {
      const grado = curso.grado;
      valoresUnicos.add(String(grado || 'null'));

      // Verificar si es válido
      if (grado === null || grado === undefined) {
        // Ya está bien (NULL)
        return;
      }

      // Intentar convertir a número
      const gradoNum = Number(grado);
      if (isNaN(gradoNum) || String(grado).trim() === '') {
        // No es un número válido o está vacío
        cursosConProblemas.push({
          id: curso.id,
          documentId: curso.documentId,
          gradoActual: grado,
        });
        cursosParaActualizar.push({
          id: curso.id,
          documentId: curso.documentId,
          gradoNuevo: null, // Poner NULL para valores inválidos
        });
      } else if (gradoNum < 1 || gradoNum > 8 || gradoNum % 1 !== 0) {
        // Es un número pero fuera del rango válido o no es entero
        cursosConProblemas.push({
          id: curso.id,
          documentId: curso.documentId,
          gradoActual: grado,
        });
        cursosParaActualizar.push({
          id: curso.id,
          documentId: curso.documentId,
          gradoNuevo: null,
        });
      } else {
        // Es válido (1-8), pero puede estar como string
        const gradoInt = Math.floor(gradoNum);
        const gradoStr = String(grado).trim();
        if (gradoStr !== String(gradoInt)) {
          // Está como string pero debería ser número
          cursosParaActualizar.push({
            id: curso.id,
            documentId: curso.documentId,
            gradoNuevo: gradoInt,
          });
        }
      }
    });

    console.log('📋 Valores únicos encontrados:');
    Array.from(valoresUnicos).sort().forEach((val) => {
      console.log(`   - "${val}"`);
    });

    console.log(`\n⚠️  Cursos con valores inválidos: ${cursosConProblemas.length}`);
    if (cursosConProblemas.length > 0) {
      console.log('\n   Primeros 10 cursos con problemas:');
      cursosConProblemas.slice(0, 10).forEach((c) => {
        console.log(`   - ID: ${c.id}, grado actual: "${c.gradoActual}"`);
      });
    }

    console.log(`\n🔧 Cursos que necesitan actualización: ${cursosParaActualizar.length}`);

    if (cursosParaActualizar.length === 0) {
      console.log('\n✅ No hay cursos que necesiten actualización');
      await app.destroy();
      return;
    }

    // Actualizar cursos
    console.log('\n🔄 Actualizando cursos...\n');

    let actualizados = 0;
    let errores = 0;

    for (const cursoUpdate of cursosParaActualizar) {
      try {
        await app.db.query('api::curso.curso').update({
          where: { id: cursoUpdate.id },
          data: {
            grado: cursoUpdate.gradoNuevo,
          },
        });

        actualizados++;
        if (actualizados % 100 === 0) {
          console.log(`   Procesados ${actualizados}/${cursosParaActualizar.length}...`);
        }
      } catch (error) {
        console.error(`   ❌ Error actualizando curso ${cursoUpdate.id}:`, error.message);
        errores++;
      }
    }

    console.log(`\n✅ Actualización completada:`);
    console.log(`   - Actualizados: ${actualizados}`);
    console.log(`   - Errores: ${errores}`);

    await app.destroy();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Limpieza completada exitosamente');
    console.log('⚠️  IMPORTANTE: Ahora puedes cambiar el schema de "grado" a integer');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }
}

main().catch(console.error);
