#!/usr/bin/env node

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pLimit from 'p-limit';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

try {
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
} catch (err) {
  // .env no existe o no se puede leer
}

const PROD_URL = process.env.STRAPI_PROD_URL || 'https://strapi.moraleja.cl';
const PROD_TOKEN = process.env.STRAPI_PROD_TOKEN || process.env.IMPORT_TOKEN;
const LOCAL_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const LOCAL_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const DRY_RUN = process.env.DRY === '1';
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY ?? '5', 10) || 5;
const PAGE_SIZE = Number.parseInt(process.env.PAGE_SIZE ?? '100', 10) || 100;

if (!PROD_TOKEN) {
  console.error('❌ Falta STRAPI_PROD_TOKEN o IMPORT_TOKEN para conectarse a producción');
  process.exit(1);
}

if (!LOCAL_TOKEN && !DRY_RUN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN para conectarse a local');
  process.exit(1);
}

const PROD_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${PROD_TOKEN}`,
};

const LOCAL_HEADERS = LOCAL_TOKEN ? {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${LOCAL_TOKEN}`,
} : {};

async function fetchFromProd(path) {
  const res = await fetch(`${PROD_URL}${path}`, {
    headers: PROD_HEADERS,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Prod ${path} -> ${res.status} ${text}`);
  }

  return res.json();
}

async function createInLocal(path, data) {
  if (DRY_RUN) {
    console.log(`DRY-RUN: POST ${LOCAL_URL}${path}`);
    console.log(JSON.stringify(data, null, 2));
    return { data: { id: 'dry-run', documentId: 'dry-run' } };
  }

  const res = await fetch(`${LOCAL_URL}${path}`, {
    method: 'POST',
    headers: LOCAL_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local POST ${path} -> ${res.status} ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function updateInLocal(path, data) {
  if (DRY_RUN) {
    console.log(`DRY-RUN: PUT ${LOCAL_URL}${path}`);
    console.log(JSON.stringify(data, null, 2));
    return { data: { id: 'dry-run', documentId: 'dry-run' } };
  }

  const res = await fetch(`${LOCAL_URL}${path}`, {
    method: 'PUT',
    headers: LOCAL_HEADERS,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local PUT ${path} -> ${res.status} ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function checkExistsInLocal(isbn) {
  if (DRY_RUN) return null;

  try {
    const res = await fetch(`${LOCAL_URL}/api/libros?filters[isbn_libro][$eq]=${isbn}`, {
      headers: LOCAL_HEADERS,
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json.data?.[0] || null;
  } catch {
    return null;
  }
}

async function importLibro(libroProd, limit) {
  return limit(async () => {
    const isbn = libroProd.attributes?.isbn_libro || libroProd.isbn_libro;
    const nombre = libroProd.attributes?.nombre_libro || libroProd.nombre_libro;

    if (!isbn) {
      console.log(`↷ Saltando libro sin ISBN: ${nombre || 'Sin nombre'}`);
      return { status: 'skipped', reason: 'Sin ISBN' };
    }

    // Verificar si ya existe en local
    const existing = await checkExistsInLocal(isbn);
    if (existing) {
      console.log(`↷ Ya existe en local: ${nombre} (ISBN: ${isbn})`);
      return { status: 'skipped', reason: 'Ya existe' };
    }

    // Preparar datos para local
    const libroData = {
      data: {
        isbn_libro: isbn,
        nombre_libro: nombre,
        subtitulo_libro: libroProd.attributes?.subtitulo_libro || libroProd.subtitulo_libro || null,
        nombre_completo_autor: libroProd.attributes?.nombre_completo_autor || libroProd.nombre_completo_autor || null,
        externalIds: libroProd.attributes?.externalIds || libroProd.externalIds || null,
        // Nota: Las relaciones (editorial, autor, etc.) se pueden mapear después si es necesario
        // Por ahora solo importamos los campos básicos
      },
    };

    try {
      const result = await createInLocal('/api/libros', libroData);
      console.log(`✅ Importado: ${nombre} (ISBN: ${isbn})`);
      return { status: 'created', isbn, nombre };
    } catch (error) {
      console.error(`❌ Error importando ${nombre}: ${error.message}`);
      return { status: 'error', isbn, nombre, error: error.message };
    }
  });
}

async function main() {
  console.log('🚀 Importando libros desde producción a local...\n');
  console.log(`Producción: ${PROD_URL}`);
  console.log(`Local: ${LOCAL_URL}`);
  console.log(`DRY_RUN: ${DRY_RUN ? 'SÍ' : 'NO'}`);
  console.log(`Concurrencia: ${CONCURRENCY}\n`);

  const limit = pLimit(CONCURRENCY);
  let page = 1;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    while (true) {
      console.log(`📄 Obteniendo página ${page}...`);
      
      const params = new URLSearchParams({
        'pagination[page]': String(page),
        'pagination[pageSize]': String(PAGE_SIZE),
        'sort[0]': 'id:asc',
        'populate': '*', // Obtener todas las relaciones
      });

      const json = await fetchFromProd(`/api/libros?${params.toString()}`);
      const libros = json?.data || [];
      
      console.log(`   Respuesta de API: ${JSON.stringify({ total: json?.meta?.pagination?.total || 0, page: json?.meta?.pagination?.page || 0, pageCount: json?.meta?.pagination?.pageCount || 0 })}`);

      if (libros.length === 0) {
        console.log('\n✅ No hay más libros para importar');
        break;
      }

      console.log(`   Encontrados ${libros.length} libros en esta página\n`);

      const tasks = libros.map((libro) => importLibro(libro, limit));
      const results = await Promise.all(tasks);

      for (const result of results) {
        if (result.status === 'created') {
          totalImported++;
        } else if (result.status === 'skipped') {
          totalSkipped++;
        } else if (result.status === 'error') {
          totalErrors++;
        }
      }

      const pagination = json?.meta?.pagination;
      if (!pagination || page >= pagination.pageCount) {
        break;
      }

      page++;
    }

    console.log('\n📊 Resumen:');
    console.log(`  ✅ Importados: ${totalImported}`);
    console.log(`  ↷ Saltados: ${totalSkipped}`);
    console.log(`  ❌ Errores: ${totalErrors}`);

    if (DRY_RUN) {
      console.log('\n(DRY-RUN) No se realizaron cambios en local.');
    }

  } catch (error) {
    console.error('\n❌ Error general:', error.message);
    process.exit(1);
  }
}

main();

