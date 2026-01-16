// scripts/import-colaboradores.mjs
// Carga Colaboradores vinculados a Persona, con email de login y rol principal.
// CSV esperado (columnas flexibles):
//   persona_documentId | persona_rut | persona_nombre | email_login | empresa_nombre | rol_principal | auth_provider | activo

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CSV_PATH = process.argv[2] || 'data/csv/import_contactos/colaboradores.csv';
const STATE = process.env.PUBLICATION_STATE || 'preview';
const DRY = process.env.DRY === '1';

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

function norm(s) { return String(s ?? '').trim(); }
function key(s){ return norm(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }
function keyRut(s){ return norm(s).toLowerCase().replace(/[^0-9k]/g,''); }

function loadCsv(file) {
  if (!fs.existsSync(file)) throw new Error(`No existe CSV: ${file}`);
  const buf = fs.readFileSync(file);
  return parse(buf, { columns: true, bom: true, skip_empty_lines: true, trim: true });
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

async function buildPersonasCache() {
  const byDoc = new Map();
  const byRut = new Map();
  const byName = new Map();
  let page = 1; const size = 200;
  while (true) {
    const q = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': String(size), publicationState: STATE });
    const json = await getJson(`/api/personas?${q.toString()}`);
    const arr = json?.data || [];
    if (!arr.length) break;
    for (const it of arr) {
      const id = it.documentId || it.id; const a = it.attributes || it;
      if (id) byDoc.set(String(id), id);
      if (a.rut) { byRut.set(key(a.rut), id); byRut.set(keyRut(a.rut), id); }
      const full = norm(a.nombre_completo || `${a.nombres || ''} ${a.primer_apellido || ''} ${a.segundo_apellido || ''}`);
      if (full) byName.set(key(full), id);
    }
    const meta = json?.meta?.pagination; if (!meta || meta.page >= meta.pageCount) break; page += 1;
  }
  return { byDoc, byRut, byName };
}

async function ensureOrganizacionByName(nombre) {
  const n = norm(nombre); if (!n) return null;
  const q = new URLSearchParams({ 'filters[nombre][$eq]': n, 'pagination[pageSize]': '1' });
  const json = await getJson(`/api/organizaciones?${q.toString()}`);
  const item = json?.data?.[0];
  if (item) return item.documentId || item.id;
  const res = await postJson('/api/organizaciones', { data: { nombre: n, tipo: 'empresa', publishedAt: new Date().toISOString() } });
  return res?.data?.documentId || res?.data?.id || null;
}

async function upsertColaborador({ personaId, email_login, empresaId, rol_principal, auth_provider, activo }) {
  const q = new URLSearchParams({ 'filters[email_login][$eq]': email_login, 'pagination[pageSize]': '1' });
  const existing = await getJson(`/api/colaboradores?${q.toString()}`);
  const item = existing?.data?.[0];
  const data = {
    persona: personaId ? { connect: [personaId] } : undefined,
    email_login,
    empresa: empresaId ? { connect: [empresaId] } : undefined,
    rol_principal: rol_principal || undefined,
    auth_provider: auth_provider || 'google',
    activo: typeof activo === 'boolean' ? activo : true,
    publishedAt: new Date().toISOString(),
  };
  if (item) {
    const id = item.documentId || item.id;
    return putJson(`/api/colaboradores/${id}`, { data });
  }
  return postJson('/api/colaboradores', { data });
}

function normalizeRow(row) {
  const out = {};
  for (const [k,v] of Object.entries(row)) {
    const nk = key(k).replace(/\s+/g, '').replace(/_/g, '');
    if (nk === 'personadocumentid' || nk === 'personadoc' || nk === 'persona_id') out.persona_documentId = v;
    else if (nk === 'personarut' || nk === 'rut') out.persona_rut = v;
    else if (nk === 'personanombre' || nk === 'nombre' || nk === 'nombrecompleto') out.persona_nombre = v;
    else if (nk === 'emaillogin' || nk === 'email' || nk === 'correo') out.email_login = v;
    else if (nk === 'empresanombre' || nk === 'empresa') out.empresa_nombre = v;
    else if (nk === 'rolprincipal' || nk === 'rol') out.rol_principal = key(v);
    else if (nk === 'authprovider' || nk === 'auth') out.auth_provider = key(v);
    else if (nk === 'activo') out.activo = String(v).trim();
  }
  return out;
}

function toBool(v){ const s = String(v ?? '').trim().toLowerCase(); if(!s) return undefined; if(['1','true','si','sí','y','yes'].includes(s)) return true; if(['0','false','no','n'].includes(s)) return false; return undefined; }

async function main() {
  console.log('== Import Colaboradores ==');
  console.log('CSV:', CSV_PATH);
  const rows = loadCsv(CSV_PATH).map(normalizeRow);
  const personas = await buildPersonasCache();

  let ok=0, missPersona=0, fail=0;
  for (const r of rows) {
    try {
      let personaId = null;
      if (r.persona_documentId) personaId = String(r.persona_documentId);
      if (!personaId && r.persona_rut) personaId = personas.byRut.get(key(r.persona_rut)) || personas.byRut.get(keyRut(r.persona_rut));
      if (!personaId && r.persona_nombre) personaId = personas.byName.get(key(r.persona_nombre));
      if (!personaId) { missPersona++; continue; }

      const email = norm(r.email_login);
      if (!email) { continue; }
      const empresaId = r.empresa_nombre ? await ensureOrganizacionByName(r.empresa_nombre) : null;
      const rol = ['comercial','soporte','comprobaciones','otro'].includes(r.rol_principal) ? r.rol_principal : undefined;
      const authp = ['google','strapi','otro'].includes(r.auth_provider) ? r.auth_provider : 'google';
      const activo = toBool(r.activo);

      await upsertColaborador({ personaId, email_login: email, empresaId, rol_principal: rol, auth_provider: authp, activo });
      ok++;
    } catch(e) {
      fail++;
      console.error('❌ Error fila:', e?.message || e);
    }
  }

  console.log(`\n✔ Listo. Creados/actualizados: ${ok}, sin persona: ${missPersona}, fallas: ${fail}`);
}

main().catch((e) => { console.error('❌ Error fatal:', e?.message || e); process.exit(1); });
