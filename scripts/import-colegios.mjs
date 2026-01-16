// scripts/import-colegios.mjs
import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import fetch, { FormData, fileFromSync } from "node-fetch";
import mime from "mime-types";
import pLimit from "p-limit";
import http from "http";
import https from "https";

const STRAPI_URL = process.env.API_URL || process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN || "";
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || 3);
const RETRIES = Number(process.env.IMPORT_RETRIES || 5);
const DELAY_MS = Number(process.env.IMPORT_DELAY_MS || 0);
const DRY = process.env.DRY === "1";
const CSV_PATH = process.argv[2] || "data/colegios.csv";
process.env.IMPORT_MODE = process.env.IMPORT_MODE || "1";
if (!STRAPI_TOKEN) { console.error("❌ Falta STRAPI_TOKEN / IMPORT_TOKEN."); process.exit(1); }

// Reutiliza un único agente Keep-Alive para todas las requests
const agent = (STRAPI_URL || '').startsWith('https')
  ? new https.Agent({ keepAlive: true, maxSockets: 200 })
  : new http.Agent({ keepAlive: true, maxSockets: 200 });

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${STRAPI_TOKEN}`, "Content-Type": "application/json", ...extra };
}
const sleep = (ms)=> new Promise(res=>setTimeout(res, ms));
async function withRetry(fn, label){
  let lastErr;
  for (let i=0;i<RETRIES;i++){
    try { return await fn(); } catch(e){
      lastErr = e;
      const msg = String(e?.message||'');
      const isNetwork = msg.startsWith('request to') || msg.startsWith('network') || msg.includes('fetch') || msg.includes('socket hang up');
      const is5xx = /->\s*5\d\d/.test(msg);
      if (i < RETRIES-1 && (isNetwork || is5xx)) await sleep(600 * (i+1) + Math.floor(Math.random()*200)); else break;
    }
  }
  throw lastErr;
}
async function apiGet(path) {
  return withRetry(async()=>{
    const res = await fetch(`${STRAPI_URL}${path}`, { headers: authHeaders(), agent });
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text().catch(()=> "")}`);
    return res.json();
  }, `GET ${path}`);
}
async function apiPost(path, body) {
  if (DRY) return { dry: true, method: "POST", path, body };
  return withRetry(async()=>{
    const res = await fetch(`${STRAPI_URL}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body), agent });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text().catch(()=> "")}`);
    return res.json();
  }, `POST ${path}`);
}
async function apiPut(path, body) {
  if (DRY) return { dry: true, method: "PUT", path, body };
  return withRetry(async()=>{
    const res = await fetch(`${STRAPI_URL}${path}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body), agent });
    if (!res.ok) throw new Error(`PUT ${path} -> ${res.status} ${await res.text().catch(()=> "")}`);
    return res.json();
  }, `PUT ${path}`);
}

// ===== Upload helpers (logo) =====
async function apiGetUploadByName(name) {
  const q = `/api/upload/files?pagination[pageSize]=1&filters[name][$eq]=${encodeURIComponent(name)}`;
  const json = await apiGet(q);
  if (Array.isArray(json)) return json[0] || null;
  if (Array.isArray(json?.data)) return json.data[0] || null;
  return null;
}

async function apiUploadFile(filePath, fileName) {
  if (DRY) return { dry: true, method: "UPLOAD", path: "/api/upload", filePath, fileName };
  const form = new FormData();
  const type = mime.lookup(fileName) || "application/octet-stream";
  const file = fileFromSync(filePath, type);
  form.append("files", file, fileName);
  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    body: form,
    agent,
  });
  if (!res.ok) throw new Error(`UPLOAD /api/upload -> ${res.status} ${await res.text().catch(()=> "")}`);
  const out = await res.json();
  if (Array.isArray(out) && out[0]) return out[0];
  if (Array.isArray(out?.data) && out.data[0]) return out.data[0];
  return out;
}

const logoIdByName = new Map();
async function ensureLogoId(logoValue) {
  if (!logoValue) return null;
  const raw = String(logoValue).trim();
  if (!raw) return null;
  const candidate = path.isAbsolute(raw) ? raw : path.join("data", "logos", raw);
  const fileName = path.basename(candidate);
  if (logoIdByName.has(fileName)) return logoIdByName.get(fileName);
  let exists = null;
  try { exists = await apiGetUploadByName(fileName); } catch (_) { /* ignore */ }
  if (exists?.id) { logoIdByName.set(fileName, exists.id); return exists.id; }
  if (!fs.existsSync(candidate)) {
    console.warn(`⚠️  Logo no encontrado localmente: ${candidate}`);
    return null;
  }
  try {
    const uploaded = await apiUploadFile(candidate, fileName);
    const id = uploaded?.id || uploaded?.documentId || null;
    if (id) logoIdByName.set(fileName, id);
    return id;
  } catch (e) {
    console.error(`❌ Error subiendo logo '${fileName}':`, e?.message || e);
    return null;
  }
}

async function readCSV(path) {
  if (!fs.existsSync(path)) throw new Error(`No existe el CSV: ${path}`);
  const input = fs.createReadStream(path);
  const records = [];
  const parser = input.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      // Soporta mezcla de terminadores de línea (CRLF/LF/CR)
      record_delimiter: ["\r\n", "\n", "\r"],
    })
  );
  for await (const row of parser) records.push(row);
  return records;
}

const mapComunaByNombre = new Map();
// comuna -> { comunaId, provId, regId, zonId }
const comunaGeoByNombre = new Map();
function normalizeNombre(s) { return String(s || "").trim().toLowerCase(); }
function normalizeSinAcento(s){
  return normalizeNombre(s).normalize('NFD').replace(/\p{Diacritic}/gu,'');
}
function readField(item, key) { if (!item) return undefined; if (key in item) return item[key]; if (item.attributes && key in item.attributes) return item.attributes[key]; return undefined; }
function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i, i+size)); return out; }

async function preloadComunas() {
  console.log("⏳ Precargando comunas...");
  let page = 1, total = 0;
  const pageSize = 500; // usa maxLimit elevado
  while (true) {
    const json = await apiGet(
      `/api/comunas?fields[0]=comuna_nombre&` +
      // Incluye documentId explícitamente para relaciones anidadas
      `populate[provincia][fields][0]=documentId&populate[provincia][fields][1]=id&` +
      `populate[provincia][populate][region][fields][0]=documentId&` +
      `populate[provincia][populate][zona][fields][0]=documentId&` +
      `pagination[page]=${page}&pagination[pageSize]=${pageSize}`
    );
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const it of items) {
      const nombre = readField(it, "comuna_nombre");
      const docId = it.documentId || it.id;
      if (nombre && docId) {
        const k1 = normalizeNombre(nombre);
        const k2 = normalizeSinAcento(nombre);
        mapComunaByNombre.set(k1, docId);
        mapComunaByNombre.set(k2, docId);
        // Extrae prov/region/zona
        const provData = it.attributes?.provincia?.data || null;
        const provId = provData?.documentId || provData?.id || null;
        const regData = provData?.attributes?.region?.data || null;
        const regId  = regData?.documentId || regData?.id || null;
        const zonData = provData?.attributes?.zona?.data || null;
        const zonId  = zonData?.documentId || zonData?.id || null;
        const val = { comunaId: docId, provId, regId, zonId };
        comunaGeoByNombre.set(k1, val);
        comunaGeoByNombre.set(k2, val);
      }
    }
    total += items.length;
    const meta = json?.meta?.pagination;
    if (!meta || page >= meta.pageCount) break;
    page += 1;
  }
  console.log(`✅ Comunas precargadas: ${total}`);
}
function comunaIdFromNombre(nombre) {
  if (!nombre) return null;
  const k1 = normalizeNombre(nombre);
  const k2 = normalizeSinAcento(nombre);
  return mapComunaByNombre.get(k1) || mapComunaByNombre.get(k2) || null;
}

function unwrap(entry){
  if (!entry) return null;
  const attrs = entry.attributes || entry;
  const id = entry.documentId || entry.id;
  return { id, attrs };
}
function relDocId(rel){
  const d = rel?.data;
  return d?.documentId || d?.id || null;
}

// Mapa global de colegios existentes por RBD -> { id, attrs:{...}, rels:{...} }
const existingByRbd = new Map();

async function preloadColegiosAll() {
  console.log("⏳ Precargando colegios existentes (mapa por RBD)...");
  let page = 1;
  const pageSize = 500; // usa maxLimit configurado
  let total = 0;
  while (true) {
    const path = `/api/colegios?fields[0]=colegio_nombre&fields[1]=rbd&fields[2]=dependencia&fields[3]=colegio_direccion_calle`+
      `&fields[4]=colegio_direccion_numero&fields[5]=colegio_direccion_referencia&fields[6]=colegio_web`+
      `&fields[7]=colegio_telefono_mc01&fields[8]=colegio_telefono_mc02`+
      `&fields[9]=colegio_direccion_completa&fields[10]=ruralidad&fields[11]=estado_estab&fields[12]=status_web&fields[13]=status_direccion`+
      `&fields[14]=rbd_digito_verificador&fields[15]=colegio_mail01&fields[16]=colegio_mail02`+
      `&fields[17]=status_colegio_logo&fields[18]=status_colegio_nombre&fields[19]=status_colegio_telefono_mc01&fields[20]=status_colegio_telefono_mc02`+
      `&fields[21]=status_colegio_mail01&fields[22]=status_colegio_mail02`+
      `&populate[comuna][fields][0]=id&populate[provincia][fields][0]=id&populate[region][fields][0]=id&populate[zona][fields][0]=id`+
      `&populate[colegio_logo][fields][0]=id`+
      `&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
    const json = await apiGet(path);
    const items = Array.isArray(json?.data) ? json.data : [];
    if (!items.length) break;
    for (const raw of items) {
      const it = unwrap(raw);
      const rbd = Number(it?.attrs?.rbd);
      if (!Number.isFinite(rbd)) continue;
      it.rels = {
        comuna: relDocId(it.attrs?.comuna),
        provincia: relDocId(it.attrs?.provincia),
        region: relDocId(it.attrs?.region),
        zona: relDocId(it.attrs?.zona),
        logo: relDocId(it.attrs?.colegio_logo),
      };
      existingByRbd.set(rbd, it);
      total++;
    }
    const meta = json?.meta?.pagination;
    if (!meta || page >= meta.pageCount) break;
    page++;
  }
  console.log(`✅ Colegios precargados (existentes): ${total}`);
}

async function preloadColegiosByRbd(rbdValues){
  const uniq = Array.from(new Set(rbdValues.filter((v)=>v!=null)));
  if (uniq.length === 0) return 0;
  let loaded = 0;
  const batches = chunk(uniq, 100);
  for (const group of batches){
    const inParams = group.map((v)=>`filters[rbd][$in]=${encodeURIComponent(v)}`).join('&');
    const path = `/api/colegios?${inParams}`+
      `&fields[0]=colegio_nombre&fields[1]=rbd&fields[2]=dependencia&fields[3]=colegio_direccion_calle`+
      `&fields[4]=colegio_direccion_numero&fields[5]=colegio_direccion_referencia&fields[6]=colegio_web`+
      `&fields[7]=colegio_telefono_mc01&fields[8]=colegio_telefono_mc02`+
      `&fields[9]=colegio_direccion_completa&fields[10]=ruralidad&fields[11]=estado_estab&fields[12]=status_web&fields[13]=status_direccion`+
      `&fields[14]=rbd_digito_verificador&fields[15]=colegio_mail01&fields[16]=colegio_mail02`+
      `&fields[17]=status_colegio_logo&fields[18]=status_colegio_nombre&fields[19]=status_colegio_telefono_mc01&fields[20]=status_colegio_telefono_mc02`+
      `&fields[21]=status_colegio_mail01&fields[22]=status_colegio_mail02`+
      `&populate[comuna][fields][0]=id&populate[provincia][fields][0]=id&populate[region][fields][0]=id&populate[zona][fields][0]=id`+
      `&pagination[pageSize]=200`;
    const json = await apiGet(path);
    const items = Array.isArray(json?.data) ? json.data : [];
    for (const raw of items){
      const item = unwrap(raw);
      const key = item?.attrs?.rbd ?? null;
      if (key == null) continue;
      item.rels = {
        comuna: relDocId(item.attrs?.comuna),
        provincia: relDocId(item.attrs?.provincia),
        region: relDocId(item.attrs?.region),
        zona: relDocId(item.attrs?.zona),
      };
      cacheColegioByRbd.set(Number(key), item);
      loaded++;
    }
  }
  console.log(`✅ Colegios precargados por RBD: ${loaded}`);
  return loaded;
}

function toIntOrNull(v) { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(/\D+/g, "")); return Number.isFinite(n) ? n : null; }
function compact(obj) { const out = {}; Object.entries(obj).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== "") out[k] = v; }); return out; }

