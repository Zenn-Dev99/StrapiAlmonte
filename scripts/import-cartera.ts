// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createStrapi } from '@strapi/strapi';
import tsUtils from '@strapi/typescript-utils';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data/csv');
const PERIODOS_FILE = process.env.CARTERA_PERIODOS_FILE || 'cartera_periodos.csv';
const ASIGNACIONES_FILE = process.env.CARTERA_ASIGNACIONES_FILE || 'cartera_asignaciones.csv';

type CSVRow = Record<string, string>;

type StrapiApp = Awaited<ReturnType<typeof createStrapi>>;

type IdMap = Map<string, number>;

type PeriodoRow = {
  nombre?: string;
  slug?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: string;
  notas?: string;
};

type AsignacionRow = {
  periodo?: string;
  periodo_slug?: string;
  colegio_rbd?: string;
  colegio?: string;
  ejecutivo_rut?: string;
  ejecutivo?: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  prioridad?: string;
  meta_ingresos?: string;
  notas?: string;
  is_current?: string;
};

const ESTADOS_PERIODO = new Set(['borrador', 'vigente', 'cerrado']);
const ESTADOS_ASIGNACION = new Set(['activa', 'en_revision', 'cerrada']);
const PRIORIDADES = new Set(['alta', 'media', 'baja']);

async function loadCsv(fileName: string): Promise<CSVRow[]> {
  const fullPath = path.resolve(DATA_DIR, fileName);
  const buffer = await fs.readFile(fullPath);
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });
}

function normalizeString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRutKey(value: string | null | undefined): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  return clean.length ? clean : null;
}

function toDate(value: string | null | undefined): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(/[/-]/);
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

function toBoolean(value: string | null | undefined): boolean | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (["1", "true", "t", "yes", "y", "si", "sí"].includes(lower)) return true;
  if (["0", "false", "f", "no", "n"].includes(lower)) return false;
  return undefined;
}

function toDecimalString(value: string | null | undefined): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const normalized = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  if (!normalized) return undefined;
  const num = Number.parseFloat(normalized);
  if (Number.isNaN(num)) return undefined;
  return num.toFixed(2);
}

async function upsertPeriodos(app: StrapiApp, rows: PeriodoRow[]): Promise<IdMap> {
  const uid = 'api::cartera-periodo.cartera-periodo';
  const map: IdMap = new Map();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const nombre = normalizeString(row.nombre);
    if (!nombre) continue;

    const fechaInicio = toDate(row.fecha_inicio);
    const fechaFin = toDate(row.fecha_fin);
    const estado = normalizeString(row.estado)?.toLowerCase();
    const notas = normalizeString(row.notas);

    const existing = await app.entityService.findMany(uid, {
      filters: { nombre },
      limit: 1,
      fields: ['id', 'nombre'],
    });

    const data: Record<string, unknown> = {
      nombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      notas: notas ?? undefined,
    };
    if (estado && ESTADOS_PERIODO.has(estado)) data.estado = estado;

    if (existing.length) {
      await app.entityService.update(uid, existing[0].id, { data });
      map.set(nombre.toLowerCase(), existing[0].id);
      updated += 1;
    } else {
      const createdEntry = await app.entityService.create(uid, {
        data: {
          ...data,
          estado: (data.estado as string) || 'borrador',
        },
      });
      map.set(nombre.toLowerCase(), createdEntry.id);
      created += 1;
    }
  }

  console.log(`Periodos -> creados: ${created}, actualizados: ${updated}`);
  return map;
}

async function buildPersonaCache(app: StrapiApp): Promise<Map<string, number>> {
  const uid = 'api::persona.persona';
  const cache = new Map<string, number>();
  let page = 1;
  const pageSize = 200;

  while (true) {
    const res = await app.entityService.findMany(uid, {
      fields: ['id', 'rut'],
      limit: pageSize,
      start: (page - 1) * pageSize,
    });
    if (!res.length) break;
    for (const item of res) {
      if (item.rut) cache.set(String(item.rut).toLowerCase(), item.id);
    }
    if (res.length < pageSize) break;
    page += 1;
  }
  return cache;
}

