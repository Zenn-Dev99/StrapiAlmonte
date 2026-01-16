// scripts/import-colegio-sostenedores.mjs
// Crea/actualiza sostenedores y vincula colegios (por RBD) en Strapi a partir de un CSV

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import http from 'http';
import https from 'https';

const STRAPI_URL = process.env.STRAPI_URL || process.env.API_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CSV_PATH = process.argv[2] || 'data/imports/sostenedores20251008.csv';
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 6);
const RETRIES = Number(process.env.IMPORT_RETRIES || 5);
const DELAY_MS = Number(process.env.IMPORT_DELAY_MS || 0);
const DRY = process.env.DRY === '1';
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === '1';

if (!STRAPI_TOKEN && !VALIDATE_ONLY) {
  console.error('❌ Falta STRAPI_TOKEN / IMPORT_TOKEN. Exporta IMPORT_TOKEN o usa VALIDATE_ONLY=1.');
  process.exit(1);
}

const ALLOWED_TIPOS = new Set([
  'Municipalidad',
  'Corporación Municipal',
  'Servicio Local de Educación',
  'SLEP',
  'Particular',
  'Corporación',
  'Fundación',
  'Otro',
]);

const agent = STRAPI_URL.startsWith('https')
  ? new https.Agent({ keepAlive: true, maxSockets: 200 })
  : new http.Agent({ keepAlive: true, maxSockets: 200 });

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  return headers;
}

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      if (attempt > 0 && DELAY_MS > 0) await sleep(DELAY_MS);
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err?.message || '';
      const statusMatch = message.match(/\s(\d{3})\b/);
      const status = statusMatch ? Number(statusMatch[1]) : null;
      const retryable = status === 429 || (status && status >= 500);
      if (!retryable || attempt === RETRIES - 1) break;
      const backoff = 600 * (attempt + 1) + Math.floor(Math.random() * 300);
      console.warn(`⚠️  ${label} falló (intento ${attempt + 1}/${RETRIES}). Reintentando en ${backoff} ms...`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

async function apiGet(pathname) {
  if (VALIDATE_ONLY) return { data: [] };
  return withRetry(async () => {
    const res = await fetch(`${STRAPI_URL}${pathname}`, { headers: authHeaders(), agent });
    if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status} ${await res.text().catch(() => '')}`);
    return res.json();
  }, `GET ${pathname}`);
}

async function apiPost(pathname, body) {
  if (DRY || VALIDATE_ONLY) return { dry: true, method: 'POST', path: pathname, body };
  return withRetry(async () => {
    const res = await fetch(`${STRAPI_URL}${pathname}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      agent,
    });
    if (!res.ok) throw new Error(`POST ${pathname} -> ${res.status} ${await res.text().catch(() => '')}`);
    return res.json();
  }, `POST ${pathname}`);
}

async function apiPut(pathname, body) {
  if (DRY || VALIDATE_ONLY) return { dry: true, method: 'PUT', path: pathname, body };
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
  const rows = [];
  const parser = input.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      record_delimiter: ['\r\n', '\n', '\r'],
    })
  );
  for await (const row of parser) rows.push(row);
  return rows;
}

const sostenedorByRut = new Map(); // rut_completo -> { id, documentId, attrs }
async function preloadSostenedores(rutCompletos) {
  if (VALIDATE_ONLY) return 0;
  const uniq = Array.from(new Set(rutCompletos.filter(Boolean)));
  let loaded = 0;
  for (let i = 0; i < uniq.length; i += 100) {
    const group = uniq.slice(i, i + 100);
    const filters = group.map((v) => `filters[rut_completo][$in]=${encodeURIComponent(v)}`).join('&');
    const path = `/api/colegio-sostenedores?${filters}&pagination[pageSize]=200`;
    const json = await apiGet(path);
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const item of items) {
      const attrs = item.attributes || {};
      const docId = item.documentId || item.id;
      const rutCompleto = attrs.rut_completo || item.rut_completo;
      if (docId && rutCompleto) {
        sostenedorByRut.set(rutCompleto, {
          id: docId,
          attrs,
        });
        loaded++;
      }
    }
  }
  return loaded;
}

const colegioByRbd = new Map(); // rbd -> { id, nombre }
async function preloadColegios(rbdValues) {
  if (VALIDATE_ONLY) return 0;
  const uniq = Array.from(new Set(rbdValues.filter((v) => v != null)));
  let loaded = 0;
  for (let i = 0; i < uniq.length; i += 100) {
    const group = uniq.slice(i, i + 100);
    const filters = group.map((v) => `filters[rbd][$in]=${encodeURIComponent(v)}`).join('&');
    const path = `/api/colegios?${filters}&fields[0]=rbd&fields[1]=colegio_nombre&pagination[pageSize]=200`;
    const json = await apiGet(path);
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const item of items) {
      const attrs = item.attributes || {};
      const docId = item.documentId || item.id;
      const rbd = attrs.rbd ?? item.rbd;
      if (docId && rbd != null) {
        colegioByRbd.set(Number(rbd), { id: docId, nombre: attrs.colegio_nombre || item.colegio_nombre || '' });
        loaded++;
      }
    }
  }
  return loaded;
}

