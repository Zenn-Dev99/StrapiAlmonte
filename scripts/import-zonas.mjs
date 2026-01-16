import fs from "fs";
import { parse } from "csv-parse";
import fetch from "node-fetch";
import http from "http";
import https from "https";
import pLimit from "p-limit";

const STRAPI_URL   = process.env.API_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || "";
const CSV_PATH     = process.argv[2] || "data/zona.csv";
const CONCURRENCY  = Number(process.env.IMPORT_CONCURRENCY || 3);
const RETRIES      = Number(process.env.IMPORT_RETRIES || 3);
const DRY          = process.env.DRY === "1";
if (!STRAPI_TOKEN) { console.error("❌ Falta STRAPI_TOKEN / IMPORT_TOKEN / API_TOKEN"); process.exit(1); }

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
const GET =(p)=> withRetry(()=>R("GET", p));
const POST=(p,b)=> withRetry(()=>R("POST",p,b));
const PUT =(p,b)=> withRetry(()=>R("PUT", p,b));

const ZONAS_ENDPOINT      = "/api/zonas";
const PROVINCIAS_ENDPOINT = "/api/provincias";

const norm = (s)=>String(s??"").trim();
async function readCSV(path){
  const out=[];
  const parser=fs
    .createReadStream(path)
    .pipe(parse({ columns:true, trim:true, skip_empty_lines:true, bom:true, record_delimiter:["\r\n","\n","\r"] }));
  for await (const r of parser) out.push(r);
  return out;
}

const zonaIdByName = new Map(); // lower-name -> documentId
const provIdByNombre = new Map(); // lower-name -> documentId

