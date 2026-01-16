// scripts/export-assignments-template.mjs
// Exporta un CSV base para asignaciones: rbd,colegio_nombre,comercial,comercial_rut,soporte1,soporte1_rut,soporte2,soporte2_rut,prioridad,orden

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const STATE = process.env.PUBLICATION_STATE || 'preview';
const OUT_PATH = process.argv[2] || path.join('data', 'csv', 'export', 'asignaciones_template.csv');

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { Authorization: `Bearer ${TOKEN}` };

async function getJson(pathname) {
  const r = await fetch(`${API_URL}${pathname}`, { headers: HEADERS });
  if (!r.ok) { const body = await r.text(); throw new Error(`GET ${pathname} -> ${r.status} ${body}`); }
  return r.json();
}

function csvEscape(v) {
  if (v === undefined || v === null) return '';
  let s = String(v);
  s = s.replace(/\r\n|\r/g, '\n');
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main(){
  console.log('== Export Asignaciones Template ==');
  const ws = fs.createWriteStream(OUT_PATH);
  const headers = ['rbd','colegio_nombre','comercial','comercial_rut','soporte1','soporte1_rut','soporte2','soporte2_rut','prioridad','orden'];
  ws.write(headers.join(',') + '\n');

  let page = 1; const size = 200;
  while (true) {
    const q = new URLSearchParams({ 'pagination[page]': String(page), 'pagination[pageSize]': String(size), 'fields[0]': 'rbd', 'fields[1]': 'colegio_nombre', publicationState: STATE });
    const json = await getJson(`/api/colegios?${q.toString()}`);
    const arr = json?.data || [];
    if (!arr.length) break;
    for (const it of arr) {
      const a = it.attributes || it;
      const row = [a.rbd ?? '', a.colegio_nombre || '', '', '', '', '', '', '', '', ''];
      ws.write(row.map(csvEscape).join(',') + '\n');
    }
    const meta = json?.meta?.pagination; if (!meta || meta.page >= meta.pageCount) break; page += 1;
  }
  ws.end();
  console.log('Archivo:', OUT_PATH);
}

main().catch((e)=>{ console.error('❌ Error:', e?.message || e); process.exit(1); });

