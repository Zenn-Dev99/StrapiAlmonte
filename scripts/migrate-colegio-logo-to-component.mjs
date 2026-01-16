// scripts/migrate-colegio-logo-to-component.mjs
// Copia el media `colegio_logo` al componente `logo.imagen[]` (contacto.logo-o-avatar) en todos los colegios.
// Usa env:
//   STRAPI_URL (https://strapi.moraleja.cl)
//   IMPORT_TOKEN (API Token con permisos de update en Colegios)
//   PUBLICATION_STATE (preview|live)
//   DRY=1 para simulación
//   CLEAR_OLD=1 para limpiar el campo antiguo `colegio_logo`

import fetch from 'node-fetch';
import pLimit from 'p-limit';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || '';
const STATE = process.env.PUBLICATION_STATE || 'preview';
const DRY = process.env.DRY === '1';
const CLEAR_OLD = process.env.CLEAR_OLD === '1';
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 6);

if (!TOKEN) { console.error('❌ Falta IMPORT_TOKEN/API_TOKEN/STRAPI_TOKEN'); process.exit(1); }
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function getJson(path) {
  const r = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!r.ok) { const body = await r.text(); throw new Error(`GET ${path} -> ${r.status} ${body}`); }
  return r.json();
}
async function putJson(path, data) {
  if (DRY) return { dry: true, method: 'PUT', path, data };
  const r = await fetch(`${API_URL}${path}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(data) });
  if (!r.ok) { const body = await r.text(); throw new Error(`PUT ${path} -> ${r.status} ${body}`); }
  return r.json();
}

function getAssetId(media) {
  // media puede venir como { data: { id } } o { id }
  if (!media) return null;
  const d = media?.data || media;
  return d?.id || d?.documentId || null;
}

async function main() {
  console.log('== Migrar colegio_logo -> logo.imagen ==');
  let page = 1; const size = 200;
  const limit = pLimit(CONCURRENCY);
  let withOld = 0, already = 0, updated = 0, skipped = 0, fail = 0;

  while (true) {
    const q = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(size),
      'fields[0]': 'colegio_nombre',
      'fields[1]': 'rbd',
      publicationState: STATE,
      'populate[colegio_logo][fields][0]': 'name',
      'populate[colegio_logo][fields][1]': 'url',
      'populate[logo][populate][imagen][fields][0]': 'name',
    });
    const json = await getJson(`/api/colegios?${q.toString()}`);
    const arr = json?.data || [];
    if (!arr.length) break;

    await Promise.all(arr.map((it) => limit(async () => {
      try {
        const id = it.documentId || it.id;
        const a = it.attributes || it;
        const oldMediaId = getAssetId(a.colegio_logo);
        const currentImgs = (a.logo?.imagen?.data || a.logo?.imagen || []);
        const hasLogoImgs = Array.isArray(currentImgs) ? currentImgs.length > 0 : !!currentImgs;
        if (!oldMediaId) { skipped++; return; }
        withOld++;
        if (hasLogoImgs) { already++; return; }
        const data = {
          logo: { imagen: [oldMediaId], tipo: 'Logo' },
        };
        if (CLEAR_OLD) data.colegio_logo = null;
        await putJson(`/api/colegios/${id}`, { data });
        updated++;
      } catch (e) {
        fail++;
        console.error('❌ Error colegio:', it?.id || it?.documentId, e?.message || e);
      }
    })));

    const meta = json?.meta?.pagination; if (!meta || meta.page >= meta.pageCount) break; page += 1;
  }

  console.log(`\n✔ Listo. Con colegio_logo=${withOld}, ya tenían logo.imagen=${already}, actualizados=${updated}, omitidos=${skipped}, errores=${fail}`);
}

main().catch((e) => { console.error('❌ Error fatal:', e?.message || e); process.exit(1); });
