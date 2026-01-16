// scripts/import-inprocess.ts
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createStrapi } from "@strapi/strapi";

type Row = Record<string, any>;

async function preloadMap(app: any, uid: string, keyField: string, valueField: string | null = null) {
  const out = new Map<string, number>();
  let start = 0;
  while (true) {
    const page = await app.entityService.findMany(uid, {
      fields: [keyField],
      limit: 1000, start,
    });
    if (!page.length) break;
    for (const r of page) {
      const key = (valueField ? r[valueField] : r[keyField]) ?? r[keyField];
      if (key != null) out.set(String(key).trim().toLowerCase(), r.id);
    }
    start += page.length;
  }
  return out;
}

async function main() {
  const app = await createStrapi().load(); // Strapi APAGADO en otra consola
  const dataDir = process.env.DATA_DIR ?? "data";
  const kind    = process.env.KIND;  // "colegios" | "demre" | etc.
  const file    = process.env.FILE;  // p.ej. "colegios.csv"

  if (!kind || !file) throw new Error("Usa: KIND=colegios FILE=colegios.csv DATA_DIR=data ts-node scripts/import-inprocess.ts");

  const csvPath = path.resolve(dataDir, file);
  const rows: Row[] = parse(await fs.readFile(csvPath), { columns: true, skip_empty_lines: true, trim: true });

  // Diccionarios (evita lookups por fila)
  const comunasByNombre = await preloadMap(app, "api::comuna.comuna", "comuna_nombre");
  const comunasById     = await preloadMap(app, "api::comuna.comuna", "comuna_id");

  await app.db.transaction(async ({ trx }) => {
    let i = 0;
    for (const row of rows) {
      if (kind === "colegios") {
        const rbd = String(row.rbd ?? "").trim();
        const nombre = String(row.colegio_nombre ?? row.nombre ?? "").trim();
        if (!rbd || !nombre) continue;

        const comunaId =
          (row.comuna_id && comunasById.get(String(row.comuna_id).trim().toLowerCase())) ||
          (row.comuna_nombre && comunasByNombre.get(String(row.comuna_nombre).trim().toLowerCase())) ||
          null;

        // UPSERT por rbd
        const found = await app.entityService.findMany("api::colegio.colegio", {
          filters: { rbd: rbd },
          limit: 1, transacting: trx,
        });

        const data: any = {
          nombre,
          rbd: Number(rbd),
          direccion: row.direccion || undefined,
          telefono: row.telefono || undefined,
          web: row.web || undefined,
          tipo_institucion: row.tipo_institucion || undefined,
          comuna: comunaId || undefined,
          publishedAt: new Date(),
        };

        if (found.length) {
          await app.entityService.update("api::colegio.colegio", found[0].id, { data, transacting: trx });
        } else {
          await app.entityService.create("api::colegio.colegio", { data, transacting: trx });
        }
      }

      if (++i % 500 === 0) console.log(`Procesados: ${i}/${rows.length}`);
    }
  });

  console.log("✔ Import terminado");
  await app.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });