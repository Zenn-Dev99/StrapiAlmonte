import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import pLimit from 'p-limit';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.STRAPI_TOKEN;
const DRY = process.env.DRY === '1';
const IMPORT_CONCURRENCY = Number.parseInt(process.env.IMPORT_CONCURRENCY || '5', 10) || 5;

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

function assertToken() {
  if (!TOKEN) throw new Error('FALTA IMPORT_TOKEN/STRAPI_TOKEN');
}

function loadCSV(csvPath) {
  const content = fs.readFileSync(csvPath);
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    record_delimiter: ['\r\n', '\n', '\r'],
  });
}

async function request(path, options = {}) {
  if (DRY && options.method && options.method !== 'GET') {
    return { dry: true, path, ...options };
  }
  const res = await fetch(`${API_URL}${path}`, {
    headers: HEADERS,
    ...options,
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status} ${errBody}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function findDocId(endpoint, field, value) {
  if (value === undefined || value === null || value === '') return null;
  const enc = encodeURIComponent(value);
  const json = await request(`/api/${endpoint}?filters[${field}][$eq]=${enc}&pagination[pageSize]=1`);
  const item = Array.isArray(json?.data) && json.data[0] ? json.data[0] : null;
  return item ? (item.documentId || item.id) : null;
}

async function upsert(endpoint, uniqueField, uniqueValue, data) {
  const existing = await findDocId(endpoint, uniqueField, uniqueValue);
  if (existing) {
    return request(`/api/${endpoint}/${existing}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }
  return request(`/api/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

function normalizeNombre(nombre) {
  return String(nombre || '').trim().toLowerCase();
}

async function importComunas() {
  const comunas = loadCSV('data/comuna.csv');
  const results = [];
  for (const row of comunas) {
    const data = {
      comuna_nombre: row.comuna_nombre,
      comuna_id: row.comuna_id ? Number(row.comuna_id) : undefined,
      provincia_nombre: row.provincia_nombre || null,
      provincia_id: row.provincia_id ? Number(row.provincia_id) : null,
      region_nombre: row.region_nombre || null,
      region_id: row.region_id ? Number(row.region_id) : null,
      zona_nombre: row.zona_nombre || null,
      zona_id: row.zona_id ? Number(row.zona_id) : null,
    };
    results.push(upsert('comunas', 'comuna_id', data.comuna_id, data));
  }
  await Promise.all(results);
  console.log(`✅ Comunas importadas/actualizadas: ${comunas.length}`);

  const map = new Map();
  let page = 1;
  const pageSize = 200;
  while (true) {
    const json = await request(`/api/comunas?fields[0]=comuna_nombre&fields[1]=comuna_id&pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
    const data = Array.isArray(json?.data) ? json.data : [];
    for (const it of data) {
      const id = it.documentId || it.id;
      const nombre = it.attributes?.comuna_nombre || it.comuna_nombre;
      if (id && nombre) {
        const key = normalizeNombre(nombre);
        map.set(key, id);
    }
    }
    const meta = json?.meta?.pagination;
    if (!meta || page >= meta.pageCount) break;
    page += 1;
  }
  return map;
}

function pickEstadoNombre(row) {
  const candidates = [
    row.estado_nombre,
    row.estado,
    row.estado_nombre_1_estado,
  ];
  const value = candidates.find((v) => typeof v === 'string' && v.trim());
  return value ? value.trim() : undefined;
}

function parseIntOrUndefined(value) {
  const num = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(num) ? num : undefined;
}

async function importColegios(comunaMap) {
  const colegios = loadCSV('data/colegios.csv');
  const limit = pLimit(IMPORT_CONCURRENCY);

  await Promise.all(
    colegios.map((row) =>
      limit(async () => {
        const rbd = parseIntOrUndefined(row.rbd);
        if (!rbd) return;

        const comunaNombre = row.comuna || row.comuna_nombre || row['Comuna'];
        const comunaId = comunaNombre ? comunaMap.get(normalizeNombre(comunaNombre)) : undefined;
        const estadoNombre = pickEstadoNombre(row);

          const data = {
          colegio_nombre: row.colegio_nombre || row.nombre || row.Nombre,
          rbd,
          dependencia: row.dependencia || undefined,
          ruralidad: row.ruralidad || undefined,
          estado_estab: row.estado_estab || undefined,
          estado_nombre: estadoNombre || undefined,
          region: row.region || row.region_nombre || undefined,
          provincia: row.provincia || row.provincia_nombre || undefined,
          zona: row.zona || row.zona_nombre || undefined,
        };

        if (comunaId) {
          data.comuna = { connect: [comunaId] };
        }

        await upsert('colegios', 'rbd', rbd, data);
      })
    )
  );

  console.log(`✅ Colegios importados/actualizados: ${colegios.length}`);
          }

async function importAll() {
  console.log('🚀 Iniciando importación...');
  assertToken();

  const comunaMap = await importComunas();
  await importColegios(comunaMap);

  console.log('🎉 Importación finalizada');
  if (!DRY) process.exit(0);
}

importAll().catch((error) => {
  console.error('❌ Error en importación:', error);
  process.exit(1);
});
