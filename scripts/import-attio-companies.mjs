#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337';
const TOKEN =
  process.env.IMPORT_TOKEN ?? process.env.STRAPI_TOKEN ?? process.env.ADMIN_TOKEN;
const DRY = process.env.DRY === '1';

if (!TOKEN) {
  console.error(
    '❌ Falta token. Define IMPORT_TOKEN, STRAPI_TOKEN o ADMIN_TOKEN en el entorno.'
  );
  process.exit(1);
}

const [, , inputPath] = process.argv;

if (!inputPath) {
  console.error('Uso: node scripts/import-attio-companies.mjs <ruta_csv>');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), inputPath);

if (!fs.existsSync(absolutePath)) {
  console.error(`❌ No encontré el archivo ${absolutePath}`);
  process.exit(1);
}

const csvBuffer = fs.readFileSync(absolutePath);
const records = parse(csvBuffer, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const statusMap = {
  'por verificar': 'Por Verificar',
  'verificado': 'Verificado',
  'aprobado': 'Aprobado',
  'rechazado': 'Rechazado',
};

const simpleStatus = {
  'por verificar': 'Por Verificar',
  'verificado': 'Verificado',
  'aprobado': 'Aprobado',
};

async function findColegioByAttioId(attioId) {
  const url = new URL('/api/colegios', STRAPI_URL);
  url.searchParams.set('filters[attio_company_id][$eq]', attioId);
  url.searchParams.set('pagination[pageSize]', '1');

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Error buscando colegio (${attioId}): ${res.status} ${res.statusText}`
    );
  }

  const json = await res.json();
  if (Array.isArray(json?.data) && json.data.length > 0) {
    return json.data[0];
  }
  return null;
}

async function createColegio(payload) {
  if (DRY) {
    console.log('DRY=1 → crearíamos colegio:', payload);
    return;
  }

  const res = await fetch(new URL('/api/colegios', STRAPI_URL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error creando colegio: ${res.status} ${res.statusText}\n${body}`);
  }
}

async function updateColegio(id, payload) {
  if (DRY) {
    console.log(`DRY=1 → actualizaríamos colegio ${id}:`, payload);
    return;
  }

  const res = await fetch(new URL(`/api/colegios/${id}`, STRAPI_URL), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Error actualizando colegio ${id}: ${res.status} ${res.statusText}\n${body}`
    );
  }
}

function normalizaEstado(value) {
  if (!value) return undefined;
  const key = value.toString().trim().toLowerCase();
  return statusMap[key] ?? 'Por Verificar';
}

function normalizaEstadoSimple(value) {
  if (!value) return undefined;
  const key = value.toString().trim().toLowerCase();
  return simpleStatus[key] ?? 'Por Verificar';
}

function parseRbd(value) {
  if (!value) return undefined;
  const num = Number.parseInt(value.toString(), 10);
  if (Number.isNaN(num)) return undefined;
  return num;
}

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of records) {
    const attioId = row['Record ID']?.trim();
    const nombre = row['Name']?.trim();
    const rbd = parseRbd(row['# rbd']);

    if (!attioId || !nombre) {
      skipped += 1;
      console.log('↷ Saltando fila sin Record ID o Name', row);
      continue;
    }

    if (!rbd) {
      skipped += 1;
      console.log(`↷ Saltando ${nombre} (${attioId}) sin RBD válido`);
      continue;
    }

    const estadoNombre = normalizaEstado(row['Nombre Estado']);
    const estado = normalizaEstadoSimple(row['Nombre Estado']);

    const metadata = {};
    if (row['Domains']) metadata.domains = row['Domains'];
    if (row['Last interaction']) metadata.lastInteraction = row['Last interaction'];
    if (row['Connection strength']) metadata.connectionStrength = row['Connection strength'];

    const payload = {
      rbd,
      colegio_nombre: nombre,
      attio_company_id: attioId,
      estado_nombre: estadoNombre,
      estado,
    };

    if (Object.keys(metadata).length > 0) {
      payload.attio_metadata = metadata;
    }

    try {
      const existing = await findColegioByAttioId(attioId);
      if (existing) {
        await updateColegio(existing.id, payload);
        updated += 1;
        console.log(`✔ Actualizado -> ${nombre} (${attioId})`);
      } else {
        await createColegio(payload);
        created += 1;
        console.log(`➕ Creado -> ${nombre} (${attioId})`);
      }
    } catch (error) {
      errors += 1;
      console.error(`❌ Error procesando ${nombre} (${attioId}):`, error.message);
    }
  }

  console.log('\nResumen:');
  console.log(`  ➕ Creados: ${created}`);
  console.log(`  🔁 Actualizados: ${updated}`);
  console.log(`  ↷ Saltados: ${skipped}`);
  console.log(`  ❌ Errores: ${errors}`);

  if (DRY) {
    console.log('\nDRY=1 → no se realizaron cambios en Strapi.');
  }
}

main().catch((err) => {
  console.error('Fallo general:', err);
  process.exit(1);
});