function normalizePhoneCL(v) {
  if (!v) return null;
  const d = String(v).replace(/\D+/g, '');
  if (!d) return null;
  // Guardar solo 9 dígitos (vista antepone +56). Si trae más, tomar los últimos 9.
  if (d.length >= 9) return d.slice(-9);
  return null;
}

function normalizeRbdDv(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim().toUpperCase();
  if (!str) return null;
  const sanitized = str.replace(/[^0-9K]/gi, '').toUpperCase();
  if (!sanitized) return null;
  return sanitized.charAt(sanitized.length - 1);
}

function normalizeEmail(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const email = raw.replace(/\s+/g, '').toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? email : null;
}

function normalizeVerificationStatus(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const simple = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (!simple) return null;
  if (simple.includes('por') || simple.includes('pend')) return 'Por verificar';
  if (simple.includes('verific') || simple.includes('listo') || simple.includes('ok')) return 'Verificado';
  if (simple === 'si' || simple === 'true') return 'Verificado';
  if (simple === 'no' || simple === 'false') return 'Por verificar';
  return null;
}

function mapRowToPayload(row, ids) {
  const nombre = row.colegio_nombre || row.nombre || row.Nombre || row.Colegio || null;
  const rbd = toIntOrNull(row.rbd || row.RBD);
  const rbdDv = normalizeRbdDv(row.rbd_digito_verificador || row.dv || row.DV || null);
  // Web: mantener dominio/plano tal como viene en CSV (sin https)
  const rawWeb = row.colegio_web || row.web || null;
  const web = rawWeb ? String(rawWeb).trim() : null;
  const tel1 = normalizePhoneCL(row.colegio_telefono_mc01 || row.telefono1 || row["telefono 1"] || null);
  const tel2 = normalizePhoneCL(row.colegio_telefono_mc02 || row.telefono2 || row["telefono 2"] || null);
  // Mapeo enums
  const estMap = new Map([
    ['1','Funcionando'], ['2','En receso'], ['3','Cerrado'], ['4','Autorizado sin matrícula']
  ]);
  const norm = (s)=> String(s||'').trim();
  const normSimple = (s)=> norm(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  let estado_estab = null;
  if (row.estado_estab != null) {
    const v = norm(row.estado_estab);
    estado_estab = estMap.get(v) || (()=>{
      const vs = normSimple(v);
      if (!vs) return null;
      if (vs.startsWith('funcion')) return 'Funcionando';
      if (vs.includes('receso')) return 'En receso';
      if (vs.startsWith('cerr')) return 'Cerrado';
      if (vs.startsWith('autorizado')) return 'Autorizado sin matrícula';
      return null;
    })();
  }
  let status_web = null;
  if (row.status_web != null) {
    const vs = normSimple(row.status_web);
    if (vs) status_web = vs.includes('no') ? 'No tiene' : 'Revisada';
  }
  const status_direccion = normalizeVerificationStatus(row.status_direccion);
  const status_logo = normalizeVerificationStatus(row.status_colegio_logo);
  const status_nombre = normalizeVerificationStatus(row.status_colegio_nombre);
  const status_tel1 = normalizeVerificationStatus(row.status_colegio_telefono_mc01 || row.status_colegio_telefono_1);
  const status_tel2 = normalizeVerificationStatus(row.status_colegio_telefono_mc02 || row.status_colegio_telefono_2);
  const status_mail1 = normalizeVerificationStatus(row.status_colegio_mail01 || row.status_mail_01);
  const status_mail2 = normalizeVerificationStatus(row.status_colegio_mail02 || row.status_mail_02);
  const mail1 = normalizeEmail(row.colegio_mail01 || row.mail1 || row["correo1"] || row["correo 1"]);
  const mail2 = normalizeEmail(row.colegio_mail02 || row.mail2 || row["correo2"] || row["correo 2"]);
  const payload = {
    colegio_nombre: nombre,
    rbd,
    rbd_digito_verificador: rbdDv,
    dependencia: row.dependencia || row.Dependencia || null,
    ruralidad: row.ruralidad || null,
    colegio_direccion_calle: row.colegio_direccion_calle || row.calle || row.Calle || null,
    colegio_direccion_numero: row.colegio_direccion_numero || row.numero || row.Número || null,
    colegio_direccion_referencia: row.colegio_direccion_referencia || row.referencia || null,
    colegio_direccion_completa: row.colegio_direccion_completa || null,
    colegio_web: web,
    colegio_telefono_mc01: tel1,
    colegio_telefono_mc02: tel2,
    colegio_mail01: mail1,
    colegio_mail02: mail2,
    estado_estab,
    status_web,
    status_direccion,
    status_colegio_logo: status_logo,
    status_colegio_nombre: status_nombre,
    status_colegio_telefono_mc01: status_tel1,
    status_colegio_telefono_mc02: status_tel2,
    status_colegio_mail01: status_mail1,
    status_colegio_mail02: status_mail2,
  };
  if (ids?.comunaId) payload.comuna = { connect: [ids.comunaId] }; // v5
  if (ids?.provId)   payload.provincia = { connect: [ids.provId] };
  if (ids?.regId)    payload.region    = { connect: [ids.regId] };
  if (ids?.zonId)    payload.zona      = { connect: [ids.zonId] };
  return compact(payload);
}

function firstConnectId(rel){
  if (!rel) return null;
  const arr = rel.connect || rel.set;
  if (Array.isArray(arr) && arr.length>0) return arr[0] || null;
  return null;
}

function buildDiff(existing, payload){
  if (!existing) return payload;
  const cur = existing.attrs || {};
  const out = {};
  const onlyMissing = process.env.ONLY_SET_MISSING_RELATIONS === '1';
  const cmp = (a,b)=>{
    if (a === undefined || a === null || a === '') a = null;
    if (b === undefined || b === null || b === '') b = null;
    return String(a ?? '').trim() === String(b ?? '').trim();
  };
  // Scalars
  [
    'colegio_nombre','rbd','rbd_digito_verificador','dependencia','ruralidad','colegio_direccion_calle','colegio_direccion_numero',
    'colegio_direccion_referencia','colegio_direccion_completa','colegio_web','colegio_telefono_mc01','colegio_telefono_mc02',
    'colegio_mail01','colegio_mail02','estado_estab','status_web','status_direccion','status_colegio_logo',
    'status_colegio_nombre','status_colegio_telefono_mc01','status_colegio_telefono_mc02','status_colegio_mail01','status_colegio_mail02'
  ].forEach((k)=>{
    if (k in payload) {
      if (!cmp(cur[k], payload[k])) out[k] = payload[k];
    }
  });
  // Relations
  const want = {
    comuna: firstConnectId(payload.comuna),
    provincia: firstConnectId(payload.provincia),
    region: firstConnectId(payload.region),
    zona: firstConnectId(payload.zona),
    logo: firstConnectId(payload.colegio_logo),
  };
  if (want.comuna && (!onlyMissing ? existing.rels?.comuna !== want.comuna : !existing.rels?.comuna)) out.comuna = { connect: [want.comuna] };
  if (want.provincia && (!onlyMissing ? existing.rels?.provincia !== want.provincia : !existing.rels?.provincia)) out.provincia = { connect: [want.provincia] };
  if (want.region && (!onlyMissing ? existing.rels?.region !== want.region : !existing.rels?.region)) out.region = { connect: [want.region] };
  if (want.zona && (!onlyMissing ? existing.rels?.zona !== want.zona : !existing.rels?.zona)) out.zona = { connect: [want.zona] };
  if (want.logo && (!onlyMissing ? existing.rels?.logo !== want.logo : !existing.rels?.logo)) out.colegio_logo = { connect: [want.logo] };
  return out;
}

async function upsertColegio(row) {
  const comunaNombre = row.comuna_nombre || row.Comuna || row.comuna || row["comuna_nombre"];
  const ids = comunaNombre ? comunaGeoByNombre.get(normalizeNombre(comunaNombre)) : null;
  const payload = mapRowToPayload(row, ids);
  // Resolver logo desde CSV y adjuntar si existe (nombre de archivo o ruta)
  const logoValue = row.colegio_logo || row.logo || row.Logo || null;
  const logoId = await ensureLogoId(logoValue);
  if (logoId) payload.colegio_logo = { connect: [logoId] };
  if (!payload.colegio_nombre) throw new Error(`Fila inválida: falta 'colegio_nombre' (row: ${JSON.stringify(row)})`);

  const existing = payload.rbd ? existingByRbd.get(Number(payload.rbd)) || null : null;

  if (existing) {
    // 👇 usar documentId en v5; fallback a id si vinieras de v4
    const idForUpdate = existing.id || existing.documentId;
    if (!idForUpdate) throw new Error(`No hay id/documentId para RBD=${payload.rbd}`);
    const diff = buildDiff(existing, payload);
    if (Object.keys(diff).length === 0) return { skipped: true };
    const res = await apiPut(`/api/colegios/${idForUpdate}`, { data: diff });
    // actualiza cache mínimo para evitar PUTs repetidos
    existingByRbd.set(Number(payload.rbd), {
      id: idForUpdate,
      attrs: { ...existing.attrs, ...diff },
      rels: {
        comuna: firstConnectId(diff.comuna) || existing.rels?.comuna,
        provincia: firstConnectId(diff.provincia) || existing.rels?.provincia,
        region: firstConnectId(diff.region) || existing.rels?.region,
        zona: firstConnectId(diff.zona) || existing.rels?.zona,
        logo: firstConnectId(diff.colegio_logo) || existing.rels?.logo,
      },
    });
    return res;
  } else {
    try {
      const created = await apiPost("/api/colegios", { data: payload });
      // mete en cache si trae rbd
      if (payload.rbd) {
        const newId = created?.data?.documentId || created?.data?.id;
        existingByRbd.set(Number(payload.rbd), {
          id: newId,
          attrs: payload,
          rels: {
            comuna: firstConnectId(payload.comuna),
            provincia: firstConnectId(payload.provincia),
            region: firstConnectId(payload.region),
            zona: firstConnectId(payload.zona),
            logo: firstConnectId(payload.colegio_logo),
          },
        });
      }
      return created;
    } catch (err) {
      const msg = String(err?.message || '');
      const uniqueRbd = msg.includes('-> 400') && /rbd/i.test(msg) && /unique|already/i.test(msg);
      if (uniqueRbd && payload.rbd) {
        const ex = existingByRbd.get(Number(payload.rbd)) || null;
        if (ex?.id) {
          const diff = buildDiff(ex, payload);
          if (Object.keys(diff).length === 0) return { skipped: true };
          return apiPut(`/api/colegios/${ex.id}`, { data: diff });
        }
      }
      throw err;
    }
  }
}

(async () => {
  try {
    console.log("== Import Colegios ==");
    console.log("CSV:", CSV_PATH);
    console.log("STRAPI_URL:", STRAPI_URL);
    console.log("CONCURRENCY:", CONCURRENCY);
    console.log("DRY run:", DRY ? "YES" : "NO");
    console.log("IMPORT_MODE:", process.env.IMPORT_MODE);

    await preloadComunas();

    let rows = await readCSV(CSV_PATH);
    if (!rows.length) { console.log("CSV vacío. Nada que importar."); process.exit(0); }
    // Filtro opcional por RBD para backfills rápidos:
    // Para activarlo explícitamente usa: APPLY_RBD_ONLY=1 RBD_ONLY=10879,12345
    const applyRbdOnly = process.env.APPLY_RBD_ONLY === '1' && !!process.env.RBD_ONLY;
    if (applyRbdOnly) {
      const onlyList = String(process.env.RBD_ONLY || "")
        .split(",")
        .map((s)=>Number(String(s).trim()))
        .filter((n)=>Number.isFinite(n));
      if (onlyList.length > 0) {
        rows = rows.filter((r)=> onlyList.includes(toIntOrNull(r.rbd || r.RBD)) );
        console.log(`Filtro RBD_ONLY activo -> Filas a procesar: ${rows.length}`);
      } else {
        console.log(`APPLY_RBD_ONLY=1 pero RBD_ONLY vacío o inválido. Se importarán todas las filas (${rows.length}).`);
      }
    } else {
      console.log(`Filas a procesar: ${rows.length}`);
    }
    // Precarga completa de colegios existentes para evitar GET por fila
    await preloadColegiosAll();

    const limit = pLimit(CONCURRENCY);
    let ok = 0, fail = 0;
    await Promise.all(
      rows.map((row, idx) =>
        limit(async () => {
          try {
            await upsertColegio(row);
            ok++; if (ok % 50 === 0) console.log(`OK: ${ok}/${rows.length}`);
          } catch (err) {
            fail++; console.error(`❌ Fila ${idx + 1}:`, err?.message || err);
          } finally {
            if (DELAY_MS > 0) await sleep(DELAY_MS);
          }
        })
      )
    );
    console.log(`\n🎉 Listo. OK=${ok}, FAIL=${fail}`);
  } catch (e) {
    console.error("❌ Error fatal:", e?.message || e);
    process.exit(1);
  }
})();
