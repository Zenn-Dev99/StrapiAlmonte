// scripts/import-comunas.mjs
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import fetch from "node-fetch";
import http from "http";
import https from "https";
import pLimit from "p-limit";
import dotenv from "dotenv";
dotenv.config();

const API_URL = process.env.API_URL || process.env.STRAPI_URL || "http://localhost:1337";
const API_TOKEN = process.env.IMPORT_TOKEN || process.env.API_TOKEN || process.env.STRAPI_TOKEN;
const CONCURRENCY = Number(process.env.IMPORT_CONCURRENCY || process.env.CONCURRENCY || 16);

if (!API_TOKEN) {
  console.error("❌ Falta API_TOKEN en el entorno.");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

// Keep-Alive para acelerar múltiples requests
const agent = (API_URL || "").startsWith("https")
  ? new https.Agent({ keepAlive: true, maxSockets: 200 })
  : new http.Agent({ keepAlive: true, maxSockets: 200 });

// ========= Utils =========
const normalize = (s = "") =>
  s
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Alias por si el CSV trae variantes
const provinciaAliases = new Map(
  Object.entries({
    "del tamarugal": "tamarugal",
    "ultima esperanza": "última esperanza",
    "san felipe de aconcagua": "san felipe de aconcagua",
    "isla de pascua": "isla de pascua",
    "antartica chilena": "antártica chilena",
    "tierra del fuego": "tierra del fuego",
  }).map(([k, v]) => [normalize(k), normalize(v)])
);

// Desenvuelve un item de Strapi v4/v5 a un objeto plano amigable
function unwrap(item) {
  const attrs = item?.attributes ?? item ?? {};
  const documentId = item?.documentId ?? attrs?.documentId ?? item?.id;
  return {
    id: item?.id ?? attrs?.id ?? documentId,
    documentId,
    ...attrs,
  };
}

// ========= CLI / CSV =========
const argvCsv = process.argv[2];
if (!argvCsv) {
  console.error("Uso: node -r dotenv/config scripts/import-comunas.mjs data/comuna.csv");
  process.exit(1);
}
const csvPath = path.resolve(argvCsv);
if (!fs.existsSync(csvPath)) {
  console.error(`❌ No existe el archivo: ${csvPath}`);
  process.exit(1);
}

const rows = parse(fs.readFileSync(csvPath), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  // Soporta archivos con mezcla de terminadores de línea (\r\n, \n, \r)
  record_delimiter: ["\r\n", "\n", "\r"],
});

console.log("== Import Comunas ==");

// ========= Fetch helpers =========
async function fetchAll(endpoint, pageSize = 100) {
  let page = 1;
  const out = [];
  while (true) {
    const url = new URL(`${API_URL}${endpoint}`);
    url.searchParams.set("pagination[page]", page);
    url.searchParams.set("pagination[pageSize]", pageSize);
    const res = await fetch(url, { headers, agent });
    if (!res.ok) throw new Error(`${res.status} al cargar ${endpoint}`);
    const json = await res.json();
    const data = json?.data ?? [];
    out.push(...data);
    const pagination = json?.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) break;
    page++;
  }
  return out;
}

// ========= Preload =========
const [rawProvincias, rawComunas] = await Promise.all([
  fetchAll("/api/provincias?fields=provincia_id,provincia_nombre,documentId"),
  fetchAll("/api/comunas?fields=comuna_id,comuna_nombre,documentId&populate[provincia][fields]=provincia_nombre,documentId"),
]);

const provincias = rawProvincias.map(unwrap);
const comunasExistentes = rawComunas.map((c) => {
  const u = unwrap(c);
  if (u.provincia && u.provincia.data) {
    // populate v4 style
    u.provincia = unwrap(u.provincia.data);
  } else if (u.provincia && !u.provincia.documentId && u.provincia.id) {
    // fallback
    u.provincia = unwrap(u.provincia);
  }
  return u;
});

const provById = new Map();
const provByNombre = new Map();

for (const p of provincias) {
  const pid = p.provincia_id != null ? Number(p.provincia_id) : null;
  const nombre = p.provincia_nombre ?? "";
  const nn = normalize(nombre);

  if (pid != null) provById.set(pid, p);
  if (nombre) {
    provByNombre.set(nn, p);
    // también registrar alias que apunten a este mismo registro
    for (const [aliasKey, aliasTarget] of provinciaAliases) {
      // si este registro es el target del alias, registrar aliasKey -> p
      if (aliasTarget === nn) provByNombre.set(aliasKey, p);
    }
  }
}

console.log(`✅ Preload -> Provincias:${provincias.length} Comunas:${comunasExistentes.length}`);

// Índices para evitar duplicados y permitir correcciones de ortografía
const comunaById = new Map();
const comunaByNombreProv = new Set();
const comunaByKey = new Map(); // key -> { documentId, comuna_nombre }

