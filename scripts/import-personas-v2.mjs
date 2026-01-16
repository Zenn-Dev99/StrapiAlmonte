// scripts/import-personas-v2.mjs
// Actualiza Personas a partir de un CSV parcial (solo columnas presentes y con valor se aplican).
// Identifica por RUT. Mantiene arreglos de componentes existentes, y solo fusiona campos por índice.

import fs from 'fs';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';
import http from 'http';
import https from 'https';

const STRAPI_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 6);
const RETRIES = Number(process.env.IMPORT_RETRIES || 5);
const DRY = process.env.DRY === '1';
const CSV_PATH = process.argv[2] || 'data/csv/import_respaldo/personas_import_2025_09_29.csv';

if (!STRAPI_TOKEN) { console.error('❌ Falta IMPORT_TOKEN / API_TOKEN / STRAPI_TOKEN'); process.exit(1); }

const agent = (STRAPI_URL || '').startsWith('https') ? new https.Agent({ keepAlive: true, maxSockets: 200 }) : new http.Agent({ keepAlive: true, maxSockets: 200 });
function authHeaders(extra = {}) { return { Authorization: `Bearer ${STRAPI_TOKEN}`, 'Content-Type': 'application/json', ...extra }; }
const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));
async function withRetry(fn){ let last; for (let i=0;i<RETRIES;i++){ try{ return await fn(); } catch(e){ last=e; if (i<RETRIES-1) await sleep(300*(i+1)); } } throw last; }
async function apiGet(path){ return withRetry(async()=>{ const r = await fetch(`${STRAPI_URL}${path}`, { headers: authHeaders(), agent }); if(!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text().catch(()=> '')}`); return r.json(); }); }
async function apiPut(path, body){ if (DRY) return { dry:true, method:'PUT', path, body }; return withRetry(async()=>{ const r = await fetch(`${STRAPI_URL}${path}`, { method:'PUT', headers: authHeaders(), body: JSON.stringify(body), agent }); if(!r.ok) throw new Error(`PUT ${path} -> ${r.status} ${await r.text().catch(()=> '')}`); return r.json(); }); }

async function readCSV(filePath){ if (!fs.existsSync(filePath)) throw new Error(`No existe CSV: ${filePath}`); const input = fs.createReadStream(filePath); const rows=[]; const parser = input.pipe(parse({ columns:true, skip_empty_lines:true, trim:true, bom:true, record_delimiter: ['\r\n','\n','\r'] })); for await (const row of parser) rows.push(row); return rows; }

function normStr(v){ if (v===undefined||v===null) return ''; const s = String(v).trim(); return s; }
function hasVal(v){ return normStr(v) !== ''; }
function normalizeBool(v){ const s = normStr(v).toLowerCase(); if (!s) return undefined; if(['1','true','t','yes','y','si','sí'].includes(s)) return true; if(['0','false','f','no','n'].includes(s)) return false; return undefined; }
function normalizeEstadoComp(v){
  const s = normStr(v).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  if(!s) return undefined;
  if (s.startsWith('por')) return 'Por Verificar';
  if (s.startsWith('verif')) return 'Verificado';
  if (s.startsWith('apro')) return 'Aprobado';
  return undefined;
}
function normalizeGenero(v){ const s = normStr(v).toLowerCase(); if (!s) return undefined; if (['m','mujer','female','femenino'].includes(s)) return 'Mujer'; if (['h','hombre','male','masculino'].includes(s)) return 'Hombre'; return undefined; }
function toDate(v){ const s = normStr(v); if(!s) return undefined; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10); return undefined; }
function toDateTime(v){ const s = normStr(v); if(!s) return undefined; const d = new Date(s); if (!Number.isNaN(d.getTime())) return d.toISOString(); return undefined; }

function parseJsonMerge(existing, raw){ if (!hasVal(raw)) return existing; try{ const obj = typeof raw === 'string' ? JSON.parse(raw) : raw; if (obj && typeof obj === 'object') return { ...(existing || {}), ...obj }; } catch(_){} return existing; }

function buildMergedComponent(existing = {}, partial = {}){
  const out = { ...existing };
  for (const [k,v] of Object.entries(partial)) if (v !== undefined) out[k] = v;
  return out;
}

function collectComponent(row, base, fields){
  const any = fields.some((k)=> hasVal(row[`${base}_${k}`]));
  if (!any) return null;
  const obj = {};
  for (const k of fields){
    const val = row[`${base}_${k}`];
    if (k.endsWith('principal')) {
      const b = normalizeBool(val); if (b!==undefined) obj[k] = b;
    } else if (k.includes('vigente')||k.startsWith('fecha_')){
      const d = k.includes('datetime')? toDateTime(val): toDate(val); if (d !== undefined) obj[k] = d;
    } else if (k === 'estado'){
      const e = normalizeEstadoComp(val); if (e !== undefined) obj[k] = e;
    } else if (k === 'email'){
      const s = normStr(val);
      if (s) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (re.test(s)) obj[k] = s.toLowerCase();
      }
    } else if (val !== undefined && val !== '') {
      obj[k] = val;
    }
  }
  // Map keys to component schema keys
  const map = {
    email: 'email', tipo:'tipo', estado:'estado', principal:'principal', vigente_desde:'vigente_desde', vigente_hasta:'vigente_hasta', eliminado_en:'eliminado_en', nota:'nota', fuente:'fuente', verificado_por:'verificado_por', fecha_verificacion:'fecha_verificacion', confidence_score:'confidence_score',
    telefono_raw:'telefono_raw', telefono_norm:'telefono_norm',
  };
  const out = {};
  for (const [k,v] of Object.entries(obj)) out[map[k] || k] = v;
  return out;
}

function mergeIndexedComponents(existingList = [], row, kind){
  // kind: 'email' | 'tel'
  const max = 10; // soporta hasta 10 por CSV
  const result = existingList.map((e)=> ({...e}));
  for (let i=1;i<=max;i++){
    const base = kind === 'email' ? `email_${i}` : `tel_${i}`;
    const fields = kind === 'email'
      ? ['email','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score']
      : ['telefono_raw','telefono_norm','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score'];
    const partial = collectComponent(row, base, fields);
    if (!partial) continue;
    if (result[i-1]) {
      result[i-1] = buildMergedComponent(result[i-1], partial);
    } else {
      // Solo agregar si trae campos esenciales
      if (kind === 'email') {
        if (partial.email) result[i-1] = partial; // email es requerido
      } else {
        if (partial.telefono_raw || partial.telefono_norm) result[i-1] = partial;
      }
    }
  }
  return result;
}

async function findPersonaByRut(rut){
  const json = await apiGet(`/api/personas?filters[rut][$eq]=${encodeURIComponent(rut)}&populate[emails]=true&populate[telefonos]=true&populate[imagen][populate][imagen][fields][0]=name&populate[tags][fields][0]=name&pagination[pageSize]=1`);
  const data = json?.data || [];
  return data[0] || null;
}

function flattenExistingComponents(attrs){
  const toList = (x)=> Array.isArray(x) ? x : (x?.data ? x.data.map((e)=> e.attributes || e) : (x || []));
  return {
    emails: toList(attrs.emails),
    telefonos: toList(attrs.telefonos),
    imagen: attrs.imagen?.data ? (attrs.imagen.data.attributes || attrs.imagen.data) : (attrs.imagen || null),
  };
}

function buildUpdatePayload(row, attrs){
  const payload = {};
  // Scalars (solo si hay valor)
  const map = [
    ['nombres','nombres'], ['primer_apellido','primer_apellido'], ['segundo_apellido','segundo_apellido'], ['nombre_completo','nombre_completo'],
    ['status_nombres','status_nombres'], ['nivel_confianza','nivel_confianza'], ['origen','origen'], ['notas','notas']
  ];
  for (const [csvKey, target] of map){ if (hasVal(row[csvKey])) payload[target] = row[csvKey]; }
  const activo = normalizeBool(row.activo); if (activo !== undefined) payload.activo = activo;
  const genero = normalizeGenero(row.genero); if (genero !== undefined) payload.genero = genero;
  const cumpleagno = toDate(row.cumpleagno); if (cumpleagno !== undefined) payload.cumpleagno = cumpleagno;

  // identificadores_externos: merge
  if ('identificadores_externos_json' in row) payload.identificadores_externos = parseJsonMerge(attrs.identificadores_externos, row.identificadores_externos_json);

  // Componentes: merge por índice
  const { emails: curEmails, telefonos: curTels, imagen: curImg } = flattenExistingComponents(attrs);
  const nextEmails = mergeIndexedComponents(curEmails, row, 'email').map(({id, ...rest})=> rest);
  const nextTels = mergeIndexedComponents(curTels, row, 'tel').map(({id, ...rest})=> rest);
  if (nextEmails.length !== curEmails.length || JSON.stringify(nextEmails) !== JSON.stringify(curEmails.map(({id, ...r})=>r))) payload.emails = nextEmails;
  if (nextTels.length !== curTels.length || JSON.stringify(nextTels) !== JSON.stringify(curTels.map(({id, ...r})=>r))) payload.telefonos = nextTels;

  // Imagen (solo metadatos, no sube media). Prefijo imagen_*
  const imgFields = ['tipo','formato','estado','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confiance_score','aprobado_por','fecha_aprobacion'];
  const hasImg = imgFields.some((k)=> hasVal(row[`imagen_${k}`]));
  if (hasImg){
    const { id: _imgId, ...baseImg } = (curImg || {});
    const img = { ...baseImg };
    if (hasVal(row.imagen_tipo)) img.tipo = row.imagen_tipo;
    if (hasVal(row.imagen_formato)) img.formato = row.imagen_formato;
    const est = normalizeEstadoComp(row.imagen_estado); if (est!==undefined) img.estado = est;
    const vd = toDate(row.imagen_vigente_desde); if (vd!==undefined) img.vigente_desde = vd;
    const vh = toDate(row.imagen_vigente_hasta); if (vh!==undefined) img.vigente_hasta = vh;
    const el = toDate(row.imagen_eliminado_en); if (el!==undefined) img.eliminado_en = el;
    if (hasVal(row.imagen_nota)) img.nota = row.imagen_nota;
    if (hasVal(row.imagen_fuente)) img.fuente = row.imagen_fuente;
    if (hasVal(row.imagen_verificado_por)) img.verificado_por = row.imagen_verificado_por;
    const fv = toDate(row.imagen_fecha_verificacion); if (fv!==undefined) img.fecha_verificacion = fv;
    if (hasVal(row.imagen_confiance_score)) img.confiance_score = Number(row.imagen_confiance_score);
    if (hasVal(row.imagen_aprobado_por)) img.aprobado_por = row.imagen_aprobado_por;
    const fa = toDate(row.imagen_fecha_aprobacion); if (fa!==undefined) img.fecha_aprobacion = fa;
    payload.imagen = img;
  }
  return payload;
}

async function processRow(row){
  const rut = normStr(row.rut || row.RUT || row.Rut);
  if (!rut) throw new Error('Fila sin RUT');
  const existing = await findPersonaByRut(rut);
  if (!existing) { console.warn(`⚠️  No existe persona con rut=${rut}. Se omite.`); return { skipped:true }; }
  const id = existing.documentId || existing.id;
  const attrs = existing.attributes || existing;
  const data = buildUpdatePayload(row, attrs);
  if (Object.keys(data).length === 0) return { skipped:true };
  const res = await apiPut(`/api/personas/${id}`, { data });
  return res;
}

import pLimit from 'p-limit';

(async () => {
  try{
    console.log('== Import Personas v2 (merge) ==');
    console.log('CSV:', CSV_PATH);
    console.log('STRAPI_URL:', STRAPI_URL);
    console.log('DRY run:', DRY ? 'YES' : 'NO');
    const rows = await readCSV(CSV_PATH);
    if (!rows.length){ console.log('CSV vacío.'); process.exit(0); }
    const limit = pLimit(CONCURRENCY);
    let ok=0, fail=0, skip=0;
    await Promise.all(rows.map((row, idx)=> limit(async()=>{
      try{ const r = await processRow(row); if (r?.skipped) skip++; else ok++; } catch(e){ fail++; console.error(`❌ Fila ${idx+1}:`, e?.message || e); }
    })));
    console.log(`\n🎉 Listo. OK=${ok}, SKIPPED=${skip}, FAIL=${fail}`);
  }catch(e){ console.error('❌ Error fatal:', e?.message || e); process.exit(1); }
})();
