#!/usr/bin/env node

/**
 * Script para verificar id_editorial en libros y ver si están correctos
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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

async function main() {
  console.log('🔍 Verificando id_editorial en libros');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Obtener algunas editoriales clave
  const editorialesClave = [
    { nombre: 'Moraleja', idEsperado: '1' },
    { nombre: 'Editorial Fonts', idEsperado: '2' },
    { nombre: 'Santillana', idEsperado: '348' },
    { nombre: 'Oxford University Press', idEsperado: '100' },
  ];

  console.log('📖 Verificando IDs de editoriales clave:\n');
  const mapEditoriales = new Map();

  for (const editorialInfo of editorialesClave) {
    const params = new URLSearchParams({
      'filters[nombre_editorial][$eq]': editorialInfo.nombre,
    });
    const response = await fetch(`${STRAPI_URL}/api/editoriales?${params.toString()}`, {
      headers: HEADERS,
    });
    if (response.ok) {
      const json = await response.json();
      const editorial = json?.data?.[0];
      if (editorial) {
        const idActual = String(editorial.attributes?.id_editorial || editorial.id_editorial);
        const documentId = editorial.documentId || editorial.id;
        mapEditoriales.set(idActual, { nombre: editorialInfo.nombre, documentId });
        console.log(`   ${editorialInfo.nombre.padEnd(30)} → id_editorial: ${idActual} (esperado: ${editorialInfo.idEsperado}) ${idActual === editorialInfo.idEsperado ? '✅' : '⚠️'}`);
      }
    }
  }

  console.log('\n📚 Verificando libros con id_editorial de estas editoriales...\n');

  // Buscar libros con id_editorial que coincidan con los IDs antiguos o nuevos
  const idsParaVerificar = ['1', '2', '20', '348', '100'];
  let totalLibros = 0;
  let librosConIdEditorial = 0;
  let librosConIdIncorrecto = 0;
  const problemas = [];

  for (const idEditorial of idsParaVerificar) {
    const params = new URLSearchParams({
      'filters[id_editorial][$eq]': idEditorial,
      'pagination[pageSize]': '100',
    });
    const response = await fetch(`${STRAPI_URL}/api/libros?${params.toString()}`, {
      headers: HEADERS,
    });
    if (response.ok) {
      const json = await response.json();
      const libros = json?.data || [];
      totalLibros += libros.length;
      
      for (const libro of libros) {
        const idEditorialLibro = String(libro.attributes?.id_editorial || libro.id_editorial || '');
        const editorialRelacion = libro.attributes?.editorial?.data || libro.attributes?.editorial;
        const idEditorialRelacion = editorialRelacion ? String(editorialRelacion.attributes?.id_editorial || editorialRelacion.id_editorial || '') : null;
        
        if (idEditorialLibro) {
          librosConIdEditorial++;
          
          // Verificar si el id_editorial del libro coincide con el id_editorial de la relación
          if (idEditorialRelacion && idEditorialLibro !== idEditorialRelacion) {
            librosConIdIncorrecto++;
            const nombreLibro = libro.attributes?.nombre_libro || libro.nombre_libro || 'Sin nombre';
            problemas.push({
              libro: nombreLibro,
              idEditorialLibro,
              idEditorialRelacion,
              documentId: libro.documentId || libro.id,
            });
          }
        }
      }
    }
  }

  console.log(`📊 Resumen:`);
  console.log(`   Total libros verificados: ${totalLibros}`);
  console.log(`   Libros con id_editorial: ${librosConIdEditorial}`);
  console.log(`   Libros con id_editorial incorrecto: ${librosConIdIncorrecto}`);

  if (problemas.length > 0) {
    console.log(`\n⚠️  Libros con id_editorial que no coincide con la relación:`);
    problemas.slice(0, 10).forEach(p => {
      console.log(`   - "${p.libro.substring(0, 40)}" → id_editorial: ${p.idEditorialLibro}, relación: ${p.idEditorialRelacion}`);
    });
    if (problemas.length > 10) {
      console.log(`   ... y ${problemas.length - 10} más`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

