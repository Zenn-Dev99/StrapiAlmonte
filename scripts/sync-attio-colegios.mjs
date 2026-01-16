#!/usr/bin/env node

import fetch from 'node-fetch';
import pLimit from 'p-limit';

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337';
const STRAPI_TOKEN = process.env.IMPORT_TOKEN ?? process.env.STRAPI_TOKEN;
const ATTIO_TOKEN = process.env.ATTIO_API_TOKEN;
const DRY_RUN = process.env.DRY === '1';
const PAGE_SIZE = Number.parseInt(process.env.PAGE_SIZE ?? '50', 10) || 50;
const ATTIO_CONCURRENCY = Number.parseInt(process.env.ATTIO_CONCURRENCY ?? '3', 10) || 3;
const MAX_PAGES = process.env.MAX_PAGES ? Number.parseInt(process.env.MAX_PAGES, 10) : null;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta el token de Strapi (IMPORT_TOKEN o STRAPI_TOKEN).');
  process.exit(1);
}

if (!ATTIO_TOKEN) {
  console.error('❌ Falta el token de Attio (ATTIO_API_TOKEN).');
  process.exit(1);
}

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

const ATTIO_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${ATTIO_TOKEN}`,
};

async function strapiRequest(path, options = {}) {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: STRAPI_HEADERS,
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Strapi ${options.method ?? 'GET'} ${path} -> ${res.status} ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function attioRequest(path, { method = 'GET', body } = {}) {
  if (DRY_RUN && method !== 'GET') {
    console.log(`DRY-RUN Attio ${method} ${path}`);
    if (body) {
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        console.log(body);
      }
    }
    return { data: { id: { record_id: 'dry-run' } } };
  }

  const res = await fetch(`https://api.attio.com/v2${path}`, {
    method,
    headers: ATTIO_HEADERS,
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Attio ${method} ${path} -> ${res.status} ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function extractDomain(website) {
  if (!website) return null;
  let clean = website.trim();
  if (!clean) return null;
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  try {
    const { hostname } = new URL(clean);
    return hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return clean.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
  }
}

function pickWebsite(attributes) {
  const raw = attributes?.Website ?? attributes?.website ?? [];
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;

  const preferred = raw.find((item) => {
    const status = item?.status ?? item?.attributes?.status;
    return status !== false;
  }) ?? raw[0];

  return preferred?.website ?? preferred?.attributes?.website ?? null;
}

function buildAttioValues(attributes) {
  const values = {};
  const name = (attributes?.colegio_nombre || '').trim();
  if (!name) {
    return null;
  }
  values.name = name;

  const rbd = attributes?.rbd;
  if (rbd !== undefined && rbd !== null) {
    const numeric = Number.parseInt(rbd, 10);
    if (!Number.isNaN(numeric)) {
      values.rbd = numeric;
    }
  }

  const website = pickWebsite(attributes);
  const domain = extractDomain(website);
  if (domain) {
    values.domains = [domain];
  }

  const estado = attributes?.estado;
  if (estado && typeof estado === 'string') {
    values.nombre_estado = estado;
  }

  const dependencia = attributes?.dependencia;
  if (dependencia && typeof dependencia === 'string') {
    values.dependencia = [dependencia];
  }

  const comunaSource = attributes?.comuna?.data?.attributes ?? attributes?.comuna?.attributes ?? attributes?.comuna;
  const comunaNombre = (comunaSource?.comuna_nombre || '').trim();
  if (comunaNombre) {
    values.comuna = comunaNombre;
  }
  if (!values.comuna) {
    const fallbackComuna = (attributes?.comuna_nombre || '').trim();
    if (fallbackComuna) {
      values.comuna = fallbackComuna;
    }
  }

  const regionNombre = (comunaSource?.region_nombre || '').trim();
  if (regionNombre) {
    values.region = regionNombre;
  }
  if (!values.region) {
    const fallbackRegion = (attributes?.region || '').trim();
    if (fallbackRegion) {
      values.region = fallbackRegion;
    }
  }

  return values;
}

