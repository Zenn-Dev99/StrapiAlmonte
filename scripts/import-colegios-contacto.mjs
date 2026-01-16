// scripts/import-colegios-contacto.mjs
// Importa teléfonos (hasta 2), website y dirección principal desde un CSV reducido.
// Requiere un CSV con columnas:
// rbd, colegio_nombre, website_urls, telefono_1_raw, telefono_1_tipo, telefono_2_raw, telefono_2_tipo,
// direcciones_calle, direcciones_numero, direcciones_tipo, direcciones_clasificacion

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import http from 'http';
import https from 'https';

const STRAPI_URL = process.env.STRAPI_URL || process.env.API_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CSV_PATH = process.argv[2] || 'data/exports/colegios_strapi_export_20251009.csv';
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 6);
const RETRIES = Number(process.env.IMPORT_RETRIES || 5);
const DELAY_MS = Number(process.env.IMPORT_DELAY_MS || 0);
const DRY = process.env.DRY === '1';
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === '1';
const IMPORT_SOURCE = process.env.IMPORT_SOURCE || `Actualización ${new Date().toISOString().slice(0, 10)}`;

if (!STRAPI_TOKEN && !VALIDATE_ONLY) {
  console.error('❌ Falta STRAPI_TOKEN / IMPORT_TOKEN. Exporta IMPORT_TOKEN o usa VALIDATE_ONLY=1.');
  process.exit(1);
}

const PHONE_TYPES = new Set(['Personal', 'Laboral', 'Institucional']);
const DIRECCION_TIPOS = new Set(['Casa', 'Departamento', 'Colegio', 'Comercial']);
const DIRECCION_CLASIFICACIONES = new Set(['Principal', 'Envío', 'Facturación']);

const agent = STRAPI_URL.startsWith('https')
  ? new https.Agent({ keepAlive: true, maxSockets: 200 })
  : new http.Agent({ keepAlive: true, maxSockets: 200 });

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      if (DELAY_MS > 0 && attempt > 0) await sleep(DELAY_MS);
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      const statusMatch = msg.match(/\s(\d{3})\b/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      const isRetryable = statusCode && (statusCode === 429 || statusCode >= 500);
      if (!isRetryable || attempt === RETRIES - 1) break;
      const backoff = 500 * (attempt + 1) + Math.floor(Math.random() * 250);
      console.warn(`⚠️  ${label} falló (intento ${attempt + 1}/${RETRIES}). Reintentando en ${backoff} ms...`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  return headers;
}

async function apiGet(pathname) {
  if (VALIDATE_ONLY) return { data: [] };
  return withRetry(async () => {
    const res = await fetch(`${STRAPI_URL}${pathname}`, { headers: authHeaders(), agent });
    if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status} ${await res.text().catch(() => '')}`);
    return res.json();
  }, `GET ${pathname}`);
}

async function apiPut(pathname, body) {
  if (DRY || VALIDATE_ONLY) {
    return { dry: true, method: 'PUT', path: pathname, body };
  }
  return withRetry(async () => {
    const res = await fetch(`${STRAPI_URL}${pathname}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
      agent,
    });
    if (!res.ok) throw new Error(`PUT ${pathname} -> ${res.status} ${await res.text().catch(() => '')}`);
    return res.json();
  }, `PUT ${pathname}`);
}

async function readCSV(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`No existe el CSV: ${filePath}`);
  const input = fs.createReadStream(filePath);
  const records = [];
  const parser = input.pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true, bom: true, record_delimiter: ['\r\n', '\n', '\r'] })
  );
  for await (const row of parser) records.push(row);
  return records;
}

const existingByRbd = new Map();
async function preloadColegiosByRbd(rbdValues) {
  if (VALIDATE_ONLY) return 0;
  const uniq = Array.from(new Set(rbdValues.filter((v) => v != null)));
  if (uniq.length === 0) return 0;
  let loaded = 0;
  for (let i = 0; i < uniq.length; i += 100) {
    const group = uniq.slice(i, i + 100);
    const inParams = group.map((v) => `filters[rbd][$in]=${encodeURIComponent(v)}`).join('&');
    const pathQ = `/api/colegios?${inParams}&fields[0]=rbd&fields[1]=colegio_nombre&pagination[pageSize]=200`;
    const json = await apiGet(pathQ);
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const it of items) {
      const attrs = it.attributes || {};
      const id = it.documentId || it.id;
      const rbd = attrs.rbd ?? it.rbd;
      if (id && rbd != null) {
        existingByRbd.set(Number(rbd), { id, nombre: attrs.colegio_nombre || it.colegio_nombre || null });
        loaded++;
      }
    }
  }
  return loaded;
}

function normalizePhoneCL(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length <= 9) return digits;
  return digits.slice(-9);
}