async function preload(){
  let page=1,size=500,total=0;
  while(true){
    const j=await GET(`${ZONAS_ENDPOINT}?fields[0]=zona_nombre&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr=j?.data||[]; if(!arr.length) break;
    for(const it of arr){ const docId=it.documentId||it.id; const nombre=it.attributes?.zona_nombre; if(docId&&nombre){ zonaIdByName.set(nombre.toLowerCase(), docId); total++; } }
    page++;
  }
  console.log(`✅ Zonas precargadas: ${total}`);
}

async function preloadProvincias(){
  let page=1,size=500,total=0;
  while(true){
    const j=await GET(`${PROVINCIAS_ENDPOINT}?fields[0]=provincia_nombre&pagination[page]=${page}&pagination[pageSize]=${size}`);
    const arr=j?.data||[]; if(!arr.length) break;
    for(const it of arr){ const docId=it.documentId||it.id; const nombre=it.attributes?.provincia_nombre; if(docId&&nombre){ provIdByNombre.set(nombre.toLowerCase(), docId); total++; } }
    page++;
  }
  console.log(`✅ Provincias precargadas: ${total}`);
}

function mapRow(row){
  const zona_nombre = norm(row.zona_nombre || row.Zona || row.nombre);
  const zona_id     = norm(row.zona_id || row.codigo || row.Codigo); // custom field entero
  if(!zona_nombre) throw new Error("Fila sin zona_nombre");
  const data = { zona_nombre };
  if (zona_id) data.zona_id = Number(zona_id);
  return data;
}

async function upsert(row){
  const data = mapRow(row);
  const key = data.zona_nombre.toLowerCase();

  let strapiId = zonaIdByName.get(key);
  if(!strapiId){
    const j = await GET(`${ZONAS_ENDPOINT}?filters[zona_nombre][$eq]=${encodeURIComponent(data.zona_nombre)}&pagination[pageSize]=1`);
    const ex = Array.isArray(j?.data) && j.data[0] ? j.data[0] : null;
    const docId = ex?.documentId || ex?.id;
    if (docId){ strapiId = docId; zonaIdByName.set(key, strapiId); }
  }
  if (strapiId) {
    // Para evitar conflictos de unicidad en updates, no forzamos zona_id en PUT
    const { zona_nombre } = data;
    return PUT(`${ZONAS_ENDPOINT}/${strapiId}`, { data: { zona_nombre } });
  }
  const created = await POST(ZONAS_ENDPOINT, { data });
  try {
    const newId = created?.data?.documentId || created?.data?.id;
    if (newId) zonaIdByName.set(key, newId);
  } catch (_) {}
  return created;
}

// (opcional) si tu CSV de zonas trae "provincia_nombre", puedes vincularlas aquí.
async function linkProvinciaToZona(provinciaNombre, zonaNombre){
  const zonaId = zonaIdByName.get(String(zonaNombre || "").toLowerCase());
  if(!zonaId) throw new Error(`Zona '${zonaNombre}' no existe`);
  // busca provincia en caché antes de ir a la API
  let provinciaId = provIdByNombre.get(String(provinciaNombre || "").toLowerCase()) || null;
  if(!provinciaId){
    const j = await GET(`${PROVINCIAS_ENDPOINT}?filters[provincia_nombre][$eq]=${encodeURIComponent(provinciaNombre)}&pagination[pageSize]=1`);
    const ex = Array.isArray(j?.data) && j.data[0] ? j.data[0] : null;
    provinciaId = ex?.documentId || ex?.id || null;
    if (provinciaId) provIdByNombre.set(String(provinciaNombre).toLowerCase(), provinciaId);
  }
  if(!provinciaId) throw new Error(`Provincia '${provinciaNombre}' no existe`);
  // manyToOne en provincia: set relación con connect
  await PUT(`${PROVINCIAS_ENDPOINT}/${provinciaId}`, { data: { zona: { connect: [zonaId] } }});
}

(async()=>{
  try{
    console.log("== Import Zonas ==");
    await preload();
    await preloadProvincias();
    const rows = await readCSV(CSV_PATH);
    console.log("Filas a procesar:", rows.length);
    const limit = pLimit(CONCURRENCY);
    let ok=0, fail=0;
    // 1) Upsert de zonas (únicas por nombre)
    const uniqueByName = new Map();
    for (const r of rows) {
      const name = String(r.zona_nombre || r.Zona || r.nombre || '').trim();
      if (!name) continue;
      if (!uniqueByName.has(name.toLowerCase())) uniqueByName.set(name.toLowerCase(), r);
    }
    await Promise.all(Array.from(uniqueByName.values()).map((r,i)=>limit(async()=>{
      try{
        await upsert(r);
        if(++ok%25===0) console.log(`OK zonas ${ok}/${uniqueByName.size}`);
      }catch(e){ fail++; console.error(`❌ Zona (${i+1}): ${e.message}`); }
    })));
    console.log(`Upsert zonas -> OK=${ok}, FAIL=${fail}`);

    // 2) Vincular provincias -> zonas (únicas)
    const toLink = new Map(); // provinciaNombre(lower) -> zonaNombre
    for (const r of rows) {
      if (r.provincia_nombre && r.zona_nombre) {
        const k = String(r.provincia_nombre).toLowerCase();
        toLink.set(k, r.zona_nombre);
      }
    }
    const linkLimit = pLimit(Math.min(2, CONCURRENCY));
    let linkOk=0, linkFail=0;
    await Promise.all(Array.from(toLink.entries()).map(([provLower, zonaNombre])=>linkLimit(async()=>{
      try{
        const provOriginal = rows.find(x => String(x.provincia_nombre||"").toLowerCase()===provLower)?.provincia_nombre || provLower;
        await linkProvinciaToZona(provOriginal, zonaNombre);
        linkOk++;
      }catch(e){ linkFail++; console.warn(`link ${provLower} -> ${zonaNombre}: ${e.message}`); }
    })));
    console.log(`🎉 Listo Zonas. CREAR/PUT: OK=${ok}, FAIL=${fail}. LINKS OK=${linkOk}, FAIL=${linkFail}`);
  }catch(e){ console.error("Fatal:", e.message); process.exit(1); }
})();
