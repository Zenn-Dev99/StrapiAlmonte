// @ts-nocheck
import { createStrapi } from '@strapi/strapi';
import path from 'node:path';
import tsUtils from '@strapi/typescript-utils';

type StrapiApp = Awaited<ReturnType<typeof createStrapi>>;

async function loadOrganizacionMap(app: StrapiApp) {
  const uid = 'api::organizacion.organizacion';
  const map = new Map<string, number>();
  let page = 1;
  const pageSize = 200;

  while (true) {
    const rows = await app.entityService.findMany(uid, {
      fields: ['id', 'nombre'],
      limit: pageSize,
      start: (page - 1) * pageSize,
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (row.nombre) map.set(row.nombre.trim().toLowerCase(), row.id);
    }
    if (rows.length < pageSize) break;
    page += 1;
  }

  return map;
}

async function migrateColegios(app: StrapiApp) {
  const colegioUid = 'api::colegio.colegio';
  const organizacionUid = 'api::organizacion.organizacion';
  const orgMap = await loadOrganizacionMap(app);

  let processed = 0;
  let created = 0;
  let updated = 0;

  let page = 1;
  const pageSize = 100;

  while (true) {
    const colegios = await app.entityService.findMany(colegioUid, {
      fields: ['id', 'colegio_nombre'],
      populate: { organizacion: { fields: ['id'] } },
      limit: pageSize,
      start: (page - 1) * pageSize,
    });

    if (!colegios.length) break;

    for (const colegio of colegios) {
      processed += 1;
      const nombre = (colegio.colegio_nombre || '').trim();
      if (!nombre) continue;

      const currentOrg = colegio.organizacion;
      if (currentOrg && currentOrg.id) continue; // ya está asociado

      const key = nombre.toLowerCase();
      let orgId = orgMap.get(key);

      if (!orgId) {
        const org = await app.entityService.create(organizacionUid, {
          data: {
            nombre,
            tipo: 'colegio',
            publishedAt: new Date().toISOString(),
          },
        });
        orgId = org.id;
        orgMap.set(key, orgId);
        created += 1;
      }

      await app.entityService.update(colegioUid, colegio.id, {
        data: {
          organizacion: { connect: [orgId] },
        },
      });
      updated += 1;
    }

    if (colegios.length < pageSize) break;
    page += 1;
  }

  console.log(`Colegios procesados: ${processed}`);
  console.log(`Organizaciones creadas: ${created}`);
  console.log(`Colegios vinculados: ${updated}`);
}

async function main() {
  console.log('🚀 Migrando colegios a organizaciones...');
  const projectDir = process.cwd();
  await tsUtils.compile(projectDir);
  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    await migrateColegios(strapi);
    console.log('✔ Migración completada.');
  } finally {
    await strapi.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

