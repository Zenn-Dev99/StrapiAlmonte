// scripts/export-colegios-v2.mjs
// Exporta Colegios + componentes al CSV compatible con templates/colegios_import_template.csv

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const PUBLICATION_STATE = process.env.PUBLICATION_STATE || 'preview';
const PAGE_SIZE = Number(process.env.EXPORT_PAGE_SIZE || 200);
const OUT_PATH = process.argv[2] || path.join('data', 'csv', 'export', 'colegios_export.csv');

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const OPTIONAL_POPULATE_PARAMS = {
  organizacion: { 'populate[organizacion][fields][0]': 'nombre' },
  colegio_logo: { 'populate[colegio_logo][fields][0]': 'name' },
};
const OPTIONAL_POPULATES = Object.keys(OPTIONAL_POPULATE_PARAMS);
const disabledPopulates = new Set();
const CARTERA_ROLES = ['comercial', 'soporte1', 'soporte2'];

function createSearchParams(base = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== null) params.set(k, v);
  return params;
}
async function getJson(pathname) {
  const res = await fetch(`${API_URL}${pathname}`, { headers: HEADERS });
  if (!res.ok) { const body = await res.text(); throw new Error(`GET ${pathname} -> ${res.status} ${body}`); }
  return res.json();
}
function csvEscape(v) {
  if (v === undefined || v === null) return '';
  let s = '';
  if (typeof v === 'object') { try { s = JSON.stringify(v); } catch { s = String(v); } }
  else { s = String(v); }
  s = s.replace(/\r\n|\r/g, '\n');
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toBoolString(v) { return v === true ? 'true' : v === false ? 'false' : ''; }
function toDate(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10); }
function toDateTime(v) { if (!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); }
function getInvalidKeyFromError(err) {
  if (!err) return null;
  const message = err?.message || '';
  const match = message.match(/Invalid key ([^"\\s}]+)/);
  if (match) return match[1];
  const jsonStart = message.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart));
      return parsed?.error?.details?.key || parsed?.error?.message?.match(/Invalid key ([^"\\s}]+)/)?.[1] || null;
    } catch {
      return null;
    }
  }
  return null;
}

const HEADERS_ORDER = [
  'colegio_documentId','colegio_id','created_at','updated_at','published_at',
  'rbd','colegio_nombre','rbd_digito_verificador','dependencia','ruralidad','estado_estab',
  'comuna_documentId','comuna_nombre','provincia_documentId','provincia_nombre','region_documentId','region_nombre','zona_documentId','zona_nombre','organizacion_documentId','organizacion_nombre','colegio_logo_file',
  'estado_nombre_1_estado','estado_nombre_1_nota','estado_nombre_1_fuente','estado_nombre_1_verificado_por','estado_nombre_1_fecha_verificacion','estado_nombre_1_aprobado_por','estado_nombre_1_fecha_aprobacion','estado_nombre_1_confiance_score',
  'estado_nombre_2_estado','estado_nombre_2_nota','estado_nombre_2_fuente','estado_nombre_2_verificado_por','estado_nombre_2_fecha_verificacion','estado_nombre_2_aprobado_por','estado_nombre_2_fecha_aprobacion','estado_nombre_2_confiance_score',
  'email_1_email','email_1_tipo','email_1_estado','email_1_principal','email_1_vigente_desde','email_1_vigente_hasta','email_1_eliminado_en','email_1_nota','email_1_fuente','email_1_verificado_por','email_1_fecha_verificacion','email_1_confidence_score',
  'email_2_email','email_2_tipo','email_2_estado','email_2_principal','email_2_vigente_desde','email_2_vigente_hasta','email_2_eliminado_en','email_2_nota','email_2_fuente','email_2_verificado_por','email_2_fecha_verificacion','email_2_confidence_score',
  'email_3_email','email_3_tipo','email_3_estado','email_3_principal','email_3_vigente_desde','email_3_vigente_hasta','email_3_eliminado_en','email_3_nota','email_3_fuente','email_3_verificado_por','email_3_fecha_verificacion','email_3_confidence_score',
  'tel_1_telefono_raw','tel_1_telefono_norm','tel_1_tipo','tel_1_estado','tel_1_principal','tel_1_vigente_desde','tel_1_vigente_hasta','tel_1_eliminado_en','tel_1_nota','tel_1_fuente','tel_1_verificado_por','tel_1_fecha_verificacion','tel_1_confidence_score',
  'tel_2_telefono_raw','tel_2_telefono_norm','tel_2_tipo','tel_2_estado','tel_2_principal','tel_2_vigente_desde','tel_2_vigente_hasta','tel_2_eliminado_en','tel_2_nota','tel_2_fuente','tel_2_verificado_por','tel_2_fecha_verificacion','tel_2_confidence_score',
  'tel_3_telefono_raw','tel_3_telefono_norm','tel_3_tipo','tel_3_estado','tel_3_principal','tel_3_vigente_desde','tel_3_vigente_hasta','tel_3_eliminado_en','tel_3_nota','tel_3_fuente','tel_3_verificado_por','tel_3_fecha_verificacion','tel_3_confidence_score',
  'dir_1_direccion_principal_envio_facturacion','dir_1_region_documentId','dir_1_region_nombre','dir_1_comuna_documentId','dir_1_comuna_nombre','dir_1_nombre_calle','dir_1_numero_calle','dir_1_complemento_direccion','dir_1_tipo_direccion','dir_1_verificada_por','dir_1_fecha_verificacion','dir_1_estado_verificacion',
  'dir_2_direccion_principal_envio_facturacion','dir_2_region_documentId','dir_2_region_nombre','dir_2_comuna_documentId','dir_2_comuna_nombre','dir_2_nombre_calle','dir_2_numero_calle','dir_2_complemento_direccion','dir_2_tipo_direccion','dir_2_verificada_por','dir_2_fecha_verificacion','dir_2_estado_verificacion',
  'website_1_website','website_1_estado','website_1_vigente_desde','website_1_vigente_hasta','website_1_eliminado_en','website_1_nota','website_1_fuente','website_1_confiance_score','website_1_verificado_por','website_1_fecha_verificacion','website_1_aprobado_por','website_1_fecha_aprobacion',
  'website_2_website','website_2_estado','website_2_vigente_desde','website_2_vigente_hasta','website_2_eliminado_en','website_2_nota','website_2_fuente','website_2_confiance_score','website_2_verificado_por','website_2_fecha_verificacion','website_2_aprobado_por','website_2_fecha_aprobacion',
  'listas_utiles_count','listas_utiles_anios','listas_utiles_slugs','listas_utiles_estados',
  'cartera_comercial_documentId','cartera_comercial_estado','cartera_comercial_prioridad','cartera_comercial_is_current','cartera_comercial_fecha_inicio','cartera_comercial_fecha_fin','cartera_comercial_meta_ingresos','cartera_comercial_notas','cartera_comercial_orden','cartera_comercial_periodo_nombre','cartera_comercial_periodo_estado','cartera_comercial_ejecutivo_documentId','cartera_comercial_ejecutivo_nombre','cartera_comercial_ejecutivo_rut',
  'cartera_soporte1_documentId','cartera_soporte1_estado','cartera_soporte1_prioridad','cartera_soporte1_is_current','cartera_soporte1_fecha_inicio','cartera_soporte1_fecha_fin','cartera_soporte1_meta_ingresos','cartera_soporte1_notas','cartera_soporte1_orden','cartera_soporte1_periodo_nombre','cartera_soporte1_periodo_estado','cartera_soporte1_ejecutivo_documentId','cartera_soporte1_ejecutivo_nombre','cartera_soporte1_ejecutivo_rut',
  'cartera_soporte2_documentId','cartera_soporte2_estado','cartera_soporte2_prioridad','cartera_soporte2_is_current','cartera_soporte2_fecha_inicio','cartera_soporte2_fecha_fin','cartera_soporte2_meta_ingresos','cartera_soporte2_notas','cartera_soporte2_orden','cartera_soporte2_periodo_nombre','cartera_soporte2_periodo_estado','cartera_soporte2_ejecutivo_documentId','cartera_soporte2_ejecutivo_nombre','cartera_soporte2_ejecutivo_rut',
  'sostenedor_documentId','sostenedor_rut','sostenedor_dv','sostenedor_rut_completo','sostenedor_razon_social','sostenedor_nombre_fantasia','sostenedor_giro','sostenedor_tipo','sostenedor_contacto_documentId','sostenedor_contacto_nombre',
  'logo_imagenes','logo_tipo','logo_formato','logo_estado','logo_vigente_desde','logo_vigente_hasta','logo_eliminado_en','logo_nota','logo_fuente','logo_verificado_por','logo_fecha_verificacion','logo_confiance_score','logo_aprobado_por','logo_fecha_aprobacion'
];

function getRelName(rel, field) { const d = rel?.data || rel; return d?.attributes ? d.attributes[field] : d?.[field]; }
function getRelDocId(rel) { const d = rel?.data || rel; return d?.documentId || d?.id || ''; }
function toEntity(entity) {
  if (!entity) return null;
  if (Array.isArray(entity)) return toEntity(entity[0]);
  if (entity.data) return toEntity(entity.data);
  if (entity.attributes) {
    return {
      ...entity.attributes,
      id: entity.id ?? entity.attributes.id,
      documentId: entity.documentId ?? entity.attributes.documentId,
    };
  }
  return entity;
}
function toEntityArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => toEntity(item)).filter(Boolean);
  if (Array.isArray(value?.data)) return value.data.map((item) => toEntity(item)).filter(Boolean);
  return [];
}
function fillCarteraAssignments(out, assignmentsInput) {
  const assignments = toEntityArray(assignmentsInput);
  CARTERA_ROLES.forEach((role) => {
    const prefix = `cartera_${role}`;
    const matches = assignments.filter((item) => item?.rol === role);
    const record = matches.find((item) => item?.is_current === true) || matches[0];
    const periodo = toEntity(record?.periodo);
    const ejecutivo = toEntity(record?.ejecutivo);
    out[`${prefix}_documentId`] = record?.documentId || '';
    out[`${prefix}_estado`] = record?.estado || '';
    out[`${prefix}_prioridad`] = record?.prioridad || '';
    out[`${prefix}_is_current`] = toBoolString(record?.is_current);
    out[`${prefix}_fecha_inicio`] = toDate(record?.fecha_inicio);
    out[`${prefix}_fecha_fin`] = toDate(record?.fecha_fin);
    out[`${prefix}_meta_ingresos`] = record?.meta_ingresos ?? '';
    out[`${prefix}_notas`] = record?.notas || '';
    out[`${prefix}_orden`] = record?.orden ?? '';
    out[`${prefix}_periodo_nombre`] = periodo?.nombre || '';
    out[`${prefix}_periodo_estado`] = periodo?.estado || '';
    out[`${prefix}_ejecutivo_documentId`] = ejecutivo?.documentId || '';
    out[`${prefix}_ejecutivo_nombre`] = ejecutivo?.nombre_completo || '';
    out[`${prefix}_ejecutivo_rut`] = ejecutivo?.rut || '';
  });
}
function fillSostenedor(out, sostenedorInput) {
  const sostenedor = toEntity(sostenedorInput);
  const contacto = toEntity(sostenedor?.contacto);
  out.sostenedor_documentId = sostenedor?.documentId || '';
  out.sostenedor_rut = sostenedor?.rut_sostenedor ?? '';
  out.sostenedor_dv = sostenedor?.dv_rut || '';
  out.sostenedor_rut_completo = sostenedor?.rut_completo || '';
  out.sostenedor_razon_social = sostenedor?.razon_social || '';
  out.sostenedor_nombre_fantasia = sostenedor?.nombre_fantasia || '';
  out.sostenedor_giro = sostenedor?.giro || '';
  out.sostenedor_tipo = sostenedor?.tipo_sostenedor || '';
  out.sostenedor_contacto_documentId = contacto?.documentId || '';
  out.sostenedor_contacto_nombre = contacto?.nombre_completo || '';
}
function fillListasUtiles(out, listasInput) {
  const listas = toEntityArray(listasInput);
  const sorted = [...listas].sort((a, b) => (Number(b?.anio || 0) - Number(a?.anio || 0)));
  out.listas_utiles_count = listas.length ? String(listas.length) : '0';
  out.listas_utiles_anios = sorted.map((item) => item?.anio).filter((v) => v !== undefined && v !== null).join('|');
  out.listas_utiles_slugs = sorted.map((item) => item?.slug || '').filter(Boolean).join('|');
  out.listas_utiles_estados = sorted.map((item) => item?.estado_global || '').filter(Boolean).join('|');
}

