'use strict';

const path = require('path');

async function resolveOrCreateColegio(app, { colegioId, rbd, nombre }) {
  if (colegioId) return colegioId;

  const existing = await app.entityService.findMany('api::colegio.colegio', {
    filters: { rbd },
    limit: 1,
    fields: ['id', 'colegio_nombre'],
  });

  if (existing.length) return existing[0].id;

  const created = await app.entityService.create('api::colegio.colegio', {
    data: {
      rbd,
      rbd_digito_verificador: '0',
      colegio_nombre: nombre,
      publishedAt: new Date(),
    },
  });

  return created.id;
}

async function ensureList(app, { slug, anio, colegioId, descripcion }) {
  const existing = await app.entityService.findMany('api::colegio-list.colegio-list', {
    filters: { slug },
    limit: 1,
    fields: ['id'],
  });
  if (existing.length) {
    return existing[0].id;
  }

  const created = await app.entityService.create('api::colegio-list.colegio-list', {
    data: {
      slug,
      anio,
      descripcion_interna: descripcion,
      colegio: { connect: [colegioId] },
    },
  });
  return created.id;
}

async function resolveAdminUserId(app, fallbackId) {
  if (fallbackId) {
    try {
      const admin = await app.entityService.findOne('admin::user', fallbackId, {
        fields: ['id'],
      });
      if (admin?.id) return admin.id;
    } catch (err) {
      // ignore and fallback to first admin
    }
  }

  const firstAdmin = await app.entityService.findMany('admin::user', {
    fields: ['id'],
    limit: 1,
    sort: { id: 'asc' },
  });
  return firstAdmin[0]?.id || null;
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi({
    distDir: path.join(process.cwd(), 'dist'),
  });
  const app = await createStrapi(appContext).load();

  const YEAR = Number(process.env.ANIO || new Date().getFullYear());
  const LIST_SLUG = process.env.LIST_SLUG || `demo-lista-utiles-${YEAR}`;
  const LIST_DESC =
    process.env.LIST_DESC ||
    `Lista de utiles de ejemplo para el ano ${YEAR}.`;
  const RBD = Number(process.env.RBD || 999980);
  const COLEGIO_NOMBRE =
    process.env.COLEGIO_NOMBRE || 'Colegio Demo Listas Utiles';
  const VERSION_LABEL = process.env.VERSION_LABEL || `Version ${YEAR}.1`;
  const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;

  try {
    const colegioId = await resolveOrCreateColegio(app, {
      colegioId: process.env.COLEGIO_ID ? Number(process.env.COLEGIO_ID) : null,
      rbd: RBD,
      nombre: COLEGIO_NOMBRE,
    });

    const listId = await ensureList(app, {
      slug: LIST_SLUG,
      anio: YEAR,
      colegioId,
      descripcion: LIST_DESC,
    });

    const latestVersion = await app.entityService.findMany(
      'api::colegio-list-version.colegio-list-version',
      {
        filters: {
          colegio_list: { id: { $eq: listId } },
        },
        fields: ['id', 'version_number'],
        sort: { version_number: 'desc' },
        limit: 1,
      }
    );
    const nextVersionNumber =
      Number(process.env.VERSION_NUMBER) ||
      (latestVersion[0]?.version_number || 0) + 1;

    const version = await app.entityService.create(
      'api::colegio-list-version.colegio-list-version',
      {
        data: {
          version_number: nextVersionNumber,
          etiqueta: VERSION_LABEL,
          estado: 'in_review',
          colegio_list: { connect: [listId] },
          quality_flags: [
            {
              code: 'nombre_inexacto',
              label: 'Nombre detectado difiere del catalogo oficial',
              severity: 'warning',
              resolved: false,
            },
          ],
          change_summary: [
            {
              scope: 'item',
              diff_type: 'agregado',
              reference: 'Cuaderno de Matematicas 7B',
              new_value: {
                nombre: 'Cuaderno universitario cuadro grande 100 hojas',
                cantidad: 2,
              },
              impact: 'medio',
            },
          ],
          estimated_value: 45990,
          match_score: 68.5,
          error_rate: 12.5,
          url_fuente: 'https://intranet.demo.moraleja.cl/listas/demo-2025.pdf',
          fecha_publicacion_fuente: new Date(YEAR, 0, 15),
          fecha_actualizacion_fuente: new Date(YEAR, 0, 28),
          mensaje_apoderados:
            '<p>Recuerda marcar cada util con el nombre del estudiante y curso.</p>',
          hash_fuentes: 'demo_pdf_hash_1234567890',
        },
      }
    );

    await app.entityService.update('api::colegio-list.colegio-list', listId, {
      data: {
        version_actual: { connect: [version.id] },
        estado_global: 'en_proceso',
      },
    });

    const documento = await app.entityService.create(
      'api::colegio-list-document.colegio-list-document',
      {
        data: {
          nombre_archivo: 'lista-7-basico.pdf',
          curso_detectado: '7 Basico B',
          curso_normalizado: '7-basico-b',
          pagina_inicio: 1,
          pagina_fin: 3,
          estado_procesamiento: 'completado',
          procesamiento_log: {
            steps: [
              'Archivo subido por Indexar',
              'OCR completado en 2.3s',
              '7 items detectados, 1 nota general',
            ],
          },
          orden: 1,
          version: { connect: [version.id] },
          pdf_hash: 'demo_doc_hash_abcdef',
        },
      }
    );

    const item = await app.entityService.create(
      'api::colegio-list-item.colegio-list-item',
      {
        data: {
          nombre_detectado: 'Lapiz grafito N2 (marca sugerida Staedtler)',
          nombre_normalizado: 'Lapiz grafito HB Staedtler',
          cantidad: 12,
          unidad: 'unidad',
          instrucciones: 'Marcar con nombre y mantener repuesto en estuche.',
          asignatura: 'Lenguaje',
          categoria_texto: 'Utiles generales',
          omit_purchase: false,
          prioridad_revision: 'normal',
          validacion_estado: 'en_revision',
          validation_errors: [
            {
              code: 'otros',
              message: 'Considerar caja con 12 unidades para estimacion.',
              severity: 'info',
              resolved: true,
            },
          ],
          bounding_boxes: [
            {
              page: 1,
              x: 0.08,
              y: 0.32,
              width: 0.82,
              height: 0.04,
            },
          ],
          precio_unitario_referencia: 890,
          documento: { connect: [documento.id] },
          version: { connect: [version.id] },
          orden: 1,
        },
      }
    );

    await app.entityService.create('api::colegio-list-note.colegio-list-note', {
      data: {
        tipo: 'general',
        contenido:
          'Todos los cuadernos deben tener forro azul y etiqueta legible.',
        pagina: 2,
        bounding_box: {
          page: 2,
          x: 0.05,
          y: 0.18,
          width: 0.9,
          height: 0.06,
        },
        version: { connect: [version.id] },
        documento: { connect: [documento.id] },
        orden: 1,
      },
    });

    const auditorId = await resolveAdminUserId(app, ADMIN_ID);

    if (auditorId) {
      await app.entityService.create(
        'api::colegio-list-item-audit.colegio-list-item-audit',
        {
          data: {
            item: { connect: [item.id] },
            accion: 'update',
            descripcion:
              'Se actualiza nombre normalizado segun catalogo oficial.',
            datos_previos: {
              nombre_normalizado: 'Lapiz grafito (generico)',
            },
            datos_nuevos: {
              nombre_normalizado: 'Lapiz grafito HB Staedtler',
            },
            realizado_por: { connect: [auditorId] },
            realizado_en: new Date(),
            estado_version: 'in_review',
          },
        }
      );
    } else {
      console.warn(
        '[seed-demo-listas-utiles] No se encontro usuario admin, se omite auditoria de ejemplo.'
      );
    }

    console.log('--- Demo Listas de Utiles ---');
    console.log(`Colegio demo ID: ${colegioId}`);
    console.log(`Lista creada: ${LIST_SLUG} (${YEAR})`);
    console.log(
      `Version ${version.version_number} (${VERSION_LABEL}) lista para revisar.`
    );
    console.log('Documento, item, nota y auditoria de ejemplo generados.');
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error('[seed-demo-listas-utiles] Error', error);
  process.exit(1);
});