for (const c of comunasExistentes) {
  const cid = c.comuna_id != null ? Number(c.comuna_id) : null;
  const cname = normalize(c.comuna_nombre || "");
  const pnombre = normalize(c.provincia?.provincia_nombre || "");
  const key = `${cname}|${pnombre}`;
  comunaByNombreProv.add(key);
  const documentId = c.documentId || c.id;
  if (documentId) comunaByKey.set(key, { documentId, comuna_nombre: c.comuna_nombre });
  const provDocId = c.provincia?.documentId || c.provincia?.id || null;
  if (cid != null && documentId) comunaById.set(cid, { documentId, nombre: c.comuna_nombre, provinciaDocId: provDocId });
}

// ========= Resolución de provincia desde CSV =========
function resolveProvincia(row) {
  // 1) por ID si viene
  if (row.provincia_id != null && row.provincia_id !== "") {
    const pid = Number(row.provincia_id);
    if (provById.has(pid)) return provById.get(pid);
  }
  // 2) por nombre con normalización + alias
  let rawName = row.provincia_nombre ?? row.provincia ?? "";
  let n = normalize(rawName);
  if (provinciaAliases.has(n)) n = provinciaAliases.get(n);
  return provByNombre.get(n);
}

// ========= Upsert comuna =========
async function upsertComuna(row, index) {
  const fila = index + 1;

  const comuna_id = row.comuna_id ? Number(row.comuna_id) : null;
  const comuna_nombre = (row.comuna_nombre || row.nombre || "").trim();
  const provincia = resolveProvincia(row);

  if (!provincia) {
    console.error(
      `❌ Fila ${fila}: no se pudo resolver provincia (tenía provincia_nombre='${row.provincia_nombre || row.provincia || ""}')`
    );
    return { ok: false };
  }

  const keyNombreProv = `${normalize(comuna_nombre)}|${normalize(provincia.provincia_nombre || "")}`;

  // Ya existe por (nombre+provincia) -> actualizar si difiere ortografía/caso
  if (comunaByNombreProv.has(keyNombreProv)) {
    const ex = comunaByKey.get(keyNombreProv);
    if (ex && ex.comuna_nombre !== comuna_nombre) {
      const url = `${API_URL}/api/comunas/${ex.documentId}`;
      const body = { data: { comuna_nombre } };
      const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body), agent });
      if (!res.ok) {
        const txt = await res.text();
        console.error(`❌ Fila ${fila}: PUT nombre /api/comunas -> ${res.status} ${txt}`);
        return { ok: false };
      }
      comunaByKey.set(keyNombreProv, { ...ex, comuna_nombre });
      return { ok: true, updated: true };
    }
    return { ok: true, skipped: true };
  }

  // Si existe por ID, actualiza solo si cambió algo
  if (comuna_id != null && comunaById.has(comuna_id)) {
    const existing = comunaById.get(comuna_id);
    const idOrDoc = existing.documentId;
    const nombreCambio = normalize(existing.nombre || "") !== normalize(comuna_nombre);
    const provDocId = provincia.documentId ?? provincia.id;
    const provCambio = (existing.provinciaDocId || null) !== (provDocId || null);
    if (!nombreCambio && !provCambio) {
      comunaByNombreProv.add(keyNombreProv);
      return { ok: true, skipped: true };
    }
    const payload = { data: {} };
    if (nombreCambio) payload.data.comuna_nombre = comuna_nombre;
    if (provCambio) payload.data.provincia = { connect: [provDocId] };
    if (comuna_id != null) payload.data.comuna_id = comuna_id;
    const url = `${API_URL}/api/comunas/${idOrDoc}`;
    const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(payload), agent });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`❌ Fila ${fila}: PUT /api/comunas -> ${res.status} ${txt}`);
      return { ok: false };
    }
    comunaByNombreProv.add(keyNombreProv);
    return { ok: true, updated: true };
  }

  // Crear
  const res = await fetch(`${API_URL}/api/comunas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: {
        comuna_nombre,
        comuna_id,
        provincia: { connect: [provincia.documentId ?? provincia.id] },
      },
    }),
    agent,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`❌ Fila ${fila}: POST /api/comunas -> ${res.status} ${txt}`);
    return { ok: false };
  }
  comunaByNombreProv.add(keyNombreProv);
  if (comuna_id != null) comunaById.set(comuna_id, { comuna_id, comuna_nombre, provincia });
  return { ok: true, created: true };
}

// ========= Runner =========
(async () => {
  console.log(`Filas a procesar: ${rows.length}`);

  const limit = pLimit(CONCURRENCY);
  let ok = 0,
    fail = 0;

  const tasks = rows.map((row, i) =>
    limit(async () => {
      try {
        const r = await upsertComuna(row, i);
        if (r?.ok) ok++;
        else fail++;
      } catch (e) {
        fail++;
        console.error(`❌ Fila ${i + 1}: error inesperado ->`, e?.message || e);
      }
    })
  );

  await Promise.all(tasks);
  console.log(`🎉 Listo Comunas. OK=${ok}, FAIL=${fail}`);
})();
