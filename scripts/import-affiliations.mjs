import fs from 'fs';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';
import pLimit from 'p-limit';

const API_URL = process.env.API_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const TOKEN = process.env.IMPORT_TOKEN || process.env.STRAPI_TOKEN;
const DRY = process.env.DRY === '1';
const CONCURRENCY = Number.parseInt(process.env.IMPORT_CONCURRENCY || '6', 10);
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};
const PUBLICATION_STATE = 'preview';

function assertToken() {
  if (!TOKEN) {
    throw new Error('Falta IMPORT_TOKEN o STRAPI_TOKEN');
  }
}

function loadCSV(filePath) {
  const content = fs.readFileSync(filePath);
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });
}

function cleanString(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeDate(value) {
  const raw = cleanString(value);
  if (!raw) return undefined;
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const latamMatch = /^\d{2}-\d{2}-\d{4}$/.test(raw);
  if (isoMatch) return raw;
  if (latamMatch) {
    const [day, month, year] = raw.split('-');
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

function toBoolean(value) {
  const raw = cleanString(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'activo', 'current'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'inactivo'].includes(normalized)) return false;
  return undefined;
}

function createSearchParams(base = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === null) continue;
    params.set(key, value);
  }
  return params;
}

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function postData(endpoint, data) {
  if (DRY) {
    return { dry: true, method: 'POST', endpoint, data };
  }
  const res = await fetch(`${API_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST /api/${endpoint} -> ${res.status} ${err}`);
  }
  return res.json();
}

async function putData(endpoint, docId, data) {
  if (DRY) {
    return { dry: true, method: 'PUT', endpoint, docId, data };
  }
  const res = await fetch(`${API_URL}/api/${endpoint}/${docId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT /api/${endpoint}/${docId} -> ${res.status} ${err}`);
  }
  return res.json();
}

async function fetchAll(endpoint, { params = {}, pageSize = 100 } = {}) {
  const out = [];
  let page = 1;
  while (true) {
    const search = createSearchParams({ ...params });
    search.set('pagination[page]', String(page));
    search.set('pagination[pageSize]', String(pageSize));
    const url = `/api/${endpoint}?${search.toString()}`;
    const json = await getJson(url);
    const data = json?.data || [];
    if (!data.length) break;
    out.push(...data);
    const pagination = json?.meta?.pagination;
    if (pagination && pagination.pageCount && pagination.page >= pagination.pageCount) break;
    if (!pagination && data.length < pageSize) break;
    page += 1;
  }
  return out;
}

function trajectoryKey({ personaId, colegioId, roleKey, cargo, startDate }) {
  return [personaId || 'none', colegioId || 'none', roleKey || '', cargo || '', startDate || ''].join('|');
}

async function loadExistingTrajectories() {
  const records = await fetchAll('persona-trayectorias', {
    params: {
      'fields[0]': 'role_key',
      'fields[1]': 'cargo',
      'fields[2]': 'fecha_inicio',
      'fields[3]': 'fecha_fin',
      publicationState: PUBLICATION_STATE,
      'populate[persona][fields][0]': 'documentId',
      'populate[colegio][fields][0]': 'documentId',
    },
    pageSize: 200,
  });

  const map = new Map();
  for (const entry of records) {
    const docId = entry.documentId || entry.id;
    const attrs = entry.attributes ? entry.attributes : entry;
    const personaRel = attrs.persona?.data ?? attrs.persona;
    const colegioRel = attrs.colegio?.data ?? attrs.colegio;
    const personaId = personaRel ? (personaRel.documentId || personaRel.id) : undefined;
    const colegioId = colegioRel ? (colegioRel.documentId || colegioRel.id) : undefined;
    const key = trajectoryKey({
      personaId,
      colegioId,
      roleKey: attrs.role_key,
      cargo: attrs.cargo,
      startDate: attrs.fecha_inicio,
    });
    if (key && !map.has(key)) {
      map.set(key, docId);
    }
  }
  return map;
}

async function loadPersonas() {
  const records = await fetchAll('personas', {
    params: {
      'fields[0]': 'nombre_completo',
      'fields[1]': 'identificadores_externos',
      'fields[2]': 'rut',
      'fields[3]': 'documentId',
      publicationState: PUBLICATION_STATE,
    },
    pageSize: 200,
  });

  const byUid = new Map();
  const byName = new Map();
  const ambiguousNames = new Set();

  for (const entry of records) {
    const docId = entry.documentId || entry.id;
    const attrs = entry.attributes ? entry.attributes : entry;
    let ext = attrs.identificadores_externos;
    if (typeof ext === 'string') {
      try {
        ext = JSON.parse(ext);
      } catch (err) {
        ext = undefined;
      }
    }

    const candidateIds = [
      ext?.person_uid,
      ext?.persona_uid,
      ext?.crm_person_uid,
      ext?.crm_uid,
      attrs.person_uid,
      attrs.crm_uid,
      attrs.uid,
      attrs.rut,
    ];

    for (const value of candidateIds) {
      const uid = cleanString(value);
      if (!uid) continue;
      if (!byUid.has(uid)) {
        byUid.set(uid, { docId, nombre: attrs.nombre_completo });
      }
    }

    const name = cleanString(attrs.nombre_completo);
    if (name) {
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, { docId, nombre: name });
      } else {
        ambiguousNames.add(key);
      }
    }
  }

  // Remove ambiguous names
  for (const key of ambiguousNames) {
    byName.delete(key);
  }

  return { byUid, byName, ambiguousNames };
}

