// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createStrapi } from '@strapi/strapi';
import tsUtils from '@strapi/typescript-utils';

type CSVRow = Record<string, string>;

type StrapiApp = Awaited<ReturnType<typeof createStrapi>>;

type PersonaExternalIds = Record<string, unknown> | null | undefined;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data/csv');

async function loadCsvRows(fileName: string): Promise<CSVRow[]> {
  const filePath = path.join(DATA_DIR, fileName);
  const buffer = await fs.readFile(filePath);
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function toInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function normalizeString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const out = String(value).trim();
  return out.length ? out : null;
}

function normalizeRutKey(value: string | null | undefined): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  const clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
  return clean.length ? clean : null;
}

function toBoolean(value: string | null | undefined): boolean | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (["1", "true", "t", "yes", "y", "si", "sí", "activo", "current"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "f", "no", "n", "inactivo", "inactive"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeDateValue(value: string | null | undefined): string | undefined {
  const raw = normalizeString(value);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(raw)) {
    const parts = raw.split(/[/-]/);
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

type EmailComponent = {
  email: string;
  tipo?: string;
  estado?: string;
  principal?: boolean;
  vigente_desde?: string;
  vigente_hasta?: string;
  nota?: string;
  fuente?: string;
  verificado_por?: string;
  fecha_verificacion?: string;
  eliminado_en?: string;
  confidence_score?: number;
};

function extractRutKey(row: CSVRow): string | null {
  const direct = normalizeRutKey(row.RUT ?? row.rut ?? row.Rut);
  if (direct) return direct;

  const numero = normalizeString(row.RUT_NUMERO ?? row.rut_numero ?? row.RutNumero);
  const dv = normalizeString(row.RUT_DV ?? row.rut_dv ?? row.RutDv);

  if (numero) {
    const numeric = numero.replace(/[^0-9]/g, '');
    if (!numeric) return null;
    const combined = dv ? `${numeric}${dv}` : numeric;
    return normalizeRutKey(combined);
  }

  return null;
}

async function upsertAsignaturas(app: StrapiApp, rows: CSVRow[]) {
  const uid = 'api::asignatura.asignatura';
  let created = 0;
  let updated = 0;

  await app.db.transaction(async ({ trx }) => {
    for (const row of rows) {
      const codSubsector = toInt(row.COD_SUBSECTOR);
      const nombre = normalizeString(row.NOM_SUBSECTOR);
      if (!codSubsector || !nombre) continue;

      const areaSubsector = normalizeString(row.AREA_SUBSECTOR);
      const areaGeneral = normalizeString(row.AREA);

      let existing = await app.entityService.findMany(uid, {
        filters: { cod_subsector: codSubsector },
        limit: 1,
        transacting: trx,
      });
      if (!existing.length) {
        existing = await app.entityService.findMany(uid, {
          filters: { nombre },
          limit: 1,
          transacting: trx,
        });
      }

      const data: Record<string, unknown> = {
        nombre,
        cod_subsector: codSubsector,
        area_subsector: areaSubsector || undefined,
        area_general: areaGeneral || undefined,
      };

      if (existing.length) {
        await app.entityService.update(uid, existing[0].id, { data, transacting: trx });
        updated += 1;
      } else {
        await app.entityService.create(uid, { data, transacting: trx });
        created += 1;
      }
    }
  });

  console.log(`Asignaturas -> creadas: ${created}, actualizadas: ${updated}`);
}

function buildNivelClave(ensenanza: string, orden: number | null): string | null {
  if (!ensenanza || !orden) return null;
  return `${ensenanza.toLowerCase()}-${orden}`;
}

async function upsertNiveles(app: StrapiApp, rows: CSVRow[]) {
  const uid = 'api::nivel.nivel';
  let created = 0;
  let updated = 0;

  await app.db.transaction(async ({ trx }) => {
    for (const row of rows) {
      const nombre = normalizeString(row.NIVEL);
      const ensenanza = normalizeString(row.ENS_BAS_MED);
      if (!nombre || !ensenanza) continue;

      const orden = toInt(row.ID_NIVEL);
      const clave = buildNivelClave(ensenanza, orden);
      if (!clave) continue;

      const ciclo = normalizeString(row.CICLO);

      const existing = await app.entityService.findMany(uid, {
        filters: { clave },
        limit: 1,
        transacting: trx,
      });

      const data: Record<string, unknown> = {
        nombre,
        clave,
        orden: orden ?? undefined,
        ensenanza,
        ciclo: ciclo || undefined,
      };

      if (existing.length) {
        await app.entityService.update(uid, existing[0].id, { data, transacting: trx });
        updated += 1;
      } else {
        await app.entityService.create(uid, { data, transacting: trx });
        created += 1;
      }
    }
  });

  console.log(`Niveles -> creados: ${created}, actualizados: ${updated}`);
}

function mapGenero(docGenero: string | null | undefined): 'Hombre' | 'Mujer' | undefined {
  if (!docGenero) return undefined;
  const normalized = docGenero.toString().trim();
  if (normalized === '1') return 'Hombre';
  if (normalized === '2') return 'Mujer';
  return undefined;
}

function mergeExternalIds(existing: PersonaExternalIds, addition: PersonaExternalIds): Record<string, unknown> {
  const base = (existing && typeof existing === 'object') ? existing : {};
  const extra = (addition && typeof addition === 'object') ? addition : {};
  return { ...base, ...extra };
}

function mapEmailEstado(statusRaw: string | null | undefined, isActiveRaw: string | null | undefined): string | undefined {
  const status = normalizeString(statusRaw)?.toLowerCase();
  const isActive = toBoolean(isActiveRaw);

  if (status) {
    if (["verificado", "verified", "valid"].includes(status)) return "Verificado";
    if (["aprobado", "approved"].includes(status)) return "Aprobado";
    if (["por verificar", "por-verificar", "pending", "pendiente", "reportado", "reported"].includes(status)) return "Por Verificar";
    if (["obsoleto", "deprecated", "inactive", "desactivado", "eliminado", "deleted", "removed"].includes(status)) return "Por Verificar";
  }

  if (isActive === false) return "Por Verificar";
  return "Por Verificar";
}

function buildEmailComponent(row: CSVRow): EmailComponent | null {
  const email = normalizeString(row.email)?.toLowerCase();
  if (!email) return null;

  const comp: EmailComponent = { email };
  const tipo = normalizeString(row.tipo);
  if (tipo) comp.tipo = tipo;

  const estado = mapEmailEstado(row.status, row.is_active);
  if (estado) comp.estado = estado;

  const principal = toBoolean(row.is_primary);
  if (principal !== undefined) comp.principal = principal;

  const fuente = normalizeString(row.source);
  if (fuente) comp.fuente = fuente;

  const verificadoPor = normalizeString(row.verification_method);
  if (verificadoPor) comp.verificado_por = verificadoPor;

  const vigenteDesde = normalizeDateValue(row.first_seen_at);
  if (vigenteDesde) comp.vigente_desde = vigenteDesde;

  const vigenteHasta = normalizeDateValue(row.last_seen_at);
  if (vigenteHasta) comp.vigente_hasta = vigenteHasta;

  return comp;
}

function indexPersonEmails(rows: CSVRow[]) {
  const byRut = new Map<string, EmailComponent[]>();
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    processed += 1;
    const comp = buildEmailComponent(row);
    if (!comp) {
      skipped += 1;
      continue;
    }

    const rutKey = extractRutKey(row);
    if (!rutKey) {
      skipped += 1;
      continue;
    }

    const list = byRut.get(rutKey) || [];
    if (!list.some((it) => it.email === comp.email)) {
      list.push(comp);
      byRut.set(rutKey, list);
    }
  }

  return { byRut, processed, skipped };
}

function mapGeneroTexto(value: string | null | undefined): 'Hombre' | 'Mujer' | undefined {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  const lower = normalized.toLowerCase();
  if (["m", "femenino", "mujer", "female"].includes(lower)) return 'Mujer';
  if (["h", "masculino", "hombre", "male"].includes(lower)) return 'Hombre';
  return undefined;
}

async function upsertPersonaDetalles(app: StrapiApp, rows: CSVRow[]) {
  const uid = 'api::persona.persona';
  let updated = 0;
  let missing = 0;
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    processed += 1;
    const rut = extractRutKey(row);
    if (!rut) {
      skipped += 1;
      continue;
    }

    const data: Record<string, unknown> = {};
    const nombres = normalizeString(row.nombres ?? row.nombre ?? row.first_name);
    if (nombres) data.nombres = nombres;

    const primerApellido = normalizeString(row.primer_apellido ?? row.apellido_paterno);
    const segundoApellido = normalizeString(row.segundo_apellido ?? row.apellido_materno);
    if (primerApellido) data.primer_apellido = primerApellido;
    if (segundoApellido) data.segundo_apellido = segundoApellido;

    const genero = mapGeneroTexto(row.genero ?? row.gender);
    if (genero) data.genero = genero;

    const notas = normalizeString(row.notes ?? row.nota);
    if (notas) data.notas = notas;

    if (!Object.keys(data).length) {
      skipped += 1;
      continue;
    }

    const existing = await app.entityService.findMany(uid, {
      filters: { rut },
      limit: 1,
      fields: ['id'],
    });

    if (!existing.length) {
      missing += 1;
      continue;
    }

    await app.entityService.update(uid, existing[0].id, { data });
    updated += 1;
  }

  console.log(`Detalles -> personas actualizadas: ${updated}, sin coincidencia: ${missing}, filas procesadas: ${processed}, filas omitidas: ${skipped}`);
}

async function upsertPersonas(app: StrapiApp, rows: CSVRow[]) {
  const uid = 'api::persona.persona';
  let created = 0;
  let updated = 0;
  let skipped = 0;

  let processed = 0;
  for (const row of rows) {
    processed += 1;
    const rut = extractRutKey(row);
    if (!rut) {
      skipped += 1;
      continue;
    }

    const existing = await app.entityService.findMany(uid, {
      filters: { rut },
      limit: 1,
      fields: ['id', 'origen', 'publishedAt', 'identificadores_externos'],
    });

    const genero = mapGenero(row.DOC_GENERO);
    const additions: Record<string, unknown> = {};
    const rutOriginal = normalizeString(row.RUT ?? row.rut);
    const rutNumero = normalizeString(row.RUT_NUMERO);
    const rutDv = normalizeString(row.RUT_DV);
    const docGenero = normalizeString(row.DOC_GENERO);
    const areaCsv = normalizeString(row.AREA);

    if (rutOriginal) additions.rut_original = rutOriginal;
    if (rutNumero) additions.rut_numero = rutNumero;
    if (rutDv) additions.rut_dv = rutDv;
    if (docGenero) additions.doc_genero = docGenero;
    if (areaCsv) additions.area_csv = areaCsv;
    additions.csv_verified = false;

    const externalPayload = mergeExternalIds(existing[0]?.identificadores_externos, additions);

    const data: Record<string, unknown> = {
      rut,
      genero,
      origen: existing.length ? existing[0].origen || 'csv' : 'csv',
      activo: true,
      identificadores_externos: externalPayload,
    };

    if (existing.length) {
      await app.entityService.update(uid, existing[0].id, { data });
      updated += 1;
    } else {
      await app.entityService.create(uid, {
        data: {
          ...data,
          publishedAt: new Date().toISOString(),
        },
      });
      created += 1;
    }

    if (processed % 5000 === 0) {
      console.log(`  Personas procesadas: ${processed}/${rows.length}`);
    }
  }

  console.log(`Personas -> creadas: ${created}, actualizadas: ${updated}, filas omitidas: ${skipped}`);
}

async function upsertPersonaEmails(app: StrapiApp, rows: CSVRow[]) {
  const uid = 'api::persona.persona';
  const { byRut, processed, skipped } = indexPersonEmails(rows);

  let updated = 0;
  let missing = 0;

  for (const [rut, emails] of byRut.entries()) {
    const existing = await app.entityService.findMany(uid, {
      filters: { rut },
      limit: 1,
      fields: ['id', 'identificadores_externos'],
    });

    if (!existing.length) {
      missing += 1;
      continue;
    }

    const currentExternal = existing[0].identificadores_externos;
    const payload = mergeExternalIds(currentExternal, { csv_verified: true });

    await app.entityService.update(uid, existing[0].id, {
      data: {
        emails,
        identificadores_externos: payload,
      },
    });
    updated += 1;
  }

  console.log(`Emails -> personas actualizadas: ${updated}, sin coincidencia: ${missing}, filas procesadas: ${processed}, filas omitidas: ${skipped}`);
}

async function main() {
  console.log('Iniciando importación base...');
  const projectDir = process.cwd();
  await tsUtils.compile(projectDir);

  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    const asignaturas = await loadCsvRows('1asignaturas_agrupadas.csv');
    await upsertAsignaturas(strapi, asignaturas);

    const niveles = await loadCsvRows('1niveles.csv');
    await upsertNiveles(strapi, niveles);

    const personas = await loadCsvRows('1profesores.csv');
    await upsertPersonas(strapi, personas);

    try {
      const detalleRows = await loadCsvRows('import_contactos/datos_contactos_personas.csv');
      await upsertPersonaDetalles(strapi, detalleRows);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
      console.warn('⚠ Archivo datos_contactos_personas.csv no encontrado, se omite actualización de detalles.');
    }

    try {
      const personasEmailRows = await loadCsvRows('import_contactos/datos_contactos_personas_mail.csv');
      await upsertPersonaEmails(strapi, personasEmailRows);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        console.warn('⚠ Archivo datos_contactos_personas_mail.csv no encontrado, se omite actualización de emails.');
      } else {
        throw err;
      }
    }

    console.log('✔ Importación completada.');
  } finally {
    await strapi.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
