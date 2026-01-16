// scripts/import-regiones.mjs
import fs from "fs";
import { parse } from "csv-parse";
import fetch from "node-fetch";
import http from "http";
import https from "https";
import pLimit from "p-limit";

const STRAPI_URL   = process.env.API_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || "";
const CSV_PATH     = process.argv[2] || "data/region.csv";
const CONCURRENCY  = Number(process.env.IMPORT_CONCURRENCY || 12);
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
const GET = (p) => R("GET", p), POST = (p, b) => R("POST", p, b), PUT = (p, b) => R("PUT", p, b);

const ENDPOINT = "/api/regions";
const norm = (s) => String(s ?? "").trim();
async function readCSV(path){
  const out=[];
  const parser=fs
    .createReadStream(path)
    .pipe(parse({ columns:true, trim:true, skip_empty_lines:true, bom:true, record_delimiter:["\r\n","\n","\r"] }));
  for await (const r of parser) out.push(r);
  return out;
}

// nombre(lower) -> docId (Strapi v5 usa documentId en write routes)
const docIdByNombre = new Map();

async function preload() {
  let page=1, size=500, total=0;
  while (true) {
    // OJO: aunque pidamos solo fields de atributos, Strapi devuelve id/documentId a nivel raíz
    const j = await GET(`${ENDPOINT}?fields[0]=region_nombre&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr = j?.data || [];
    if (!arr.length) break;
    for (const it of arr) {
      // Preferimos documentId (v5). Si no está, caemos a id.
      const docId  = it.documentId || it.id;
      const nombre = it.attributes?.region_nombre ?? it.region_nombre;
      if (docId && nombre) { docIdByNombre.set(nombre.toLowerCase(), docId); total++; }
    }
    page++;
  }
  console.log(`✅ Regiones precargadas: ${total}`);
}

function mapRow(row) {
  const region_nombre = norm(row.region_nombre || row.Region || row.nombre);
  const region_numero = norm(row.region_numero || row.numero || row.Numero);
  // region_id debe ser entero en Strapi; convertimos limpiamente aquí
  const region_id_raw = row.region_id ?? row.codigo ?? row.Codigo;
  const parsed_id = Number.parseInt(String(region_id_raw ?? "").trim(), 10);
  const region_id = Number.isNaN(parsed_id) ? null : parsed_id; // tu campo custom
  if (!region_nombre) throw new Error("Fila sin region_nombre");

  const data = { region_nombre };
  if (region_numero) data.region_numero = region_numero;
  if (Number.isInteger(region_id)) data.region_id = region_id;

  return data;
}

async function upsert(row){
  const data = mapRow(row);
  const key = data.region_nombre.toLowerCase();

  let docId = docIdByNombre.get(key);
  if (!docId) {
    // búsqueda puntual
    const j = await GET(`${ENDPOINT}?filters[region_nombre][$eq]=${encodeURIComponent(data.region_nombre)}&pagination[pageSize]=1`);
    const ex = Array.isArray(j?.data) && j.data[0] ? j.data[0] : null;
    if (ex) {
      docId = ex.documentId || ex.id;
      if (docId) docIdByNombre.set(key, docId);
    }
  }

  // En Strapi v5, los write routes (PUT/DELETE) usan documentId
  if (docId) return PUT(`${ENDPOINT}/${docId}`, { data });
  return POST(ENDPOINT, { data });
}

(async()=>{
  try{
    console.log("== Import Regiones ==");
    await preload();
    const rows = await readCSV(CSV_PATH);
    console.log("Filas a procesar:", rows.length);

    const limit = pLimit(CONCURRENCY);
    let ok=0, fail=0;
    await Promise.all(rows.map((r,i)=>limit(async()=>{
      try { await upsert(r); if(++ok%50===0) console.log(`OK ${ok}/${rows.length}`); }
      catch(e){ fail++; console.error(`❌ Fila ${i+1}: ${e.message}`); }
    })));
    console.log(`🎉 Listo Regiones. OK=${ok}, FAIL=${fail}`);
  }catch(e){ console.error("Fatal:", e.message); process.exit(1); }
})();
