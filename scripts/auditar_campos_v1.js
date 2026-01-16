/* Auditoría de campos para decidir qué llevar a v2
   - Lee modelos de Strapi (colecciones SQL)
   - Mide uso por columna (solo campos escalares)
   - Genera CSV: ./scripts/auditoria_campos_v1.csv
   - Muestra resumen en consola con banderas: UNUSED (0%) / LOW (<5%)

   Ejecutar desde la raíz del proyecto:
     node ./scripts/auditar_campos_v1.js
*/

const fs = require('node:fs');
const path = require('node:path');
const { createStrapi } = require('@strapi/strapi');

const UIDS = [
  'api::colegio.colegio',
  'api::persona.persona',
  'api::persona-trayectoria.persona-trayectoria',
];

const SCALAR_TYPES = new Set([
  'string',
  'text',
  'email',
  'uid',
  'enumeration',
  'integer',
  'biginteger',
  'float',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'time',
  'timestamp',
  'json',
]);

function attrColumnName(attrName, attrDef) {
  return attrDef?.columnName || attrName;
}

async function countRows(knex, table) {
  const r = await knex(table).count({ c: '*' });
  return Number(r?.[0]?.c ?? r?.[0]?.count ?? 0);
}

async function countNotNull(knex, table, column) {
  const r = await knex(table).whereNotNull(column).count({ c: '*' });
  return Number(r?.[0]?.c ?? r?.[0]?.count ?? 0);
}

async function countDistinct(knex, table, column) {
  const r = await knex(table).whereNotNull(column).countDistinct({ c: column });
  return Number(r?.[0]?.c ?? r?.[0]?.count ?? 0);
}

(async () => {
  const appDir = path.resolve(__dirname, '..');
  const distDir = path.join(appDir, 'dist');
  const app = await createStrapi({ appDir, distDir });
  await app.start();

  try {
    const knex = app.db.connection;
    const rowsOut = [];

    for (const uid of UIDS) {
      const model = app.getModel(uid);
      if (!model) {
        console.warn(`⚠️  No se encontró el modelo para UID: ${uid}`);
        continue;
      }

      const table = model.collectionName || model.tableName;
      if (!table) {
        console.warn(`⚠️  Modelo sin tableName/collectionName: ${uid}`);
        continue;
      }

      const total = await countRows(knex, table);
      if (total === 0) {
        summary.push({ uid, table, note: 'SIN REGISTROS' });
        continue;
      }

      const attrs = model.attributes || {};
      for (const [attrName, def] of Object.entries(attrs)) {
        if (def.type === 'relation' || def.type === 'component' || def.type === 'dynamiczone' || def.type === 'media') {
          continue;
        }
        if (!SCALAR_TYPES.has(def.type)) continue;

        const col = attrColumnName(attrName, def);
        try {
          const notNull = await countNotNull(knex, table, col);
          const distinct = await countDistinct(knex, table, col);
          const fillRate = total ? Number(((notNull / total) * 100).toFixed(2)) : 0;

          rowsOut.push({
            uid,
            table,
            field: attrName,
            column: col,
            type: def.type,
            total,
            not_null: notNull,
            distinct,
            fill_rate_pct: fillRate,
          });
        } catch (err) {
          console.warn(`↪︎ Omitido ${uid}.${attrName} (col=${col}): ${err.message}`);
        }
      }
    }

    const csvLines = [
      'uid,table,field,column,type,total,not_null,distinct,fill_rate_pct',
      ...rowsOut.map((o) =>
        [o.uid, o.table, o.field, o.column, o.type, o.total, o.not_null, o.distinct, o.fill_rate_pct].join(',')
      ),
    ];

    const outPath = path.resolve(__dirname, './auditoria_campos_v1.csv');
    fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');

    const byUID = new Map();
    for (const row of rowsOut) {
      if (!byUID.has(row.uid)) byUID.set(row.uid, []);
      byUID.get(row.uid).push(row);
    }

    console.log('\n====== RESUMEN DE USO DE CAMPOS ======');
    for (const [uid, arr] of byUID.entries()) {
      console.log(`\n${uid}`);
      if (!arr.length) {
        console.log('  (Sin campos escalares auditables)');
        continue;
      }
      const unused = arr.filter((a) => a.fill_rate_pct === 0);
      const low = arr.filter((a) => a.fill_rate_pct > 0 && a.fill_rate_pct < 5);
      const mid = arr.filter((a) => a.fill_rate_pct >= 5 && a.fill_rate_pct < 30);
      const high = arr.filter((a) => a.fill_rate_pct >= 30);

      const list = (items) => (items.length ? items.map((x) => x.field).slice(0, 10).join(', ') : '—');

      console.log(`  TOTAL CAMPOS ESCALARES: ${arr.length}`);
      console.log(`  UNUSED (0%): ${unused.length}  → ${list(unused)}${unused.length > 10 ? '…' : ''}`);
      console.log(`  LOW (<5%): ${low.length}      → ${list(low)}${low.length > 10 ? '…' : ''}`);
      console.log(`  MID (5–30%): ${mid.length}`);
      console.log(`  HIGH (≥30%): ${high.length}`);
    }

    console.log(`\n✅ CSV generado en: ${outPath}`);
    console.log('➡️  Recomendación: para v2 incluir HIGH + (MID que negocio requiera). Revisar LOW. Eliminar UNUSED.');
  } catch (err) {
    console.error('❌ Error auditoría:', err);
  } finally {
    await app.destroy();
  }
})();