function buildTelefonos(row) {
  const telefonos = [];
  for (let i = 1; i <= 2; i++) {
    const raw = (row[`telefono_${i}_raw`] || '').trim();
    const tipo = (row[`telefono_${i}_tipo`] || '').trim();
    if (!raw) continue;
    if (tipo && !PHONE_TYPES.has(tipo)) {
      console.warn(`⚠️  Tipo de teléfono inválido "${tipo}" (RBD ${row.rbd}); se mantendrá vacío.`);
    }
    const telefono = {
      telefono_raw: raw,
      telefono_norm: normalizePhoneCL(raw),
      estado: 'Por Verificar',
      principal: i === 1,
      fuente: IMPORT_SOURCE,
    };
    if (PHONE_TYPES.has(tipo)) telefono.tipo = tipo;
    telefonos.push(telefono);
  }
  return telefonos;
}

function buildDirecciones(row) {
  const calle = (row.direcciones_calle || '').trim();
  const numero = (row.direcciones_numero || '').trim();
  const tipo = (row.direcciones_tipo || '').trim();
  const clasificacion = (row.direcciones_clasificacion || '').trim();
  if (!calle && !numero && !tipo && !clasificacion) return [];
  const direccion = {
    nombre_calle: calle || undefined,
    numero_calle: numero || undefined,
    estado: 'Por Verificar',
  };
  if (tipo) {
    if (DIRECCION_TIPOS.has(tipo)) direccion.tipo_direccion = tipo;
    else console.warn(`⚠️  Tipo de dirección inválido "${tipo}" (RBD ${row.rbd}); se omitirá.`);
  }
  if (clasificacion) {
    if (DIRECCION_CLASIFICACIONES.has(clasificacion)) direccion.direccion_principal_envio_facturacion = clasificacion;
    else console.warn(`⚠️  Clasificación de dirección inválida "${clasificacion}" (RBD ${row.rbd}); se omitirá.`);
  }
  return [direccion];
}

function buildWebsites(row) {
  const raw = (row.website_urls || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/[|;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  return parts.map((website) => ({
    website,
    estado: 'Por Verificar',
    fuente: IMPORT_SOURCE,
  }));
}

async function processRow(row) {
  const rbd = Number(String(row.rbd || '').trim());
  if (!rbd) {
    console.warn('⚠️  Fila sin RBD, se omite:', row);
    return { skipped: true, reason: 'sin_rbd' };
  }
  const payload = {};
  const nombre = (row.colegio_nombre || '').trim();
  if (nombre) payload.colegio_nombre = nombre;

  const telefonos = buildTelefonos(row);
  if (telefonos.length) payload.telefonos = telefonos;

  const direcciones = buildDirecciones(row);
  if (direcciones.length) payload.direcciones = direcciones;

  const websites = buildWebsites(row);
  if (websites.length) payload.Website = websites;

  if (Object.keys(payload).length === 0) {
    return { skipped: true, reason: 'sin_datos', rbd };
  }

  if (VALIDATE_ONLY) {
    return { validated: true, rbd, payload };
  }

  const existing = existingByRbd.get(rbd);
  if (!existing) {
    console.warn(`⚠️  No se encontró colegio con RBD ${rbd} en Strapi.`);
    return { skipped: true, reason: 'no_encontrado', rbd };
  }

  const body = { data: payload };
  const id = existing.id;
  const result = await apiPut(`/api/colegios/${id}`, body);
  return { updated: true, rbd, id, result };
}

async function main() {
  try {
    console.log('== Importador de contacto para Colegios ==');
    console.log('CSV:', path.resolve(CSV_PATH));
    console.log('STRAPI_URL:', STRAPI_URL);
    console.log('CONCURRENCY:', CONCURRENCY);
    console.log('RETRIES:', RETRIES);
    if (DELAY_MS > 0) console.log('DELAY_MS:', DELAY_MS);
    const rows = await readCSV(CSV_PATH);
    console.log('Filas en CSV:', rows.length);
    const rbds = rows.map((row) => Number(String(row.rbd || '').trim())).filter(Boolean);
    console.log('RBDs distintos en CSV:', new Set(rbds).size);
    if (!VALIDATE_ONLY) {
      const found = await preloadColegiosByRbd(rbds);
      console.log(`Colegios precargados desde Strapi: ${found}`);
    }

    const limit = pLimit(CONCURRENCY);
    let updated = 0;
    let skipped = 0;
    const tasks = rows.map((row) =>
      limit(() =>
        processRow(row)
          .then((res) => {
            if (res?.updated) updated += 1;
            else skipped += 1;
            return res;
          })
          .catch((err) => {
            console.error(`❌ Error procesando RBD ${row.rbd}:`, err?.message || err);
            return { error: err, rbd: row.rbd };
          })
      )
    );
    await Promise.all(tasks);
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️  Omitidos: ${skipped}`);
    if (DRY) console.log('💡 DRY=1, no se realizaron cambios en Strapi.');
    if (VALIDATE_ONLY) console.log('💡 VALIDATE_ONLY=1, solo validación sin llamadas a Strapi.');
  } catch (err) {
    console.error('❌ Error general:', err?.message || err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