async function updateStrapiColegio(entryIdentifier, data) {
  let identifier = entryIdentifier;
  if (typeof identifier === 'object' && identifier !== null) {
    identifier = identifier.documentId ?? identifier.id ?? null;
  }

  if (!identifier) {
    throw new Error('No se pudo determinar el identificador del colegio en Strapi');
  }

  if (DRY_RUN) {
    console.log(`DRY-RUN Strapi PUT /api/colegios/${identifier}`, data);
    return null;
  }

  return strapiRequest(`/api/colegios/${identifier}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
}

function unwrapAttributes(entry) {
  if (!entry || typeof entry !== 'object') return {};
  return entry.attributes ?? entry;
}

async function syncColegio(entry) {
  const { id } = entry;
  const attrs = unwrapAttributes(entry);
  const values = buildAttioValues(attrs);
  if (!values) {
    return { id, status: 'skipped', reason: 'Sin nombre válido' };
  }

  const metadata = {
    syncedAt: new Date().toISOString(),
    payload: values,
  };

  try {
    if (attrs.attio_company_id) {
      await attioRequest(`/objects/companies/records/${attrs.attio_company_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ data: { values } }),
      });

      await updateStrapiColegio({ id, documentId: entry.documentId ?? attrs.documentId }, {
        attio_metadata: metadata,
      });

      return { id, status: 'updated', attioId: attrs.attio_company_id };
    }

    const response = await attioRequest('/objects/companies/records', {
      method: 'POST',
      body: JSON.stringify({ data: { values } }),
    });

    const attioId = response?.data?.id?.record_id;
    if (!attioId) {
      throw new Error('No se recibió record_id desde Attio');
    }

    await updateStrapiColegio({ id, documentId: entry.documentId ?? attrs.documentId }, {
      attio_company_id: attioId,
      attio_metadata: metadata,
    });

    return { id, status: 'created', attioId };
  } catch (error) {
    return { id, status: 'error', error: error.message };
  }
}

async function fetchColegioPage(page) {
  const params = new URLSearchParams({
    'pagination[page]': String(page),
    'pagination[pageSize]': String(PAGE_SIZE),
    'sort[0]': 'id:asc',
    'fields[0]': 'colegio_nombre',
    'fields[1]': 'rbd',
    'fields[2]': 'estado',
    'fields[3]': 'dependencia',
    'fields[4]': 'attio_company_id',
    'fields[5]': 'attio_metadata',
    'fields[6]': 'region',
    'populate[Website][fields][0]': 'website',
    'populate[Website][fields][1]': 'status',
    'populate[comuna][fields][0]': 'comuna_nombre',
    'populate[comuna][fields][1]': 'region_nombre',
  });

  return strapiRequest(`/api/colegios?${params.toString()}`);
}

async function main() {
  console.log('▶️  Sincronizando colegios con Attio...');
  console.log(`    DRY_RUN=${DRY_RUN ? 'sí' : 'no'}, PAGE_SIZE=${PAGE_SIZE}, ATTIO_CONCURRENCY=${ATTIO_CONCURRENCY}`);

  const limit = pLimit(ATTIO_CONCURRENCY);
  let page = 1;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  while (true) {
    const json = await fetchColegioPage(page);
    const items = json?.data ?? [];
    if (items.length === 0) break;

    const tasks = items.map((entry) => limit(() => syncColegio(entry)));
    const results = await Promise.all(tasks);

    for (const result of results) {
      if (result.status === 'created') {
        created += 1;
        console.log(`➕ Creado en Attio: colegio ${result.id} → ${result.attioId}`);
      } else if (result.status === 'updated') {
        updated += 1;
        console.log(`🔁 Actualizado en Attio: colegio ${result.id} (${result.attioId})`);
      } else if (result.status === 'skipped') {
        skipped += 1;
        console.log(`↷ Saltado colegio ${result.id}: ${result.reason}`);
      } else {
        errors += 1;
        console.error(`❌ Error colegio ${result.id}: ${result.error}`);
      }
    }

    const pagination = json?.meta?.pagination;
    if (!pagination || pagination.page >= pagination.pageCount) break;
    if (MAX_PAGES && page >= MAX_PAGES) {
      console.log(`\nDetenido después de alcanzar MAX_PAGES=${MAX_PAGES}.`);
      break;
    }
    page += 1;
  }

  console.log('\nResumen:');
  console.log(`  ➕ Creados: ${created}`);
  console.log(`  🔁 Actualizados: ${updated}`);
  console.log(`  ↷ Saltados: ${skipped}`);
  console.log(`  ❌ Errores: ${errors}`);

  if (DRY_RUN) {
    console.log('\n(DRY-RUN) No se realizaron cambios en Strapi ni Attio.');
  }
}

main().catch((error) => {
  console.error('Error general:', error);
  process.exit(1);
});

