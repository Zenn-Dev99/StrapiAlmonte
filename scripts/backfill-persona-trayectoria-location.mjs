// scripts/backfill-persona-trayectoria-location.mjs
// Copia comuna y región desde el colegio asociado hacia los nuevos campos
// colegio_comuna / colegio_region en persona-trayectoria.

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const STATE = process.env.PUBLICATION_STATE || 'preview';

if (!TOKEN) {
  console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const populateQuery = new URLSearchParams({
  'pagination[page]': '1',
  'pagination[pageSize]': '1',
});

async function getBatch(page, pageSize) {
  const params = new URLSearchParams({
    publicationState: STATE,
    'pagination[page]': String(page),
    'pagination[pageSize]': String(pageSize),
    'fields[0]': 'id',
    'fields[1]': 'documentId',
    'populate[colegio][fields][0]': 'id',
    'populate[colegio][populate][comuna][fields][0]': 'id',
    'populate[colegio][populate][region][fields][0]': 'id',
    'populate[colegio_comuna][fields][0]': 'id',
    'populate[colegio_region][fields][0]': 'id',
  });

  const res = await fetch(`${API_URL}/api/persona-trayectorias?${params.toString()}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET persona-trayectorias -> ${res.status} ${body}`);
  }
  return res.json();
}

async function updateEntry(id, data) {
  const res = await fetch(`${API_URL}/api/persona-trayectorias/${id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT persona-trayectorias/${id} -> ${res.status} ${body}`);
  }
}

function extractId(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const data = entry.data || entry;
  if (data && typeof data.id === 'number') return data.id;
  return null;
}

async function main() {
  console.log('== Backfill comuna/región en persona-trayectorias ==');
  let page = 1;
  const pageSize = 200;
  let updates = 0;
  let skips = 0;

  while (true) {
    const json = await getBatch(page, pageSize);
    const rows = json?.data || [];
    if (!rows.length) break;

    for (const item of rows) {
      const attrs = item.attributes || {};
      const colegio = attrs.colegio?.data;
      const colegioId = colegio?.id;

      if (!colegioId) {
        skips++;
        continue;
      }

      const comunaId = extractId(colegio.attributes?.comuna);
      const regionId = extractId(colegio.attributes?.region);

      const hasComuna = extractId(attrs.colegio_comuna);
      const hasRegion = extractId(attrs.colegio_region);

      if (hasComuna === comunaId && hasRegion === regionId) {
        skips++;
        continue;
      }

      const payload = {
        colegio_comuna: comunaId || null,
        colegio_region: regionId || null,
      };

      const entryId = item.documentId || item.id;
      await updateEntry(entryId, payload);
      updates++;
    }

    const meta = json?.meta?.pagination;
    if (!meta || meta.page >= meta.pageCount) break;
    page++;
  }

  console.log(`✅ Listo. Actualizados=${updates}, Sin cambios=${skips}`);
}

main().catch((err) => {
  console.error('❌ Error en backfill:', err?.message || err);
  process.exit(1);
});
