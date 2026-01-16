// scripts/import-promocion-contactos.mjs
// Carga/actualiza contactos temporales para campañas desde un CSV.

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN =
  process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const CSV_PATH = process.argv[2] || 'imports/contactos_notion.csv';
const DRY = process.env.DRY === '1';

if (!TOKEN) {
  console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const CICLO_VALUES = new Map([
  ['basico 1 ciclo', 'Básico 1° Ciclo'],
  ['básico 1 ciclo', 'Básico 1° Ciclo'],
  ['basico 1° ciclo', 'Básico 1° Ciclo'],
  ['básico 1° ciclo', 'Básico 1° Ciclo'],
  ['basico primer ciclo', 'Básico 1° Ciclo'],
  ['basico 2 ciclo', 'Básico 2° Ciclo'],
  ['básico 2 ciclo', 'Básico 2° Ciclo'],
  ['basico 2° ciclo', 'Básico 2° Ciclo'],
  ['básico 2° ciclo', 'Básico 2° Ciclo'],
  ['media', 'Educación Media'],
  ['educacion media', 'Educación Media'],
  ['educación media', 'Educación Media'],
]);

const DEPARTAMENTO_VALUES = new Map([
  ['matematica', 'Matemática'],
  ['matemática', 'Matemática'],
  ['lenguaje', 'Lenguaje'],
  ['ciencias', 'Ciencias'],
  ['historia', 'Historia'],
]);

const DEPENDENCIA_VALUES = new Map([
  ['particular pagado', 'Particular Pagado'],
  ['particular subvencionado', 'Particular Subvencionado'],
  ['particular subencionado', 'Particular Subvencionado'],
  ['municipal', 'Municipal'],
  ['administracion delegada', 'Administración Delegada'],
  ['administración delegada', 'Administración Delegada'],
]);

const PRIORIDAD_VALUES = new Map([
  ['alta', 'Alta'],
  ['media', 'Media'],
  ['baja', 'Baja'],
]);

const EJECUTIVO_VALUES = new Map([
  ['ana dolores de la hoz', 'Ana Dolores De la Hoz'],
  ['ana de la hoz', 'Ana Dolores De la Hoz'],
  ['ana dolores de la hoz (ana de la hoz)', 'Ana Dolores De la Hoz'],
  ['margarita salcedo', 'Margarita Salcedo'],
  ['sin asignar', 'Sin Asignar'],
]);

const normalize = (value) => String(value ?? '').trim();
const normalizeKey = (value) =>
  normalize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function loadCsv(file) {
  if (!fs.existsSync(file)) throw new Error(`No existe CSV: ${file}`);
  const buf = fs.readFileSync(file);
  return parse(buf, { columns: true, bom: true, skip_empty_lines: true, trim: true });
}

const splitMulti = (value, map) => {
  const raw = normalize(value);
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => {
      const cleaned = normalize(item).replace(/^"+|"+$/g, '');
      return map.get(normalizeKey(cleaned));
    })
    .filter(Boolean);
};

const mapDependencia = (value) => DEPENDENCIA_VALUES.get(normalizeKey(value));
const mapPrioridad = (value) => PRIORIDAD_VALUES.get(normalizeKey(value));
const mapEjecutivo = (value) => EJECUTIVO_VALUES.get(normalizeKey(value)) || 'Sin Asignar';

const toBoolean = (value) => {
  const norm = normalizeKey(value);
  if (!norm) return false;
  if (['0', 'false', 'no'].includes(norm)) return false;
  if (['1', 'true', 'si', 'sí', 'yes', 'cliente 2025'].includes(norm)) return true;
  return true;
};

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function postJson(path, data) {
  if (DRY) return { dry: true, method: 'POST', path, data };
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function putJson(path, data) {
  if (DRY) return { dry: true, method: 'PUT', path, data };
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function upsertContacto(row) {
  const idRut = normalize(row['ID (RUT)']);
  if (!idRut) throw new Error('Fila sin ID (RUT)');

  const query = new URLSearchParams({
    'filters[id_rut][$eq]': idRut,
    'pagination[pageSize]': '1',
  });

  const existing = await getJson(`/api/promocion-contactos?${query.toString()}`);
  const current = existing?.data?.[0];

  const data = {
    id_rut: idRut,
    nombre: normalize(row['Nombre']),
    apellido: normalize(row['Apellido']),
    email: normalize(row['Email']).toLowerCase() || undefined,
    cargo: normalize(row['Cargo']) || undefined,
    ciclo: splitMulti(row['Ciclo'], CICLO_VALUES),
    asignaturas: normalize(row['Asignaturas']) || undefined,
    departamento: splitMulti(row['Departamento'], DEPARTAMENTO_VALUES),
    rbd: normalize(row['RBD']),
    colegio_nombre: normalize(row['colegio_nombre']),
    dependencia: mapDependencia(row['dependencia']),
    comuna_nombre: normalize(row['comuna_nombre']),
    region_nombre: normalize(row['region_nombre']),
    email_1_email: normalize(row['email_1_email']).toLowerCase() || undefined,
    website_1_website: normalize(row['website_1_website']) || undefined,
    orden: Number.parseInt(normalize(row['Orden']), 10) || undefined,
    cartera_comercial_prioridad: mapPrioridad(row['cartera_comercial_prioridad']),
    cartera_comercial_ejecutivo_nombre: mapEjecutivo(
      row['cartera_comercial_ejecutivo_nombre']
    ),
    promocion_2025: toBoolean(row['Promoción 2025']),
  };

  if (current) {
    const id = current.documentId || current.id;
    return putJson(`/api/promocion-contactos/${id}`, { data });
  }

  return postJson('/api/promocion-contactos', { data });
}

(async () => {
  try {
    console.log('== Import Promoción Contactos ==');
    console.log('CSV:', CSV_PATH);
    const rows = loadCsv(CSV_PATH);
    let ok = 0;
    let fail = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await upsertContacto(row);
        ok += 1;
      } catch (error) {
        fail += 1;
        console.error(`❌ Fila ${index + 1}:`, error?.message || error);
      }
    }
    console.log(`\n✔ Listo. OK=${ok}, FAIL=${fail}`);
  } catch (error) {
    console.error('❌ Error fatal:', error?.message || error);
    process.exit(1);
  }
})();