async function loadColegios() {
  const records = await fetchAll('colegios', {
    params: {
      'fields[0]': 'rbd',
      'fields[1]': 'colegio_nombre',
      'fields[2]': 'documentId',
      publicationState: PUBLICATION_STATE,
    },
    pageSize: 200,
  });

  const map = new Map();
  for (const entry of records) {
    const docId = entry.documentId || entry.id;
    const attrs = entry.attributes ? entry.attributes : entry;
    const rbd = cleanString(attrs.rbd);
    if (!rbd) continue;
    map.set(rbd, { docId, nombre: attrs.colegio_nombre });
  }
  return map;
}

async function findExistingTrajectoryDocId({ personaId, colegioId, roleKey, cargo, startDate }) {
  const params = createSearchParams({
    publicationState: PUBLICATION_STATE,
    'filters[persona][documentId][$eq]': personaId,
    'filters[role_key][$eq]': roleKey,
    'filters[cargo][$eq]': cargo,
    'filters[fecha_inicio][$eq]': startDate,
    'pagination[pageSize]': '1',
  });
  if (colegioId) {
    params.set('filters[colegio][documentId][$eq]', colegioId);
  }
  const json = await getJson(`/api/persona-trayectorias?${params.toString()}`);
  const first = json?.data?.[0];
  if (!first) return undefined;
  return first.documentId || first.id;
}

async function importAffiliations(filePath) {
  assertToken();
  const rows = loadCSV(filePath);
  console.log(`📄 Cargando affiliations: ${rows.length} filas`);

  const [personasData, colegioMap, existingMap] = await Promise.all([
    loadPersonas(),
    loadColegios(),
    loadExistingTrajectories(),
  ]);

  const { byUid, byName, ambiguousNames } = personasData;
  if (ambiguousNames.size) {
    console.warn(`🔁 Nombres duplicados omitidos: ${ambiguousNames.size}`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingPersona = 0;
  let missingColegio = 0;

  const limit = pLimit(CONCURRENCY > 0 ? CONCURRENCY : 5);

  await Promise.all(rows.map((row, index) => limit(async () => {
    const personUid = cleanString(row.person_uid);
    const fullName = cleanString(row.full_name);
    const roleKey = cleanString(row.role_key);
    const cargo = cleanString(row.title) || cleanString(row.role_key);
    const department = cleanString(row.department);
    const orgNameRaw = cleanString(row.org_display_name);
    const startDate = normalizeDate(row.start_date);
    const endDate = normalizeDate(row.end_date);
    const isCurrent = toBoolean(row.is_current);
    const rbd = cleanString(row.rbd);

    let personaInfo = personUid ? byUid.get(personUid) : undefined;
    if (!personaInfo && fullName) {
      const key = fullName.toLowerCase();
      personaInfo = byName.get(key);
    }

    if (!personaInfo) {
      missingPersona += 1;
      console.warn(`🔸 [Fila ${index + 1}] Persona no encontrada para UID='${personUid}' nombre='${fullName}'`);
      skipped += 1;
      return;
    }

    const personaId = personaInfo.docId;
    const colegioInfo = rbd ? colegioMap.get(rbd) : undefined;
    if (rbd && !colegioInfo) {
      missingColegio += 1;
      console.warn(`🔸 [Fila ${index + 1}] Colegio no encontrado para RBD='${rbd}'`);
    }

    const colegioId = colegioInfo?.docId;
    const orgDisplayName = orgNameRaw || colegioInfo?.nombre;

    const data = {
      cargo: cargo || undefined,
      role_key: roleKey || undefined,
      department: department || undefined,
      org_display_name: orgDisplayName || undefined,
      fecha_inicio: startDate,
      fecha_fin: endDate,
    };
    if (isCurrent !== undefined) {
      data.is_current = isCurrent;
    }
    if (personaId) {
      data.persona = { connect: [personaId] };
    }
    if (colegioId) {
      data.colegio = { connect: [colegioId] };
    }

    const key = trajectoryKey({ personaId, colegioId, roleKey, cargo: data.cargo, startDate });
    let existingId = existingMap.get(key);
    if (!existingId && !DRY) {
      existingId = await findExistingTrajectoryDocId({ personaId, colegioId, roleKey, cargo: data.cargo, startDate });
      if (existingId) {
        existingMap.set(key, existingId);
      }
    }

    try {
      if (existingId) {
        await putData('persona-trayectorias', existingId, data);
        updated += 1;
      } else {
        const res = await postData('persona-trayectorias', data);
        const newId = res?.data?.documentId || res?.data?.id;
        if (newId) {
          existingMap.set(key, newId);
        }
        created += 1;
      }
    } catch (err) {
      skipped += 1;
      console.error(`❌ [Fila ${index + 1}] Error al procesar UID='${personUid}'`, err.message);
    }
  })));

  console.log('---');
  console.log(`✅ Nuevos registros: ${created}`);
  console.log(`♻️  Actualizados: ${updated}`);
  console.log(`⚠️  Omitidos: ${skipped}`);
  if (missingPersona) {
    console.log(`   • Filas sin persona: ${missingPersona}`);
  }
  if (missingColegio) {
    console.log(`   • Filas sin colegio: ${missingColegio}`);
  }
}

const filePath = process.argv[2] || 'data/csv/import_contactos/affiliations.csv';
importAffiliations(filePath).catch((err) => {
  console.error('❌ Importación fallida:', err.message);
  process.exit(1);
});
