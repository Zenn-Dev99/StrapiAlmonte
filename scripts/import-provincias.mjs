// scripts/import-provincias.mjs
import fs from "fs";
import { parse } from "csv-parse";
import fetch from "node-fetch";
import http from "http";
import https from "https";
import pLimit from "p-limit";

const STRAPI_URL   = process.env.API_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || "";
const CSV_PATH     = process.argv[2] || "data/provincia.csv";
const CONCURRENCY  = Number(process.env.IMPORT_CONCURRENCY || 4);
const RETRIES      = Number(process.env.IMPORT_RETRIES || 3);
const DRY          = process.env.DRY === "1";
if (!STRAPI_TOKEN) { console.error("❌ Falta STRAPI_TOKEN / IMPORT_TOKEN"); process.exit(1); }

const agent = STRAPI_URL.startsWith("https")
  ? new https.Agent({ keepAlive: true, maxSockets: 100 })
  : new http.Agent({ keepAlive: true, maxSockets: 100 });

const H = () => ({ Authorization: `Bearer ${STRAPI_TOKEN}`, "Content-Type": "application/json" });
async function R(m, p, b) {
  if (DRY && m !== "GET") return { dry: true, m, p, b };
  let r;
  try {
    r = await fetch(`${STRAPI_URL}${p}`, { method: m, headers: H(), body: b ? JSON.stringify(b) : undefined, agent });
  } catch (err) {
    const reason = err?.cause?.code || err?.type || err?.message || 'unknown';
    throw new Error(`NETWORK ${m} ${p} -> ${reason}`);
  }
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${await r.text().catch(()=>"" )}`);
  return r.json();
}
const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));
async function withRetry(fn){
  let lastErr;
  for (let i=0;i<RETRIES;i++){
    try { return await fn(); } catch(e){
      lastErr = e;
      const msg = String(e?.message||'');
      const isNetwork = msg.startsWith('NETWORK ');
      const is5xx = / ->\s*5\d\d/.test(msg);
      if (i < RETRIES-1 && (isNetwork || is5xx)) await sleep(300 * (i+1)); else break;
    }
  }
  throw lastErr;
}
const GET = (p)      => withRetry(() => R("GET", p));
const POST = (p, b)  => withRetry(() => R("POST", p, b));
const PUT = (p, b)   => withRetry(() => R("PUT", p, b));

// Endpoints (v5)
const REGIONES_ENDPOINT   = "/api/regions";
const ZONAS_ENDPOINT      = "/api/zonas";
const PROVINCIAS_ENDPOINT = "/api/provincias";

// Utils
const norm = (s) => String(s ?? "").trim();
const low  = (s) => norm(s).toLowerCase();

async function readCSV(path){
  const out=[];
  const parser=fs
    .createReadStream(path)
    .pipe(
      parse({
        columns: true,
        trim: true,
        skip_empty_lines: true,
        bom: true,
        // Maneja mezcla de terminadores de línea (CRLF/LF/CR)
        record_delimiter: ["\r\n", "\n", "\r"],
      })
    );
  for await (const r of parser) out.push(r);
  return out;
}

function unwrap(entry){
  // Devuelve {id: documentId|id, attrs: attributes|entry}
  if (!entry) return null;
  const id = entry.documentId || entry.id;
  const attrs = entry.attributes || entry;
  return { id, attrs };
}

// Preloads
const regionIdByNombre = new Map();  // key: region_nombre lower -> region documentId
const zonaIdByNombre   = new Map();  // key: zona_nombre lower   -> zona documentId
const provIdByProvId   = new Map();  // key: provincia_id (string) -> provincia documentId
const provIdByNomReg   = new Map();  // key: provincia_nombre lower | regionId -> provincia documentId

async function preloadRegiones(){
  let page=1, size=500, total=0;
  while(true){
    const j = await GET(`${REGIONES_ENDPOINT}?fields[0]=region_nombre&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr = j?.data || [];
    if (!arr.length) break;
    for (const itRaw of arr){
      const it = unwrap(itRaw);
      const nombre = it?.attrs?.region_nombre;
      if (it?.id && nombre) { regionIdByNombre.set(low(nombre), it.id); total++; }
    }
    page++;
  }
  return total;
}