function parseTipo(raw) {
  if (!raw) return undefined;
  const value = raw.trim();
  const map = new Map([
    ['CORPORACIÓN MUNICIPAL', 'Corporación Municipal'],
    ['CORPORACION MUNICIPAL', 'Corporación Municipal'],
    ['MUNICIPALIDAD', 'Municipalidad'],
    ['MUNICIPAL', 'Municipalidad'],
    ['SLEP', 'SLEP'],
    ['SERVICIO LOCAL DE EDUCACIÓN', 'Servicio Local de Educación'],
    ['SERVICIO LOCAL DE EDUCACION', 'Servicio Local de Educación'],
    ['PARTICULAR', 'Particular'],
    ['CORPORACIÓN', 'Corporación'],
    ['CORPORACION', 'Corporación'],
    ['FUNDACIÓN', 'Fundación'],
    ['FUNDACION', 'Fundación'],
    ['OTRO', 'Otro'],
  ]);
  const key = value.toUpperCase();
  const mapped = map.get(key) || value;
  return ALLOWED_TIPOS.has(mapped) ? mapped : 'Otro';
}

function extractRbdList(row) {
  const rbdValues = [];
  Object.keys(row)
    .filter((k) => /^RBD_\d{3}/i.test(k))
    .sort()
    .forEach((key) => {
      const raw = (row[key] || '').trim();
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) rbdValues.push(parsed);
    });
  return rbdValues;
}

function buildSostenedorPayload(row) {
  const rutStr = (row.rut_sostenedor || '').trim();
  const rut = rutStr ? Number(rutStr) : null;
  const dv = (row.dv_rut || '').trim().toUpperCase();
  const rutCompleto = (row.rut_completo || '').trim() || (rut ? `${rut}-${dv}` : null);
  const razonRaw = (row.razon_social || row.razon || '').trim();
  const fantasia = (row.nombre_fantasia || '').trim() || undefined;
  const giro = (row.giro || '').trim() || undefined;
  const tipo = parseTipo(row.tipo_sostenedor);

  if (!rut || !rutCompleto || !dv) {
    throw new Error(`Fila inválida (rut/dv/rut_completo obligatorios). Datos: ${JSON.stringify(row)}`);
  }

  const payload = {
    rut_sostenedor: rut,
    dv_rut: dv,
    rut_completo: rutCompleto,
    razon_social: razonRaw || fantasia || `Sostenedor ${rutCompleto}`,
  };
  if (fantasia) payload.nombre_fantasia = fantasia;
  if (giro) payload.giro = giro;
  if (tipo) payload.tipo_sostenedor = tipo;
  return { payload, rutCompleto };
}

async function ensureSostenedor(row, stats) {
  const { payload, rutCompleto } = buildSostenedorPayload(row);
  const existing = sostenedorByRut.get(payload.rut_completo);
  if (existing) {
    stats.sostenedoresEncontrados += 1;
    const updates = {};
    for (const key of ['razon_social', 'nombre_fantasia', 'giro', 'tipo_sostenedor', 'dv_rut']) {
      if (payload[key] && payload[key] !== existing.attrs[key]) updates[key] = payload[key];
    }
    if (payload.rut_sostenedor !== existing.attrs?.rut_sostenedor) updates.rut_sostenedor = payload.rut_sostenedor;
    if (Object.keys(updates).length === 0) return { id: existing.id, attrs: existing.attrs };

    if (VALIDATE_ONLY || DRY) {
      stats.sostenedoresActualizados += 1;
      return { id: existing.id, attrs: { ...existing.attrs, ...updates } };
    }

    const res = await apiPut(`/api/colegio-sostenedores/${existing.id}`, { data: updates });
    const updatedAttrs = res?.data?.attributes || {};
    sostenedorByRut.set(rutCompleto, { id: res?.data?.documentId || res?.data?.id || existing.id, attrs: updatedAttrs });
    stats.sostenedoresActualizados += 1;
    return { id: res?.data?.documentId || res?.data?.id || existing.id, attrs: updatedAttrs };
  }

  const body = {
    data: {
      ...payload,
      publishedAt: new Date().toISOString(),
    },
  };

  if (VALIDATE_ONLY || DRY) {
    const fakeId = `dry-${payload.rut_completo}`;
    sostenedorByRut.set(rutCompleto, { id: fakeId, attrs: payload });
    stats.sostenedoresCreados += 1;
    return { id: fakeId, attrs: payload };
  }

  const res = await apiPost('/api/colegio-sostenedores', body);
  const docId = res?.data?.documentId || res?.data?.id;
  const attrs = res?.data?.attributes || {};
  if (!docId) throw new Error(`No se obtuvo documentId al crear sostenedor ${payload.rut_completo}`);
  sostenedorByRut.set(rutCompleto, { id: docId, attrs });
  stats.sostenedoresCreados += 1;
  return { id: docId, attrs };
}