function fillEstadoNombre(out, idx, comp) {
  out[`estado_nombre_${idx}_estado`] = comp.estado || '';
  out[`estado_nombre_${idx}_nota`] = comp.nota || '';
  out[`estado_nombre_${idx}_fuente`] = comp.fuente || '';
  out[`estado_nombre_${idx}_verificado_por`] = comp.verificado_por || '';
  out[`estado_nombre_${idx}_fecha_verificacion`] = toDate(comp.fecha_verificacion);
  out[`estado_nombre_${idx}_aprobado_por`] = comp.aprobado_por || '';
  out[`estado_nombre_${idx}_fecha_aprobacion`] = toDate(comp.fecha_aprobacion);
  out[`estado_nombre_${idx}_confiance_score`] = comp.confiance_score ?? '';
}
function fillEmail(out, idx, comp) {
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
function fillTel(out, idx, comp) {
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
function fillDir(out, idx, comp) {
  out[`dir_${idx}_direccion_principal_envio_facturacion`] = comp.direccion_principal_envio_facturacion || '';
  out[`dir_${idx}_region_documentId`] = getRelDocId(comp.region) || '';
  out[`dir_${idx}_region_nombre`] = getRelName(comp.region, 'region_nombre') || '';
  out[`dir_${idx}_comuna_documentId`] = getRelDocId(comp.comuna) || '';
  out[`dir_${idx}_comuna_nombre`] = getRelName(comp.comuna, 'comuna_nombre') || '';
  out[`dir_${idx}_nombre_calle`] = comp.nombre_calle || '';
  out[`dir_${idx}_numero_calle`] = comp.numero_calle || '';
  out[`dir_${idx}_complemento_direccion`] = comp.complemento_direccion || '';
  out[`dir_${idx}_tipo_direccion`] = comp.tipo_direccion || '';
  out[`dir_${idx}_verificada_por`] = comp.verificada_por || '';
  out[`dir_${idx}_fecha_verificacion`] = toDate(comp.fecha_verificacion);
  out[`dir_${idx}_estado_verificacion`] = comp.estado_verificacion || '';
}
function fillWeb(out, idx, comp) {
  out[`website_${idx}_website`] = comp.website || '';
  out[`website_${idx}_estado`] = comp.estado || '';
  out[`website_${idx}_vigente_desde`] = toDate(comp.vigente_desde);
  out[`website_${idx}_vigente_hasta`] = toDate(comp.vigente_hasta);
  out[`website_${idx}_eliminado_en`] = toDate(comp.eliminado_en);
  out[`website_${idx}_nota`] = comp.nota || '';
  out[`website_${idx}_fuente`] = comp.fuente || '';
  out[`website_${idx}_confiance_score`] = comp.confiance_score ?? '';
  out[`website_${idx}_verificado_por`] = comp.verificado_por || '';
  out[`website_${idx}_fecha_verificacion`] = toDate(comp.fecha_verificacion);
  out[`website_${idx}_aprobado_por`] = comp.aprobado_por || '';
  out[`website_${idx}_fecha_aprobacion`] = toDate(comp.fecha_aprobacion);
}

function flattenColegio(entry) {
  const attrs = entry.attributes || entry;
  const out = {};
  out.colegio_documentId = entry.documentId || attrs.documentId || '';
  out.colegio_id = entry.id ?? attrs.id ?? '';
  out.created_at = toDateTime(attrs.createdAt);
  out.updated_at = toDateTime(attrs.updatedAt);
  out.published_at = toDateTime(attrs.publishedAt);
  out.rbd = attrs.rbd ?? '';
  out.colegio_nombre = attrs.colegio_nombre || '';
  out.rbd_digito_verificador = attrs.rbd_digito_verificador || '';
  out.dependencia = attrs.dependencia || '';
  out.ruralidad = attrs.ruralidad || '';
  out.estado_estab = attrs.estado_estab || '';

  out.comuna_documentId = getRelDocId(attrs.comuna);
  out.comuna_nombre = getRelName(attrs.comuna, 'comuna_nombre') || '';
  out.provincia_documentId = getRelDocId(attrs.provincia);
  out.provincia_nombre = getRelName(attrs.provincia, 'provincia_nombre') || '';
  out.region_documentId = getRelDocId(attrs.region);
  out.region_nombre = getRelName(attrs.region, 'region_nombre') || '';
  out.zona_documentId = getRelDocId(attrs.zona);
  out.zona_nombre = getRelName(attrs.zona, 'zona_nombre') || '';
  out.organizacion_documentId = getRelDocId(attrs.organizacion);
  out.organizacion_nombre = getRelName(attrs.organizacion, 'nombre') || '';

  const logo = attrs.colegio_logo?.data || attrs.colegio_logo; // media single
  if (logo) out.colegio_logo_file = (logo.attributes?.name || logo.name || '') || '';

  const estados = Array.isArray(attrs.estado_nombre) ? attrs.estado_nombre : (attrs.estado_nombre?.data ? attrs.estado_nombre.data.map((e)=>e.attributes||e) : (attrs.estado_nombre || []));
  estados.slice(0,2).forEach((comp, i) => fillEstadoNombre(out, i+1, comp));

  const emails = Array.isArray(attrs.emails) ? attrs.emails : (attrs.emails?.data ? attrs.emails.data.map((e)=>e.attributes||e) : (attrs.emails || []));
  emails.slice(0,3).forEach((comp, i) => fillEmail(out, i+1, comp));

  const tels = Array.isArray(attrs.telefonos) ? attrs.telefonos : (attrs.telefonos?.data ? attrs.telefonos.data.map((e)=>e.attributes||e) : (attrs.telefonos || []));
  tels.slice(0,3).forEach((comp, i) => fillTel(out, i+1, comp));

  const dirs = Array.isArray(attrs.direcciones) ? attrs.direcciones : (attrs.direcciones?.data ? attrs.direcciones.data.map((e)=>e.attributes||e) : (attrs.direcciones || []));
  dirs.slice(0,2).forEach((comp, i) => fillDir(out, i+1, comp));

  const webs = Array.isArray(attrs.Website) ? attrs.Website : (attrs.Website?.data ? attrs.Website.data.map((e)=>e.attributes||e) : (attrs.Website || []));
  webs.slice(0,2).forEach((comp, i) => fillWeb(out, i+1, comp));

  fillListasUtiles(out, attrs.listas_utiles);
  fillCarteraAssignments(out, attrs.cartera_asignaciones);

  const logoComp = attrs.logo?.data ? (attrs.logo.data.attributes || attrs.logo.data) : attrs.logo;
  if (logoComp && typeof logoComp === 'object') {
    out.logo_tipo = logoComp.tipo || '';
    out.logo_formato = logoComp.formato || '';
    out.logo_estado = logoComp.estado || '';
    out.logo_vigente_desde = toDate(logoComp.vigente_desde);
    out.logo_vigente_hasta = toDate(logoComp.vigente_hasta);
    out.logo_eliminado_en = toDate(logoComp.eliminado_en);
    out.logo_nota = logoComp.nota || '';
    out.logo_fuente = logoComp.fuente || '';
    out.logo_verificado_por = logoComp.verificado_por || '';
    out.logo_fecha_verificacion = toDate(logoComp.fecha_verificacion);
    out.logo_confiance_score = logoComp.confiance_score ?? '';
    out.logo_aprobado_por = logoComp.aprobado_por || '';
    out.logo_fecha_aprobacion = toDate(logoComp.fecha_aprobacion);
    const imgs = logoComp.imagen?.data || logoComp.imagen;
    if (Array.isArray(imgs)) {
      const names = imgs.map((f) => (f.attributes?.name || f.name || '').trim()).filter(Boolean);
      out.logo_imagenes = names.join('|');
    }
  }

  fillSostenedor(out, attrs.sostenedor);

  return out;
}

async function exportColegios() {
  const dir = path.dirname(OUT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const ws = fs.createWriteStream(OUT_PATH, { encoding: 'utf8' });
  ws.write(HEADERS_ORDER.map(csvEscape).join(',') + '\n');

  let page = 1; let wrote = 0; let total = 0;
  while (true) {
    const baseParams = {
      publicationState: PUBLICATION_STATE,
      'fields[0]': 'rbd',
      'fields[1]': 'colegio_nombre',
      'fields[2]': 'rbd_digito_verificador',
      'fields[3]': 'dependencia',
      'fields[4]': 'ruralidad',
      'fields[5]': 'estado_estab',
      'fields[6]': 'createdAt',
      'fields[7]': 'updatedAt',
      'fields[8]': 'publishedAt',
      'populate[comuna][fields][0]': 'comuna_nombre',
      'populate[provincia][fields][0]': 'provincia_nombre',
      'populate[region][fields][0]': 'region_nombre',
      'populate[zona][fields][0]': 'zona_nombre',
      'populate[estado_nombre]': 'true',
      'populate[emails]': 'true',
      'populate[telefonos]': 'true',
      'populate[direcciones][populate][region][fields][0]': 'region_nombre',
      'populate[direcciones][populate][comuna][fields][0]': 'comuna_nombre',
      'populate[Website]': 'true',
      'populate[cartera_asignaciones]': 'true',
      'populate[cartera_asignaciones][populate][ejecutivo][fields][0]': 'documentId',
      'populate[cartera_asignaciones][populate][ejecutivo][fields][1]': 'nombre_completo',
      'populate[cartera_asignaciones][populate][ejecutivo][fields][2]': 'rut',
      'populate[cartera_asignaciones][populate][periodo][fields][0]': 'nombre',
      'populate[cartera_asignaciones][populate][periodo][fields][1]': 'estado',
      'populate[sostenedor]': 'true',
      'populate[sostenedor][populate][contacto][fields][0]': 'documentId',
      'populate[sostenedor][populate][contacto][fields][1]': 'nombre_completo',
      'populate[listas_utiles]': 'true',
      'populate[listas_utiles][fields][0]': 'documentId',
      'populate[listas_utiles][fields][1]': 'anio',
      'populate[listas_utiles][fields][2]': 'estado_global',
      'populate[listas_utiles][fields][3]': 'slug',
      'populate[logo][populate][imagen][fields][0]': 'name',
      'pagination[page]': String(page),
      'pagination[pageSize]': String(PAGE_SIZE),
    };
    for (const key of OPTIONAL_POPULATES) {
      if (!disabledPopulates.has(key)) {
        Object.assign(baseParams, OPTIONAL_POPULATE_PARAMS[key]);
      }
    }
    const params = createSearchParams(baseParams);
    const url = `/api/colegios?${params.toString()}`;
    let json;
    try {
      json = await getJson(url);
    } catch (err) {
      const invalidKey = getInvalidKeyFromError(err);
      if (invalidKey && OPTIONAL_POPULATES.includes(invalidKey) && !disabledPopulates.has(invalidKey)) {
        disabledPopulates.add(invalidKey);
        console.warn(`⚠️  Campo opcional "${invalidKey}" no está disponible en la API remota. Reintentando sin ese populate...`);
        continue;
      }
      throw err;
    }
    const data = json?.data || [];
    if (!data.length) break;
    total += data.length;
    for (const entry of data) {
      const flat = flattenColegio(entry);
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
    console.log('== Export Colegios v2 -> CSV ==');
    console.log('API:', API_URL);
    console.log('STATE:', PUBLICATION_STATE);
    console.log('OUT:', OUT_PATH);
    const { wrote, outPath } = await exportColegios();
    console.log(`✅ Exportados ${wrote} colegios a ${outPath}`);
  } catch (err) {
    console.error('❌ Error exportando:', err?.message || err);
    process.exit(1);
  }
})();