async function preloadZonas(){
  let page=1, size=500, total=0;
  while(true){
    const j = await GET(`${ZONAS_ENDPOINT}?fields[0]=zona_nombre&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr = j?.data || [];
    if (!arr.length) break;
    for (const itRaw of arr){
      const it = unwrap(itRaw);
      const nombre = it?.attrs?.zona_nombre;
      if (it?.id && nombre) { zonaIdByNombre.set(low(nombre), it.id); total++; }
    }
    page++;
  }
  return total;
}

async function preloadProvincias(){
  let page=1, size=500, total=0;
  while(true){
    const j = await GET(`${PROVINCIAS_ENDPOINT}?populate[region]=true&fields[0]=provincia_nombre&fields[1]=provincia_id&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr = j?.data || [];
    if (!arr.length) break;
    for (const itRaw of arr){
      const it = unwrap(itRaw);
      const provNom = it?.attrs?.provincia_nombre;
      const provId  = it?.attrs?.provincia_id;
      const regionId = it?.attrs?.region?.data?.documentId || it?.attrs?.region?.data?.id || null;
      if (it?.id && provNom && regionId){
        provIdByNomReg.set(`${low(provNom)}|${regionId}`, it.id);
      }
      if (it?.id && (provId ?? "") !== ""){
        provIdByProvId.set(String(provId), it.id);
      }
      if (it?.id) total++;
    }
    page++;
  }
  return total;
}

async function preloadAll(){
  const r = await preloadRegiones();
  const z = await preloadZonas();
  const p = await preloadProvincias();
  console.log(`✅ Preload -> Regiones:${r} Zonas:${z} Provincias:${p}`);
}

// Mapping fila CSV -> payload Strapi
function mapRow(row){
  const provincia_nombre = norm(row.provincia_nombre || row.Provincia || row.nombre);
  const provincia_id     = norm(row.provincia_id ?? row.id ?? row.codigo ?? "");
  const region_nombre    = norm(row.region_nombre || row.Region || "");
  const zona_nombre      = norm(row.zona_nombre || row.Zona || "");

  if (!provincia_nombre) throw new Error("Fila sin provincia_nombre");
  if (!region_nombre)    throw new Error("Fila sin region_nombre (necesaria para vincular)");

  const regionId = regionIdByNombre.get(low(region_nombre));
  if (!regionId) throw new Error(`Región no encontrada: '${region_nombre}'`);

  const data = { provincia_nombre };
  if (provincia_id !== "") data.provincia_id = isNaN(Number(provincia_id)) ? provincia_id : Number(provincia_id);
  data.region = { connect: [regionId] };

  if (zona_nombre){
    const zonaId = zonaIdByNombre.get(low(zona_nombre));
    if (zonaId) data.zona = { connect: [zonaId] };
    // Si no existe la zona, simplemente no conectamos; puedes importarlas con import-zonas.mjs
  }

  return { data, regionId, provincia_nombre, provincia_id };
}

// Búsquedas para upsert
async function findProvinciaByProvId(provIdStr){
  const q = `${PROVINCIAS_ENDPOINT}?filters[provincia_id][$eq]=${encodeURIComponent(provIdStr)}&pagination[pageSize]=1`;
  const j = await GET(q);
  const ex = Array.isArray(j?.data) && j.data[0] ? unwrap(j.data[0]) : null;
  return ex?.id || null;
}

// En Strapi v5, al filtrar por relación se debe usar documentId
async function findProvinciaByNombreYRegion(nombre, regionId){
  const q = `${PROVINCIAS_ENDPOINT}?filters[provincia_nombre][$eq]=${encodeURIComponent(nombre)}&filters[region][documentId][$eq]=${encodeURIComponent(regionId)}&pagination[pageSize]=1`;
  const j = await GET(q);
  const ex = Array.isArray(j?.data) && j.data[0] ? unwrap(j.data[0]) : null;
  return ex?.id || null;
}

async function upsert(row, idx){
  const { data, regionId, provincia_nombre, provincia_id } = mapRow(row);

  // 1) Intentar por provincia_id si viene
  if (provincia_id !== ""){
    const key = String(provincia_id);
    let docId = provIdByProvId.get(key);
    if (!docId){
      docId = await findProvinciaByProvId(key);
      if (docId) provIdByProvId.set(key, docId);
    }
    if (docId) return PUT(`${PROVINCIAS_ENDPOINT}/${docId}`, { data });
  }

  // 2) Intentar por nombre + región
  const key2 = `${low(provincia_nombre)}|${regionId}`;
  let docId2 = provIdByNomReg.get(key2);
  if (!docId2){
    docId2 = await findProvinciaByNombreYRegion(provincia_nombre, regionId);
    if (docId2) provIdByNomReg.set(key2, docId2);
  }
  if (docId2) return PUT(`${PROVINCIAS_ENDPOINT}/${docId2}`, { data });

  // 3) No existe -> crear
  return POST(PROVINCIAS_ENDPOINT, { data });
}

(async()=>{
  try{
    console.log("== Import Provincias ==");
    await preloadAll();
    const rows = await readCSV(CSV_PATH);
    console.log("Filas a procesar:", rows.length);

    const limit = pLimit(CONCURRENCY);
    let ok=0, fail=0;
    await Promise.all(rows.map((r,i)=>limit(async()=>{
      try{
        await upsert(r, i+1);
        if(++ok % 25 === 0) console.log(`OK ${ok}/${rows.length}`);
      }catch(e){
        fail++;
        console.error(`❌ Fila ${i+1}: ${e.message}`);
      }
    })));
    console.log(`🎉 Listo Provincias. OK=${ok}, FAIL=${fail}`);
  }catch(e){
    console.error("Fatal:", e.message);
    process.exit(1);
  }
})();