async function connectColegio(rbd, colegioId, sostenedorDocId, stats) {
  const body = { data: { sostenedor: { connect: [sostenedorDocId] } } };
  await apiPut(`/api/colegios/${colegioId}`, body);
  stats.colegiosAsignados += 1;
  return true;
}

async function main() {
  const stats = {
    sostenedoresCreados: 0,
    sostenedoresActualizados: 0,
    sostenedoresEncontrados: 0,
    colegiosAsignados: 0,
    colegiosNoEncontrados: [],
    conflictosRbd: [],
  };

  try {
    console.log('== Importador de Sostenedores ==');
    console.log('CSV:', path.resolve(CSV_PATH));
    console.log('STRAPI_URL:', STRAPI_URL);
    console.log('CONCURRENCY:', CONCURRENCY);
    console.log('RETRIES:', RETRIES);
    if (DELAY_MS > 0) console.log('DELAY_MS:', DELAY_MS);

    const rows = await readCSV(CSV_PATH);
    console.log('Filas en CSV:', rows.length);

    const rutCompList = rows.map((row) => (row.rut_completo || '').trim()).filter(Boolean);
    if (!VALIDATE_ONLY) {
      const preloaded = await preloadSostenedores(rutCompList);
      console.log(`Sostenedores precargados: ${preloaded}`);
    }

    const assignments = new Map(); // rbd -> { sostenedorId, sostenedorRut, sostenedorNombre }

    for (const row of rows) {
      const sost = await ensureSostenedor(row, stats);
      const rbdList = extractRbdList(row);
      const rutCompleto = (row.rut_completo || '').trim();
      const razon = (row.razon_social || '').trim();
      rbdList.forEach((rbd) => {
        if (!assignments.has(rbd)) {
          assignments.set(rbd, { sostenedorId: sost.id, rutCompleto, razon });
        } else if (assignments.get(rbd).sostenedorId !== sost.id) {
          stats.conflictosRbd.push({ rbd, previo: assignments.get(rbd), nuevo: { sostenedorId: sost.id, rutCompleto, razon } });
        }
      });
    }

    const uniqueRbds = Array.from(assignments.keys());
    console.log('Total RBD a vincular:', uniqueRbds.length);
    if (!VALIDATE_ONLY) {
      const colegiosPre = await preloadColegios(uniqueRbds);
      console.log(`Colegios precargados: ${colegiosPre}`);
    }

    const limit = pLimit(CONCURRENCY);
    const tasks = [];

    for (const [rbd, info] of assignments.entries()) {
      const colegio = colegioByRbd.get(Number(rbd));
      if (!colegio) {
        stats.colegiosNoEncontrados.push({ rbd, sostenedorRut: info.rutCompleto, sostenedor: info.razon });
        continue;
      }
      if (VALIDATE_ONLY || DRY) {
        stats.colegiosAsignados += 1;
        continue;
      }
      tasks.push(
        limit(() =>
          connectColegio(rbd, colegio.id, info.sostenedorId, stats).catch((err) => {
            console.error(`❌ Error asignando RBD ${rbd} -> ${info.sostenedorId}:`, err?.message || err);
          })
        )
      );
    }

    await Promise.all(tasks);

    console.log('---- Resumen ----');
    console.log('Sostenedores creados:', stats.sostenedoresCreados);
    console.log('Sostenedores actualizados:', stats.sostenedoresActualizados);
    console.log('Sostenedores existentes sin cambio:', stats.sostenedoresEncontrados);
    console.log('Colegios asignados:', stats.colegiosAsignados);
    console.log('Colegios sin encontrar:', stats.colegiosNoEncontrados.length);
    if (stats.colegiosNoEncontrados.length) {
      console.log('Primeros faltantes:', stats.colegiosNoEncontrados.slice(0, 10));
    }
    console.log('Conflictos de RBD (duplicados):', stats.conflictosRbd.length);
    if (stats.conflictosRbd.length) {
      console.log('Ejemplos de conflicto:', stats.conflictosRbd.slice(0, 5));
    }
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
