// scripts/export-personas.mjs
// Exporta todas las Personas a un CSV plano compatible con la plantilla personas_import_template.csv

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const PUBLICATION_STATE = process.env.PUBLICATION_STATE || 'preview'; // 'live' o 'preview'
const PAGE_SIZE = Number(process.env.EXPORT_PAGE_SIZE || 200);
const OUT_PATH = process.argv[2] || path.join('data', 'csv', 'export', 'personas_export.csv');

if (!TOKEN) {
  console.error('❌ Falta IMPORT_TOKEN / API_TOKEN / STRAPI_TOKEN');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

function createSearchParams(base = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === null) continue;
    params.set(key, value);
  }
  return params;
}

async function getJson(pathname) {
  const res = await fetch(`${API_URL}${pathname}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${pathname} -> ${res.status} ${body}`);
  }
  return res.json();
}

function csvEscape(v) {
  if (v === undefined || v === null) return '';
  let s = '';
  if (typeof v === 'object') {
    try { s = JSON.stringify(v); } catch (_) { s = String(v); }
  } else {
    s = String(v);
  }
  // Normaliza saltos de línea a \n
  s = s.replace(/\r\n|\r/g, '\n');
  if (/[,"\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toBoolString(v) { return v === true ? 'true' : v === false ? 'false' : ''; }
function toDate(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10); }
function toDateTime(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); }

const HEADERS_ORDER = [
  'rut','nombres','primer_apellido','segundo_apellido','nombre_completo','status_nombres','nivel_confianza','origen','activo','notas','genero','cumpleagno','tags_nombres','identificadores_externos_json',
  'email_1_email','email_1_tipo','email_1_estado','email_1_principal','email_1_vigente_desde','email_1_vigente_hasta','email_1_eliminado_en','email_1_nota','email_1_fuente','email_1_verificado_por','email_1_fecha_verificacion','email_1_confidence_score',
  'email_2_email','email_2_tipo','email_2_estado','email_2_principal','email_2_vigente_desde','email_2_vigente_hasta','email_2_eliminado_en','email_2_nota','email_2_fuente','email_2_verificado_por','email_2_fecha_verificacion','email_2_confidence_score',
  'email_3_email','email_3_tipo','email_3_estado','email_3_principal','email_3_vigente_desde','email_3_vigente_hasta','email_3_eliminado_en','email_3_nota','email_3_fuente','email_3_verificado_por','email_3_fecha_verificacion','email_3_confidence_score',
  'tel_1_telefono_raw','tel_1_telefono_norm','tel_1_tipo','tel_1_estado','tel_1_principal','tel_1_vigente_desde','tel_1_vigente_hasta','tel_1_eliminado_en','tel_1_nota','tel_1_fuente','tel_1_verificado_por','tel_1_fecha_verificacion','tel_1_confidence_score',
  'tel_2_telefono_raw','tel_2_telefono_norm','tel_2_tipo','tel_2_estado','tel_2_principal','tel_2_vigente_desde','tel_2_vigente_hasta','tel_2_eliminado_en','tel_2_nota','tel_2_fuente','tel_2_verificado_por','tel_2_fecha_verificacion','tel_2_confidence_score',
  'tel_3_telefono_raw','tel_3_telefono_norm','tel_3_tipo','tel_3_estado','tel_3_principal','tel_3_vigente_desde','tel_3_vigente_hasta','tel_3_eliminado_en','tel_3_nota','tel_3_fuente','tel_3_verificado_por','tel_3_fecha_verificacion','tel_3_confidence_score',
  'imagen_imagenes','imagen_tipo','imagen_formato','imagen_estado','imagen_vigente_desde','imagen_vigente_hasta','imagen_eliminado_en','imagen_nota','imagen_fuente','imagen_verificado_por','imagen_fecha_verificacion','imagen_confiance_score','imagen_aprobado_por','imagen_fecha_aprobacion'
];

function flattenPersona(entry) {
  const attrs = entry.attributes || entry;
  const out = {};
  out.rut = attrs.rut || '';
  out.nombres = attrs.nombres || '';
  out.primer_apellido = attrs.primer_apellido || '';
  out.segundo_apellido = attrs.segundo_apellido || '';
  out.nombre_completo = attrs.nombre_completo || '';
  out.status_nombres = attrs.status_nombres || '';
  out.nivel_confianza = attrs.nivel_confianza || '';
  out.origen = attrs.origen || '';
  out.activo = toBoolString(attrs.activo);
  out.notas = attrs.notas || '';
  out.genero = attrs.genero || '';
  out.cumpleagno = toDate(attrs.cumpleagno);

  // Tags
  const tagsRel = attrs.tags?.data || attrs.tags || [];
  if (Array.isArray(tagsRel)) {
    const names = tagsRel.map((t) => (t.attributes?.name || t.name || '').trim()).filter(Boolean);
    out.tags_nombres = names.join('|');
  } else { out.tags_nombres = ''; }

  // Identificadores externos
  const ext = attrs.identificadores_externos;
  out.identificadores_externos_json = ext ? (typeof ext === 'string' ? ext : JSON.stringify(ext)) : '';

  function fillEmail(idx, comp) {
    out[`email_${idx}_email`] = comp.email || '';
    out[`email_${idx}_tipo`] = comp.tipo || '';
    out[`email_${idx}_estado`] = comp.estado || '';
    out[`email_${idx}_principal`] = toBoolString(comp.principal);
    out[`email_${idx}_vigente_desde`] = toDate(comp.vigente_desde);
    out[`email_${idx}_vigente_hasta`] = toDate(comp.vigente_hasta);
    out[`email_${idx}_eliminado_en`] = toDateTime(comp.eliminado_en);
    out[`email_${idx}_nota`] = comp.nota || '';
    out[`email_${idx}_fuente`] = comp.fuente || '';
    out[`email_${idx}_verificado_por`] = comp.verificado_por || '';
    out[`email_${idx}_fecha_verificacion`] = toDateTime(comp.fecha_verificacion);
    out[`email_${idx}_confidence_score`] = comp.confidence_score ?? '';
  }
  const emails = Array.isArray(attrs.emails) ? attrs.emails : Array.isArray(attrs.emails?.data) ? attrs.emails.data.map((e)=>e.attributes||e) : (attrs.emails || []);
  emails.slice(0,3).forEach((comp, i) => fillEmail(i+1, comp));

  function fillTel(idx, comp) {
    out[`tel_${idx}_telefono_raw`] = comp.telefono_raw || '';
    out[`tel_${idx}_telefono_norm`] = comp.telefono_norm || '';
    out[`tel_${idx}_tipo`] = comp.tipo || '';
    out[`tel_${idx}_estado`] = comp.estado || '';
    out[`tel_${idx}_principal`] = toBoolString(comp.principal);
    out[`tel_${idx}_vigente_desde`] = toDate(comp.vigente_desde);
    out[`tel_${idx}_vigente_hasta`] = toDate(comp.vigente_hasta);
    out[`tel_${idx}_eliminado_en`] = toDateTime(comp.eliminado_en);
    out[`tel_${idx}_nota`] = comp.nota || '';
    out[`tel_${idx}_fuente`] = comp.fuente || '';
    out[`tel_${idx}_verificado_por`] = comp.verificado_por || '';
    out[`tel_${idx}_fecha_verificacion`] = toDateTime(comp.fecha_verificacion);
    out[`tel_${idx}_confidence_score`] = comp.confidence_score ?? '';
  }
  const telefonos = Array.isArray(attrs.telefonos) ? attrs.telefonos : Array.isArray(attrs.telefonos?.data) ? attrs.telefonos.data.map((e)=>e.attributes||e) : (attrs.telefonos || []);
  telefonos.slice(0,3).forEach((comp, i) => fillTel(i+1, comp));

  // Imagen (Logo o Avatar)
  const imagen = attrs.imagen?.data ? (attrs.imagen.data.attributes || attrs.imagen.data) : (attrs.imagen || null);
  if (imagen && typeof imagen === 'object') {
    out.imagen_tipo = imagen.tipo || '';
    out.imagen_formato = imagen.formato || '';
    out.imagen_estado = imagen.estado || '';
    out.imagen_vigente_desde = toDate(imagen.vigente_desde);
    out.imagen_vigente_hasta = toDate(imagen.vigente_hasta);
    out.imagen_eliminado_en = toDate(imagen.eliminado_en);
    out.imagen_nota = imagen.nota || '';
    out.imagen_fuente = imagen.fuente || '';
    out.imagen_verificado_por = imagen.verificado_por || '';
    out.imagen_fecha_verificacion = toDate(imagen.fecha_verificacion);
    out.imagen_confiance_score = imagen.confiance_score ?? '';
    out.imagen_aprobado_por = imagen.aprobado_por || '';
    out.imagen_fecha_aprobacion = toDate(imagen.fecha_aprobacion);
    const imgs = imagen.imagen?.data || imagen.imagen;
    if (Array.isArray(imgs)) {
      const names = imgs.map((f) => (f.attributes?.name || f.name || '').trim()).filter(Boolean);
      out.imagen_imagenes = names.join('|');
    } else { out.imagen_imagenes = ''; }
  }

  return out;
}

async function exportPersonas() {
  // Prepara destino
  const dir = path.dirname(OUT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const ws = fs.createWriteStream(OUT_PATH, { encoding: 'utf8' });
  ws.write(HEADERS_ORDER.map(csvEscape).join(',') + '\n');

  let page = 1; let total = 0; let wrote = 0;
  while (true) {
    const params = createSearchParams({
      publicationState: PUBLICATION_STATE,
      'fields[0]': 'rut',
      'fields[1]': 'nombres',
      'fields[2]': 'primer_apellido',
      'fields[3]': 'segundo_apellido',
      'fields[4]': 'nombre_completo',
      'fields[5]': 'status_nombres',
      'fields[6]': 'nivel_confianza',
      'fields[7]': 'origen',
      'fields[8]': 'activo',
      'fields[9]': 'notas',
      'fields[10]': 'genero',
      'fields[11]': 'cumpleagno',
      'fields[12]': 'identificadores_externos',
      'populate[tags][fields][0]': 'name',
      'populate[emails]': 'true',
      'populate[telefonos]': 'true',
      'populate[imagen][populate][imagen][fields][0]': 'name',
      'pagination[page]': String(page),
      'pagination[pageSize]': String(PAGE_SIZE),
    });
    const url = `/api/personas?${params.toString()}`;
    const json = await getJson(url);
    const data = json?.data || [];
    if (!data.length) break;
    total += data.length;
    for (const entry of data) {
      const flat = flattenPersona(entry);
      const row = HEADERS_ORDER.map((k) => csvEscape(flat[k]));
      ws.write(row.join(',') + '\n');
      wrote += 1;
    }
    const meta = json?.meta?.pagination;
    if (!meta || meta.page >= meta.pageCount) break;
    page += 1;
  }
  ws.end();
  return { wrote, outPath: OUT_PATH };
}

(async () => {
  try {
    console.log('== Export Personas -> CSV ==');
    console.log('API:', API_URL);
    console.log('STATE:', PUBLICATION_STATE);
    console.log('OUT:', OUT_PATH);
    const { wrote, outPath } = await exportPersonas();
    console.log(`✅ Exportadas ${wrote} personas a ${outPath}`);
  } catch (err) {
    console.error('❌ Error exportando:', err?.message || err);
    process.exit(1);
  }
})();

