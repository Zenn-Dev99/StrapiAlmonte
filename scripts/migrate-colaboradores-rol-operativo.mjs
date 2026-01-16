// scripts/migrate-colaboradores-rol-operativo.mjs
// Ajusta colaboradores existentes para poblar rol_operativo, perfiles_operativos y metadata.

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const STATE = process.env.PUBLICATION_STATE || 'preview';
const DRY = process.env.DRY === '1';
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 200);

if (!TOKEN) {
  console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const ROL_MAP = new Map([
  ['soporte', 'support_verify'],
  ['comprobaciones', 'support_approve'],
  ['supervisor', 'support_super'],
  ['comercial', 'sales_exec'],
  ['ventas', 'sales_exec'],
  ['venta', 'sales_exec'],
  ['ejecutivo', 'sales_exec'],
  ['ejecutiva', 'sales_exec'],
  ['ejecutivo_comercial', 'sales_exec'],
  ['ejecutiva_comercial', 'sales_exec'],
  ['jefe_comercial', 'sales_manager'],
  ['jefa_comercial', 'sales_manager'],
  ['gerente_comercial', 'sales_manager'],
]);

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function putJson(path, data) {
  if (DRY) {
    console.log('→ DRY RUN PUT', path, JSON.stringify(data));
    return { dry: true, path, data };
  }
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

function normalizeRol(value) {
  if (!value) return undefined;
  const key = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  return ROL_MAP.get(key);
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function ensureObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

async function main() {
  console.log('== Migrar colaboradores -> rol_operativo/perfiles/metadata ==');
  let page = 1;
  let updates = 0;
  let skips = 0;

  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(PAGE_SIZE),
      publicationState: STATE,
    });

    const json = await getJson(`/api/colaboradores?${params.toString()}`);
    const entries = json?.data || [];
    if (!entries.length) break;

    for (const entry of entries) {
      const id = entry.documentId || entry.id;
      const attr = entry.attributes || entry;

      const desiredRol = attr.rol_operativo || normalizeRol(attr.rol_principal);
      const desiredPerfiles = ensureArray(attr.perfiles_operativos);
      const desiredMetadata = ensureObject(attr.metadata);

      const payload = {};

      if (!attr.rol_operativo && desiredRol) {
        payload.rol_operativo = desiredRol;
      }

      if (!Array.isArray(attr.perfiles_operativos) || attr.perfiles_operativos == null) {
        payload.perfiles_operativos = desiredPerfiles;
      }

      if (attr.metadata == null || typeof attr.metadata !== 'object' || Array.isArray(attr.metadata)) {
        payload.metadata = desiredMetadata;
      }

      if (Object.keys(payload).length) {
        if (attr.publishedAt) payload.publishedAt = attr.publishedAt;
        await putJson(`/api/colaboradores/${id}`, { data: payload });
        updates += 1;
      } else {
        skips += 1;
      }
    }

    const meta = json?.meta?.pagination;
    if (!meta || meta.page >= meta.pageCount) break;
    page += 1;
  }

  console.log(`Listo. Actualizados=${updates}, Sin cambios=${skips}`);
}

main().catch((err) => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});

