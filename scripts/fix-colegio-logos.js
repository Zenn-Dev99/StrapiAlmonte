const path = require('path');
const { compileStrapi, createStrapi } = require('@strapi/strapi');

const APPLY_FLAG = '--apply';
const isApply = process.argv.includes(APPLY_FLAG);

const STATUS_RESET = 'Por Verificar';
const TARGET_STATUSES = new Set(['Verificado', 'Aprobado']);

const normalizeLogoPayload = (logo = {}) => {
  if (!logo) return null;
  const payload = {};

  if (logo.id) payload.id = logo.id;

  for (const [key, value] of Object.entries(logo)) {
    if (['id', 'imagen'].includes(key)) continue;
    payload[key] = value ?? null;
  }

  if (Array.isArray(logo.imagen) && logo.imagen.length > 0) {
    payload.imagen = logo.imagen
      .map((file) => {
        if (!file) return null;
        if (typeof file === 'number') return file;
        if (typeof file === 'object' && file.id) return file.id;
        return null;
      })
      .filter(Boolean);
  } else {
    payload.imagen = [];
  }

  payload.estado = STATUS_RESET;

  return payload;
};

const main = async () => {
  const appContext = await compileStrapi({ distDir: path.join(process.cwd(), 'dist') });
  const strapi = await createStrapi(appContext).load();

  try {
    const colegios = await strapi.entityService.findMany('api::colegio.colegio', {
      filters: {
        logo: {
          estado: {
            $in: Array.from(TARGET_STATUSES),
          },
        },
      },
      populate: {
        logo: {
          populate: ['imagen'],
        },
      },
      limit: 5000,
    });

    const pendientes = colegios.filter((colegio) => {
      const logo = colegio?.logo;
      if (!logo) return false;
      if (!TARGET_STATUSES.has(logo.estado)) return false;
      const imagenes = Array.isArray(logo.imagen) ? logo.imagen : [];
      return imagenes.length === 0;
    });

    if (!pendientes.length) {
      console.log('✅ No se encontraron colegios con logo aprobado/verificado sin imagen.');
      return;
    }

    console.log(
      `${isApply ? '🛠️  Aplicando corrección' : 'ℹ️  Modo lectura'} – Encontrados ${pendientes.length} colegios.`
    );

    for (const colegio of pendientes) {
      const info = `ID ${colegio.id} · RBD ${colegio.rbd ?? '-'} · ${colegio.colegio_nombre}`;
      if (!isApply) {
        console.log(`   • ${info}`);
        continue;
      }

      try {
        const payload = normalizeLogoPayload(colegio.logo);
        await strapi.entityService.update('api::colegio.colegio', colegio.id, {
          data: {
            logo: payload,
          },
        });
        console.log(`   ✓ Actualizado ${info}`);
      } catch (error) {
        console.error(`   ✗ Error al actualizar ${info}: ${error?.message || error}`);
      }
    }

    if (!isApply) {
      console.log(`\nEjecuta con "${APPLY_FLAG}" para aplicar la corrección.`);
    }
  } finally {
    try {
      await strapi.destroy();
    } catch (error) {
      if (!String(error?.message || '').includes('aborted')) {
        throw error;
      }
    }
  }
};

main().catch((error) => {
  console.error('[fix-colegio-logos] Error', error);
  process.exit(1);
});
