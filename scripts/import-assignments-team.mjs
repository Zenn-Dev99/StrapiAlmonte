// scripts/import-assignments-team.mjs
// Asigna colegios a ejecutivos (comercial, soporte1, soporte2) + prioridad y orden
// CSV esperado: rbd, comercial, soporte1, soporte2, prioridad, orden

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import pLimit from 'p-limit';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 8);
const DRY = process.env.DRY === '1';
const CSV_PATH = process.argv[2] || 'data/csv/import_contactos/asignaciones_equipo.csv';
const PERIOD_NAME = process.env.ASSIGN_PERIOD_NAME || process.env.PERIOD_NAME || new Date().toISOString().slice(0,10);
const STATE = process.env.PUBLICATION_STATE || 'preview';

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

function normalize(s) { return String(s || '').trim(); }
function normKey(s) { return normalize(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }

function loadCsv(file) {
  if (!fs.existsSync(file)) throw new Error(`No existe CSV: ${file}`);
  const buf = fs.readFileSync(file);
  return parse(buf, { columns: true, skip_empty_lines: true, bom: true, trim: true });
}

function normalizeHeadersRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = normKey(String(k)).replace(/\s+/g, '').replace(/_/g, '');
    // Normaliza alias comunes
    if (nk === 'rbd') out.rbd = v;
    else if (nk === 'comercial' || nk === 'ejecutivocomercial') out.comercial = v;
    else if (nk === 'comercialrut' || nk === 'rutcomercial') out.comercial_rut = v;
    else if (nk === 'soporte1' || nk === 'soporteuno' || nk === 'verificacion') out.soporte1 = v;
    else if (nk === 'soporte1rut' || nk === 'rutsoporte1') out.soporte1_rut = v;
    else if (nk === 'soporte2' || nk === 'soportedos' || nk === 'aprobacion' || nk === 'comprobaciones') out.soporte2 = v;
    else if (nk === 'soporte2rut' || nk === 'rutsoporte2') out.soporte2_rut = v;
    else if (nk === 'prioridad' || nk === 'priority') out.prioridad = v;
    else if (nk === 'orden' || nk === 'order' || nk === 'ranking') out.orden = v;
    else out[nk] = v; // conserva el resto por si acaso
  }
  return out;
}

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!res.ok) { const body = await res.text(); throw new Error(`GET ${path} -> ${res.status} ${body}`); }
  return res.json();
}
async function postJson(path, data) {
  if (DRY) return { dry: true, method: 'POST', path, data };
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.text(); throw new Error(`POST ${path} -> ${res.status} ${body}`); }
  return res.json();
}
async function putJson(path, data) {
  if (DRY) return { dry: true, method: 'PUT', path, data };
  const res = await fetch(`${API_URL}${path}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.text(); throw new Error(`PUT ${path} -> ${res.status} ${body}`); }
  return res.json();
}

async function ensurePeriodo(nombre) {
  const q = new URLSearchParams({ 'filters[nombre][$eq]': nombre, 'pagination[pageSize]': '1' });
  const json = await getJson(`/api/cartera-periodos?${q.toString()}`);
  const item = json?.data?.[0];
  if (item) return item.documentId || item.id;
  const res = await postJson('/api/cartera-periodos', { data: { nombre, estado: 'vigente', publishedAt: new Date().toISOString() } });
  return res?.data?.documentId || res?.data?.id;
}

async function buildPersonaMap() {
  const byName = new Map();
  const byRut = new Map();
  let page = 1;
  const size = 200;
  while (true) {
    const q = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': String(size), 'fields[0]': 'nombre_completo', 'fields[1]': 'nombres', 'fields[2]': 'primer_apellido', 'fields[3]': 'segundo_apellido', 'fields[4]': 'rut', publicationState: STATE });
    const json = await getJson(`/api/personas?${q.toString()}`);
    const data = json?.data || [];
    if (!data.length) break;
    for (const it of data) {
      const attrs = it.attributes || it;
      const id = it.documentId || it.id;
      const full = normalize(attrs.nombre_completo);
      if (full) byName.set(normKey(full), id);
      const composed = normalize(`${attrs.nombres || ''} ${attrs.primer_apellido || ''}`);
      if (composed) byName.set(normKey(composed), id);
      const rut = normalize(attrs.rut).replace(/[^0-9kK]/g, '').toLowerCase();
      if (rut) byRut.set(rut, id);
    }
    const meta = json?.meta?.pagination;
    if (!meta || meta.page >= meta.pageCount) break;
    page += 1;
  }
  return { byName, byRut };
}

async function buildColegioMap() {
  const byRbd = new Map();
  let page = 1; const size = 200;
  while (true) {
    const q = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': String(size), 'fields[0]': 'rbd' });
    const json = await getJson(`/api/colegios?${q.toString()}`);
    const arr = json?.data || [];
    if (!arr.length) break;
    for (const it of arr) { const id = it.documentId || it.id; const rbd = (it.attributes?.rbd ?? it.rbd); if (id && rbd != null) byRbd.set(Number(rbd), id); }
    const meta = json?.meta?.pagination; if (!meta || meta.page >= meta.pageCount) break; page += 1;
  }
  return byRbd;
}

function pri(value) { const v = normKey(value); if (['alta','media','baja'].includes(v)) return v; return ''; }

async function findOrCreateAsignacion({ periodoId, colegioId, ejecutivoId, prioridad, rol, orden }) {
  // Busca por periodo+colegio+ejecutivo y actualiza/crea dejando rol/orden estructurados
  const q = new URLSearchParams({
    'filters[periodo][documentId][$eq]': periodoId,
    'filters[colegio][documentId][$eq]': colegioId,
    'filters[ejecutivo][documentId][$eq]': ejecutivoId,
    'pagination[pageSize]': '10',
  });
  const existing = await getJson(`/api/cartera-asignaciones?${q.toString()}`);
  const list = existing?.data || [];
  const found = list.find((it) => (it.attributes?.rol ?? it.rol) === rol) || list[0];

  const data = {
    periodo: { connect: [periodoId] },
    colegio: { connect: [colegioId] },
    ejecutivo: { connect: [ejecutivoId] },
    prioridad: prioridad || undefined,
    rol,
    orden: Number.isFinite(Number(orden)) ? Number(orden) : undefined,
    estado: 'activa',
    is_current: true,
    publishedAt: new Date().toISOString(),
  };

  const fallbackNotas = [`rol=${rol}`, Number.isFinite(Number(orden)) ? `orden=${orden}` : null].filter(Boolean).join('; ');

  async function doPutOrPost(d) {
    if (found) {
      const id = found.documentId || found.id;
      return putJson(`/api/cartera-asignaciones/${id}`, { data: d });
    }
    return postJson('/api/cartera-asignaciones', { data: d });
  }

  try {
    return await doPutOrPost(data);
  } catch (e) {
    const msg = String(e?.message || '');
    if (/Invalid key .*rol|Invalid key .*orden/i.test(msg) || /Invalid key/i.test(msg)) {
      const fb = { ...data };
      delete fb.rol; delete fb.orden;
      fb.notas = fallbackNotas || undefined;
      return await doPutOrPost(fb);
    }
    throw e;
  }
}

async function main() {
  console.log('== Import Asignaciones de Equipo ==');
  console.log('CSV:', CSV_PATH);
  console.log('Periodo:', PERIOD_NAME);
  let rows = loadCsv(CSV_PATH);
  // Normaliza cabeceras por fila a claves conocidas
  rows = rows.map(normalizeHeadersRow);
  const periodoId = await ensurePeriodo(PERIOD_NAME);
  const { byName: personaByName, byRut: personaByRut } = await buildPersonaMap();
  const colegios = await buildColegioMap();

  let ok = 0, fail = 0, skip = 0, missPersona = 0, missColegio = 0;
  const limit = pLimit(CONCURRENCY);
  await Promise.all(rows.map((row, idx) => limit(async () => {
    try {
      const rbd = Number(normalize(row.rbd));
      const colegioId = colegios.get(rbd);
      if (!colegioId) { missColegio++; skip++; return; }
      const prioridad = pri(row.prioridad);
      const orden = normalize(row.orden);
      const asigns = [
        { role: 'comercial', persona: row.comercial, rut: row.comercial_rut },
        { role: 'soporte1', persona: row.soporte1, rut: row.soporte1_rut },
        { role: 'soporte2', persona: row.soporte2, rut: row.soporte2_rut },
      ];
      for (const a of asigns) {
        let personaId = null;
        const rutKey = normalize(a.rut || '').replace(/[^0-9kK]/g, '').toLowerCase();
        if (rutKey) personaId = personaByRut.get(rutKey) || null;
        if (!personaId) {
          const key = normKey(a.persona);
          personaId = personaByName.get(key) || null;
        }
        if (!personaId) { missPersona++; continue; }
        await findOrCreateAsignacion({ periodoId, colegioId, ejecutivoId: personaId, prioridad, rol: a.role, orden });
        ok++;
      }
    } catch (e) {
      fail++;
      console.error(`❌ Fila ${idx + 1}:`, e?.message || e);
    }
  })));
  console.log(`\n🎉 Listo. OK=${ok}, SKIP=${skip}, FAIL=${fail}`);
  if (missColegio) console.warn(`  • Colegios no encontrados: ${missColegio}`);
  if (missPersona) console.warn(`  • Personas no encontradas: ${missPersona} (revisar nombres)`);
}

main().catch((e) => { console.error('❌ Error fatal:', e?.message || e); process.exit(1); });
