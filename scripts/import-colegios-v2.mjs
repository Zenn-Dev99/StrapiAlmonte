// scripts/import-colegios-v2.mjs
// Importa colegios con componentes de contacto usando el nuevo modelo simplificado

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import pLimit from 'p-limit';

const STRAPI_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN;
const CONCURRENCY = Number.parseInt(process.env.IMPORT_CONCURRENCY || '3', 10) || 3;
const CSV_PATH = process.argv[2] || 'data/csv/import_contactos/colegios_importar.csv';
const DRY = process.env.DRY === '1';

if (!TOKEN) {
  console.error('❌ Falta IMPORT_TOKEN / STRAPI_TOKEN (usa DRY=1 si quieres dry-run).');
  process.exit(1);
}

function normalizeNombre(nombre) {
  return String(nombre || '').trim().toLowerCase();
}

function loadCSV(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`No existe el CSV: ${filePath}`);
  const content = fs.readFileSync(filePath);
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    record_delimiter: ['\r\n', '\n', '\r'],
  });
}

async function request(path, options = {}) {
  if (DRY && options.method && options.method !== 'GET') {
    return { dry: true, path, ...options };
  }
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} -> ${res.status} ${body}`);
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

async function preloadComunas() {
  const map = new Map();
  let page = 1;
  const pageSize = 500;
  while (true) {
    const json = await request(`/api/comunas?fields[0]=comuna_nombre&fields[1]=comuna_id&fields[2]=provincia_nombre&fields[3]=provincia_id&fields[4]=region_nombre&fields[5]=region_id&fields[6]=zona_nombre&fields[7]=zona_id&pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const it of items) {
      const id = it.documentId || it.id;
      const attrs = it.attributes || {};
      const nombre = attrs.comuna_nombre || it.comuna_nombre;
      if (!id || !nombre) continue;
      const key = normalizeNombre(nombre);
      map.set(key, {
        id,
        comuna_nombre: nombre,
        comuna_id: attrs.comuna_id || it.comuna_id,
        provincia_nombre: attrs.provincia_nombre || it.provincia_nombre,
        provincia_id: attrs.provincia_id || it.provincia_id,
        region_nombre: attrs.region_nombre || it.region_nombre,
        region_id: attrs.region_id || it.region_id,
        zona_nombre: attrs.zona_nombre || it.zona_nombre,
        zona_id: attrs.zona_id || it.zona_id,
      });
    }
    const meta = json?.meta?.pagination;
    if (!meta || page >= meta.pageCount) break;
    page += 1;
  }
  return map;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'si', 'sí'].includes(v)) return true;
  if (['0', 'false', 'f', 'no', 'n'].includes(v)) return false;
  return undefined;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function compact(obj) {
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  });
  return out;
}

function buildTelefonos(row, max = 5) {
  const telefonos = [];
  for (let i = 1; i <= max; i++) {
    const raw = row[`tel_${i}_telefono_raw`];
    const tipo = row[`tel_${i}_tipo`];
    const estado = row[`tel_${i}_estado`];
    const principal = parseBoolean(row[`tel_${i}_principal`]);
    const fijoOMovil = row[`tel_${i}_fijo_o_movil`];
    const vigenteHasta = row[`tel_${i}_vigente_hasta`];

    const data = compact({
      telefono_raw: raw,
      telefono_norm: row[`tel_${i}_telefono_norm`] || normalizePhone(raw),
      tipo,
      estado,
      principal,
      fijo_o_movil: fijoOMovil,
      vigente_hasta: vigenteHasta,
    });

    if (Object.keys(data).length) telefonos.push(data);
  }
  return telefonos;
}

function buildEmails(row, max = 5) {
  const emails = [];
  for (let i = 1; i <= max; i++) {
    const email = row[`email_${i}_email`];
    const tipo = row[`email_${i}_tipo`];
    const estado = row[`email_${i}_estado`];
    const principal = parseBoolean(row[`email_${i}_principal`]);
    const vigenteHasta = row[`email_${i}_vigente_hasta`];

    const data = compact({
      email,
      tipo,
      estado,
      principal,
      vigente_hasta: vigenteHasta,
    });

    if (Object.keys(data).length) emails.push(data);
  }
  return emails;
}

function buildDirecciones(row, max = 3) {
  const direcciones = [];
  for (let i = 1; i <= max; i++) {
    const data = compact({
      direccion_principal_envio_facturacion: row[`dir_${i}_direccion_principal_envio_facturacion`],
      nombre_calle: row[`dir_${i}_nombre_calle`],
      numero_calle: row[`dir_${i}_numero_calle`],
      complemento_direccion: row[`dir_${i}_complemento_direccion`],
      tipo_direccion: row[`dir_${i}_tipo_direccion`],
    });

    const comunaNombre = row[`dir_${i}_comuna_nombre`];
    const comunaDoc = row[`dir_${i}_comuna_documentId`];
    const comunaInfo = comunaDoc ? { id: comunaDoc } : comunaGeoFromNombre(comunaNombre);
    if (comunaInfo?.id) {
      data.comuna = { connect: [comunaInfo.id] };
    }

    if (Object.keys(data).length) direcciones.push(data);
  }
  return direcciones;
}

let comunaLookup = null;
function comunaGeoFromNombre(nombre) {
  if (!comunaLookup) return null;
  if (!nombre) return null;
  const key = normalizeNombre(nombre);
  return comunaLookup.get(key) || null;
}

async function importColegios(rows) {
  const limit = pLimit(CONCURRENCY);

  await Promise.all(rows.map((row) => limit(async () => {
    const rbd = Number.parseInt(String(row.rbd ?? row.RBD ?? '').trim(), 10);
    if (!Number.isFinite(rbd)) return;

    const comunaNombre = row.comuna_nombre || row.Comuna || row.comuna || row['dir_1_comuna_nombre'];
    const comunaInfo = comunaGeoFromNombre(comunaNombre);

    const data = compact({
      colegio_nombre: row.colegio_nombre || row.nombre || row.Nombre,
      rbd,
      dependencia: row.dependencia,
      ruralidad: row.ruralidad,
      estado_estab: row.estado_estab,
      estado_nombre: row.estado_nombre || row.estado,
      region: row.region || row.region_nombre || comunaInfo?.region_nombre,
      provincia: row.provincia || row.provincia_nombre || comunaInfo?.provincia_nombre,
      zona: row.zona || row.zona_nombre || comunaInfo?.zona_nombre,
    });

    if (comunaInfo?.id) {
      data.comuna = { connect: [comunaInfo.id] };
    }

    const telefonos = buildTelefonos(row);
    if (telefonos.length) data.telefonos = telefonos;

    const emails = buildEmails(row);
    if (emails.length) data.emails = emails;

    const direcciones = buildDirecciones(row);
    if (direcciones.length) data.direcciones = direcciones;

    await upsert('colegios', 'rbd', rbd, data);
  })));
}

async function main() {
  console.log('== Import Colegios v2 (modelo simplificado) ==');
  console.log('CSV:', CSV_PATH);
  console.log('STRAPI_URL:', STRAPI_URL);
  console.log('CONCURRENCY:', CONCURRENCY);
  console.log('DRY run:', DRY ? 'YES' : 'NO');

  comunaLookup = await preloadComunas();
  console.log(`✅ Comunas precargadas: ${comunaLookup.size}`);

  const rows = loadCSV(CSV_PATH);
  console.log(`⏳ Procesando filas: ${rows.length}`);
  await importColegios(rows);

  console.log('🎉 Importación completada');
}

main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
