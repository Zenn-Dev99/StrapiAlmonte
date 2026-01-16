// scripts/import-personas-simple.mjs
// Crea o actualiza Personas por RUT con un CSV simple.
// Columnas sugeridas: rut,nombres,primer_apellido,segundo_apellido,nombre_completo,genero,origen,activo,email_1_email,email_2_email

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CSV_PATH = process.argv[2] || 'data/csv/import_contactos/personas_colaboradores_emp.csv';
const DRY = process.env.DRY === '1';

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

function norm(s){ return String(s ?? '').trim(); }
function has(s){ return norm(s) !== ''; }
function normalizeGenero(s){ const v = norm(s).toLowerCase(); if (!v) return undefined; if (['m','h','hombre','male','masculino'].includes(v)) return 'Hombre'; if (['f','mujer','female','femenino'].includes(v)) return 'Mujer'; return undefined; }
function normalizeRut(s){ return norm(s).replace(/[^0-9kK-]/g,'').toUpperCase(); }

function loadCsv(file){ if (!fs.existsSync(file)) throw new Error(`No existe CSV: ${file}`); const buf = fs.readFileSync(file); return parse(buf, { columns: true, bom: true, skip_empty_lines: true, trim: true }); }

async function getJson(path){ const r = await fetch(`${API_URL}${path}`, { headers: HEADERS }); if(!r.ok){ const body = await r.text(); throw new Error(`GET ${path} -> ${r.status} ${body}`); } return r.json(); }
async function postJson(path, data){ if (DRY) return { dry:true, method:'POST', path, data }; const r = await fetch(`${API_URL}${path}`, { method:'POST', headers: HEADERS, body: JSON.stringify(data) }); if(!r.ok){ const body = await r.text(); throw new Error(`POST ${path} -> ${r.status} ${body}`); } return r.json(); }
async function putJson(path, data){ if (DRY) return { dry:true, method:'PUT', path, data }; const r = await fetch(`${API_URL}${path}`, { method:'PUT', headers: HEADERS, body: JSON.stringify(data) }); if(!r.ok){ const body = await r.text(); throw new Error(`PUT ${path} -> ${r.status} ${body}`); } return r.json(); }

async function upsertPersona(row){
  const rut = normalizeRut(row.rut);
  if (!rut) throw new Error('Fila sin RUT');
  const q = new URLSearchParams({ 'filters[rut][$eq]': rut, 'pagination[pageSize]': '1' });
  const found = await getJson(`/api/personas?${q.toString()}`);
  const item = found?.data?.[0];

  const emails = [];
  const e1 = norm(row.email_1_email).toLowerCase(); if (e1) emails.push({ email: e1, principal: true });
  const e2 = norm(row.email_2_email).toLowerCase(); if (e2) emails.push({ email: e2, principal: !e1 });

  const data = {
    rut,
    nombres: has(row.nombres) ? row.nombres : undefined,
    primer_apellido: has(row.primer_apellido) ? row.primer_apellido : undefined,
    segundo_apellido: has(row.segundo_apellido) ? row.segundo_apellido : undefined,
    nombre_completo: has(row.nombre_completo) ? row.nombre_completo : undefined,
    genero: normalizeGenero(row.genero),
    origen: has(row.origen) ? row.origen : 'manual',
    activo: has(row.activo) ? ['1','true','si','sí','yes','y'].includes(norm(row.activo).toLowerCase()) : true,
    emails: emails.length ? emails : undefined,
  };

  if (item) {
    const id = item.documentId || item.id;
    return putJson(`/api/personas/${id}`, { data });
  }
  return postJson('/api/personas', { data: { ...data, publishedAt: new Date().toISOString() } });
}

(async () => {
  try{
    console.log('== Import Personas (simple) ==');
    console.log('CSV:', CSV_PATH);
    const rows = loadCsv(CSV_PATH);
    let ok=0, fail=0;
    for (const [idx,row] of rows.entries()){
      try{ await upsertPersona(row); ok++; } catch(e){ fail++; console.error(`❌ Fila ${idx+1}:`, e?.message || e); }
    }
    console.log(`\n✔ Listo. OK=${ok}, FAIL=${fail}`);
  }catch(e){ console.error('❌ Error fatal:', e?.message || e); process.exit(1); }
})();
