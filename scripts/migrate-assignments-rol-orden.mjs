// scripts/migrate-assignments-rol-orden.mjs
// Migra cartera-asignaciones antiguas extrayendo rol=... y orden=... desde 'notas' a campos estructurados.

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const STATE = process.env.PUBLICATION_STATE || 'preview';

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!res.ok) { const body = await res.text(); throw new Error(`GET ${path} -> ${res.status} ${body}`); }
  return res.json();
}
async function putJson(path, data) {
  const res = await fetch(`${API_URL}${path}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(data) });
  if (!res.ok) { const body = await res.text(); throw new Error(`PUT ${path} -> ${res.status} ${body}`); }
  return res.json();
}

function parseNotas(not) {
  const txt = String(not || '');
  const rolMatch = txt.match(/\brol=([a-zA-Z0-9_\-]+)/);
  const ordenMatch = txt.match(/\borden=(\d+)/);
  return {
    rol: rolMatch ? rolMatch[1] : undefined,
    orden: ordenMatch ? Number(ordenMatch[1]) : undefined,
  };
}

async function main() {
  console.log('== Migrar rol/orden desde notas -> campos ==');
  let page = 1; const size = 200; let updates = 0; let skips = 0;
  while (true) {
    const q = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': String(size), publicationState: STATE });
    const json = await getJson(`/api/cartera-asignaciones?${q.toString()}`);
    const arr = json?.data || [];
    if (!arr.length) break;
    for (const it of arr) {
      const id = it.documentId || it.id; const a = it.attributes || it;
      const currentRol = a.rol; const currentOrden = a.orden;
      const parsed = parseNotas(a.notas);
      const data = {};
      if (!currentRol && parsed.rol) data.rol = parsed.rol;
      if (currentOrden == null && Number.isFinite(parsed.orden)) data.orden = parsed.orden;
      if (Object.keys(data).length) {
        data.publishedAt = a.publishedAt || new Date().toISOString();
        await putJson(`/api/cartera-asignaciones/${id}`, { data });
        updates++;
      } else {
        skips++;
      }
    }
    const meta = json?.meta?.pagination; if (!meta || meta.page >= meta.pageCount) break; page += 1;
  }
  console.log(`Listo. Actualizados=${updates}, Sin cambios=${skips}`);
}

main().catch((e) => { console.error('❌ Error:', e?.message || e); process.exit(1); });