async function buildColegioCache(app: StrapiApp): Promise<Map<string, number>> {
  const uid = 'api::colegio.colegio';
  const cache = new Map<string, number>();
  let page = 1;
  const pageSize = 200;

  while (true) {
    const res = await app.entityService.findMany(uid, {
      fields: ['id', 'rbd'],
      limit: pageSize,
      start: (page - 1) * pageSize,
    });
    if (!res.length) break;
    for (const item of res) {
      if (item.rbd != null) cache.set(String(item.rbd), item.id);
    }
    if (res.length < pageSize) break;
    page += 1;
  }
  return cache;
}

async function upsertAsignaciones(app: StrapiApp, rows: AsignacionRow[], periodoMap: IdMap) {
  const uid = 'api::cartera-asignacion.cartera-asignacion';
  const personaCache = await buildPersonaCache(app);
  const colegioCache = await buildColegioCache(app);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingPeriodo = 0;
  let missingColegio = 0;
  let missingPersona = 0;

  for (const row of rows) {
    const periodoNombre = normalizeString(row.periodo ?? row.periodo_slug);
    if (!periodoNombre) {
      skipped += 1;
      continue;
    }
    const periodoId = periodoMap.get(periodoNombre.toLowerCase());
    if (!periodoId) {
      missingPeriodo += 1;
      skipped += 1;
      continue;
    }

    const colegioKey = normalizeString(row.colegio_rbd ?? row.colegio);
    const colegioId = colegioKey ? colegioCache.get(String(colegioKey)) : undefined;
    if (!colegioId) {
      missingColegio += 1;
      skipped += 1;
      continue;
    }

    const ejecutivoRut = normalizeRutKey(row.ejecutivo_rut ?? row.ejecutivo);
    const ejecutivoId = ejecutivoRut ? personaCache.get(ejecutivoRut.toLowerCase()) : undefined;
    if (!ejecutivoId) missingPersona += 1;

    const estado = normalizeString(row.estado)?.toLowerCase();
    const prioridad = normalizeString(row.prioridad)?.toLowerCase();
    const fechaInicio = toDate(row.fecha_inicio);
    const fechaFin = toDate(row.fecha_fin);
    const isCurrent = toBoolean(row.is_current);
    const metaIngresos = toDecimalString(row.meta_ingresos);
    const notas = normalizeString(row.notas);

    const data: Record<string, unknown> = {
      periodo: { connect: [periodoId] },
      colegio: { connect: [colegioId] },
      estado: ESTADOS_ASIGNACION.has(estado || '') ? estado : undefined,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      is_current: isCurrent ?? undefined,
      prioridad: PRIORIDADES.has(prioridad || '') ? prioridad : undefined,
      meta_ingresos: metaIngresos ?? undefined,
      notas: notas ?? undefined,
    };

    if (ejecutivoId) data.ejecutivo = { connect: [ejecutivoId] };

    const existing = await app.entityService.findMany(uid, {
      filters: {
        periodo: { id: periodoId },
        colegio: { id: colegioId },
      },
      limit: 1,
      fields: ['id'],
    });

    if (existing.length) {
      await app.entityService.update(uid, existing[0].id, { data });
      updated += 1;
    } else {
      await app.entityService.create(uid, {
        data: {
          ...data,
          estado: (data.estado as string) || 'activa',
        },
      });
      created += 1;
    }
  }

  console.log(`Asignaciones -> creadas: ${created}, actualizadas: ${updated}, omitidas: ${skipped}`);
  if (missingPeriodo) console.warn(`  • Periodos no encontrados: ${missingPeriodo}`);
  if (missingColegio) console.warn(`  • Colegios no encontrados: ${missingColegio}`);
  if (missingPersona) console.warn(`  • Ejecutivos no encontrados: ${missingPersona}`);
}

async function main() {
  console.log('🚀 Importando cartera comercial...');
  const projectDir = process.cwd();
  await tsUtils.compile(projectDir);

  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    const periodoRows = await loadCsv(PERIODOS_FILE);
    const periodoMap = await upsertPeriodos(strapi, periodoRows as PeriodoRow[]);

    const asignacionRows = await loadCsv(ASIGNACIONES_FILE);
    await upsertAsignaciones(strapi, asignacionRows as AsignacionRow[], periodoMap);

    console.log('✔ Importación de cartera finalizada.');
  } finally {
    await strapi.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
