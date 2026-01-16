import type { Core } from '@strapi/strapi';

const truthy = new Set(['1', 'true', 'yes', 'on']);

export const parseEnvFlag = (value: string | undefined, fallback = false) => {
  if (value === undefined) return fallback;
  return truthy.has(value.toLowerCase());
};

export const ensureEmailTemplates = async (strapi: Core.Strapi) => {
  const templates = [
    {
      key: 'novedades-matematica-2026',
      name: 'Novedades Matemática 2026',
      subject: 'Hola {{profesor.nombre}} – Novedades Ediciones 2026 Matemática',
      body_text:
        'Hola {{profesor.nombre}},\n\n' +
        'Te escribe {{ejecutivo.nombre}} de Editorial Moraleja. En el siguiente enlace encontrarás ' +
        'las actualizaciones del libro {{libro.titulo}}.\n' +
        '{{material.url}}\n\nQuedo atenta a tus comentarios.',
      body_html: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; background-color:#f6f9fc; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(15,63,111,0.12);">
        <tr>
          <td style="background:#064a88; padding:24px 32px; color:#ffffff;">
            <img src="https://media.moraleja.cl/email-assets/moraleja-banner.png" alt="Editorial Moraleja" style="display:block; max-width:160px; margin-bottom:16px;">
            <h1 style="margin:0; font-size:22px;">Novedades Ediciones 2026 Matemática</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px; color:#1a2a4a; font-size:16px; line-height:1.6;">
            <p style="margin-top:0;">Hola <strong>{{profesor.nombre}}</strong>,</p>
            <p>Te escribe <strong>{{ejecutivo.nombre}}</strong> de Editorial Moraleja. Queremos contarte que ya tenemos disponibles las actualizaciones del libro <strong>{{libro.titulo}}</strong> para la edición 2026.</p>
            <p>Preparamos un resumen con los principales cambios, nuevos recursos digitales y sugerencias de actividades para tu planificación anual.</p>
            <p style="text-align:center; margin:32px 0;">
              <a href="{{material.url}}" style="background:#e85d25; color:#ffffff; text-decoration:none; padding:14px 34px; border-radius:28px; font-weight:bold; display:inline-block;">Revisar las novedades</a>
            </p>
            <p>Si tienes dudas o quieres coordinar una reunión, puedes responder a este correo o escribir directamente a <a href="mailto:{{ejecutivo.email}}" style="color:#064a88;">{{ejecutivo.email}}</a>.</p>
            <p>Un abrazo,<br>{{ejecutivo.nombre}}<br>Editorial Moraleja</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px; background:#f0f4fb; color:#4a5d7a; font-size:13px; text-align:center;">
            <p style="margin:0;">¿Conoces todas nuestras líneas editoriales? Visítanos en <a href="https://www.moraleja.cl" style="color:#064a88;">moraleja.cl</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`,
      meta: {
        from: 'Margarita Salcedo <colegios@moraleja.cl>',
        replyTo: 'colegios@moraleja.cl',
        cc: [],
        bcc: ['andres@moraleja.cl', 'ventas@moraleja.cl'],
      },
      notes:
        'Plantilla base para notificar a profesores sobre novedades de Matemática 2026. Usa data.profesor, data.ejecutivo, data.libro y data.material.',
    },
  ];

  for (const template of templates) {
    try {
      const existing = await strapi.entityService.findMany('api::email-template.email-template', {
        filters: { key: template.key },
        limit: 1,
      });

      if (!existing.length) {
        await strapi.entityService.create('api::email-template.email-template', {
          data: template,
        });
        strapi.log.info(`[email-template] creada plantilla ${template.key}`);
      }
    } catch (error) {
      strapi.log.error(`[email-template] error al asegurar plantilla ${template.key}`, error);
    }
  }
};

// Ajusta el mainField y defaultSortBy para que el encabezado
// de los componentes repetibles muestre el dato correcto.
export const ensureContentManagerMainFields = async (strapi: Core.Strapi) => {
  type Cfg = { settings?: Record<string, any>; [k: string]: any };

  const setComponentMainField = async (uid: string, field: string) => {
    const key = `configuration_components::${uid}`;
    try {
      const store = strapi.store({ type: 'plugin', name: 'content-manager', key });
      const cur = (await store.get()) as Cfg | undefined;
      const settings = { ...(cur?.settings || {}) };
      let changed = false;
      if (settings.mainField !== field) {
        settings.mainField = field;
        changed = true;
      }
      if (settings.defaultSortBy !== field) {
        settings.defaultSortBy = field;
        changed = true;
      }
      if (changed) {
        await store.set({ value: { ...(cur || {}), settings } });
        strapi.log.info(`[content-manager] Set mainField '${field}' for ${uid}`);
      }
    } catch (e) {
      strapi.log.warn(`[content-manager] Unable to set mainField for ${uid}: ${e?.message || e}`);
    }
  };

  // Aplica a los componentes usados en producción
  await setComponentMainField('contacto.email', 'email');
  await setComponentMainField('contacto.telefono', 'telefono_norm');
  await setComponentMainField('contacto.logo-o-avatar', 'imagen');
  // Opcional: componente compartido de media
  await setComponentMainField('shared.media', 'file');

  const ensureMetadataMainField = (
    meta: Record<string, any>,
    fieldName: string,
    mainField: string,
  ) => {
    const target = { ...(meta[fieldName] || {}) };
    const edit = { ...(target.edit || {}) };
    const list = { ...(target.list || {}) };
    let modified = false;
    if (edit.mainField !== mainField) {
      edit.mainField = mainField;
      modified = true;
    }
    if (list.mainField !== mainField) {
      list.mainField = mainField;
      modified = true;
    }
    if (modified) {
      target.edit = edit;
      target.list = list;
      meta[fieldName] = target;
    }
    return modified;
  };

  // Content-Types
  const setContentTypeMainField = async (uid: string, field: string, relations?: Array<{ field: string; mainField: string }>) => {
    const key = `configuration_content_types::${uid}`;
    try {
      const store = strapi.store({ type: 'plugin', name: 'content-manager', key });
      const cur = (await store.get()) as Cfg | undefined;
      const settings = { ...(cur?.settings || {}) };
      const metadatas = { ...(cur?.metadatas || {}) };
      let changed = false;
      if (settings.mainField !== field) { settings.mainField = field; changed = true; }
      if (settings.defaultSortBy !== field) { settings.defaultSortBy = field; changed = true; }
      if (Array.isArray(relations) && relations.length) {
        for (const rel of relations) {
          if (ensureMetadataMainField(metadatas, rel.field, rel.mainField)) {
            changed = true;
          }
        }
      }
      if (changed) {
        await store.set({ value: { ...(cur || {}), settings, metadatas } });
        strapi.log.info(`[content-manager] Set CT mainField '${field}' for ${uid}`);
      }
    } catch (e) {
      strapi.log.warn(`[content-manager] Unable to set CT mainField for ${uid}: ${e?.message || e}`);
    }
  };
  await setContentTypeMainField('api::curso.curso', 'titulo');
  
  // Configurar Persona para usar RUT como mainField
  strapi.log.info('[bootstrap] Configurando mainField de Persona a "rut"');
  await setContentTypeMainField('api::persona.persona', 'rut');
  
  // Configurar Colaborador y su relación con Persona
  strapi.log.info('[bootstrap] Configurando mainField de Colaborador y relación persona');
  await setContentTypeMainField('api::colaborador.colaborador', 'email_login', [
    { field: 'persona', mainField: 'rut' },
  ]);
  
  // Forzar actualización de la configuración de la relación persona en colaborador
  try {
    const key = `configuration_content_types::api::colaborador.colaborador`;
    const store = strapi.store({ type: 'plugin', name: 'content-manager', key });
    const cur = (await store.get()) as Cfg | undefined;
    const metadatas = { ...(cur?.metadatas || {}) };
    
    if (!metadatas.persona) {
      metadatas.persona = {};
    }
    if (!metadatas.persona.edit) {
      metadatas.persona.edit = {};
    }
    if (!metadatas.persona.list) {
      metadatas.persona.list = {};
    }
    
    let changed = false;
    if (metadatas.persona.edit.mainField !== 'rut') {
      metadatas.persona.edit.mainField = 'rut';
      changed = true;
    }
    if (metadatas.persona.list.mainField !== 'rut') {
      metadatas.persona.list.mainField = 'rut';
      changed = true;
    }
    
    if (changed) {
      await store.set({ value: { ...(cur || {}), metadatas } });
      strapi.log.info('[bootstrap] Forzada actualización de mainField "rut" en relación persona de Colaborador');
    }
  } catch (e) {
    strapi.log.warn(`[bootstrap] Error al forzar mainField en relación persona: ${e?.message || e}`);
  }
  await setContentTypeMainField('api::persona-trayectoria.persona-trayectoria', 'persona', [
    { field: 'persona', mainField: 'nombre_completo' },
    { field: 'colegio', mainField: 'colegio_nombre' },
    { field: 'curso', mainField: 'titulo' },
    { field: 'asignatura', mainField: 'nombre' },
  ]);
  
  // Configurar libro-mira para mostrar activo (ya no existe codigo_activacion_base)
  strapi.log.info('[bootstrap] Configurando mainField de libro-mira a "activo"');
  await setContentTypeMainField('api::libro-mira.libro-mira', 'activo', [
    { field: 'libro', mainField: 'nombre_libro' },
  ]);
  
  // Configurar evaluacion para mostrar nombre y relación libro_mira
  strapi.log.info('[bootstrap] Configurando mainField de evaluacion a "nombre" y relación libro_mira');
  await setContentTypeMainField('api::evaluacion.evaluacion', 'nombre', [
    { field: 'libro_mira', mainField: 'activo' },
  ]);
};

// Normaliza estados a: Por Verificar, Verificado, Aprobado
export const migrateEstadosData = async (strapi: Core.Strapi) => {
  const knex = strapi.db.connection as any;

  // Helpers
  const toPV = [
    'reportado', 'Reportado', 'por verificar', 'Por verificar', 'por-verificar', 'Por-verificar',
    'pending', 'Pending', 'pendiente', 'Pendiente', 'rechazado', 'Rechazado', 'otro', 'Otro'
  ];
  const toV = ['verificado', 'Verificado'];
  const toA = ['aprobado', 'Aprobado'];

  async function updateEstado(table: string, column = 'estado') {
    try {
      if (!(await knex.schema.hasTable(table))) return;
      if (toPV.length) await knex(table).whereIn(column, toPV).update({ [column]: 'Por Verificar' });
      if (toV.length) await knex(table).whereIn(column, toV).update({ [column]: 'Verificado' });
      if (toA.length) await knex(table).whereIn(column, toA).update({ [column]: 'Aprobado' });
      // Normaliza mayúsculas exactas
      await knex(table).where(column, 'Por verificar').update({ [column]: 'Por Verificar' });
    } catch (e) {
      strapi.log.warn(`[migrateEstados] ${table}.${column}: ${e?.message || e}`);
    }
  }

  await updateEstado('components_contacto_email');
  await updateEstado('components_contacto_telefono');
  await updateEstado('components_contacto_logo_o_avatars');
  await updateEstado('components_contacto_websites');
  // Direcciones históricas usan columna 'estado'
  await updateEstado('components_contacto_direccions');
};

const normalizePhoneCL = (v?: string) => {
  if (!v) return v as any;
  const d = String(v).replace(/\D+/g, '');
  if (!d) return v as any;
  if (d.startsWith('56')) return `+${d}`;
  if (d.length === 9 && d.startsWith('9')) return `+569${d.slice(1)}`;
  if (d.length === 8) return `+562${d}`;
  return `+56${d}`;
};

export const backfillTelefonoNorm = async (strapi: Core.Strapi) => {
  const knex = strapi.db.connection as any;
  try {
    if (!(await knex.schema.hasTable('components_contacto_telefono'))) return;
    const rows = await knex('components_contacto_telefono')
      .select('id', 'telefono_raw', 'telefono_norm')
      .where((qb: any) => qb.whereNull('telefono_norm').orWhere('telefono_norm', ''));
    let updated = 0;
    for (const row of rows) {
      const norm = normalizePhoneCL(row.telefono_raw || row.telefono_norm);
      if (norm) {
        await knex('components_contacto_telefono').where({ id: row.id }).update({ telefono_norm: norm });
        updated += 1;
      }
    }
    if (updated) strapi.log.info(`[backfillTelefonoNorm] Actualizados ${updated} registros`);
  } catch (e) {
    strapi.log.warn(`[backfillTelefonoNorm] error: ${e?.message || e}`);
  }
};

// Completa 'titulo' de Curso si falta, usando nivel_ref + letra + anio
export const backfillCursoTitulos = async (strapi: Core.Strapi) => {
  try {
    const rows = await strapi.entityService.findMany('api::curso.curso', {
      filters: { $or: [{ titulo: { $null: true } }, { titulo: { $eq: '' } }, { curso_letra_anio: { $null: true } }, { curso_letra_anio: { $eq: '' } }] },
      populate: { nivel_ref: { fields: ['nombre','clave'] } as any },
      fields: ['id', 'letra', 'anio', 'titulo', 'curso_letra_anio'],
      limit: 10000,
    });
    let updated = 0;
    for (const r of rows as any[]) {
      const nivelNombre = r?.nivel_ref?.nombre || r?.nivel_ref?.clave || '';
      const letra = (r?.letra || '').toString().trim().toUpperCase();
      const anio = r?.anio ? Number(r.anio) : undefined;
      const base = [nivelNombre, letra].filter(Boolean).join(' ');
      const titulo = anio ? `${base} (${anio})` : base;
      const curso_letra_anio = letra && anio ? `${letra}${anio}` : r.curso_letra_anio;
      if ((titulo && titulo !== r.titulo) || (curso_letra_anio && curso_letra_anio !== r.curso_letra_anio)) {
        await strapi.entityService.update('api::curso.curso', r.id, { data: { titulo, curso_letra_anio } });
        updated += 1;
      }
    }
    if (updated) strapi.log.info(`[backfillCursoTitulos] Actualizados ${updated} cursos`);
  } catch (e) {
    strapi.log.warn(`[backfillCursoTitulos] error: ${e?.message || e}`);
  }
};

// Completa letra/curso_letra_anio en curso-asignatura desde curso
export const backfillCursoAsignaturaMeta = async (strapi: Core.Strapi) => {
  try {
    const rows = await strapi.entityService.findMany('api::curso-asignatura.curso-asignatura', {
      filters: { $or: [{ letra: { $null: true } }, { curso_letra_anio: { $null: true } }, { curso_letra_anio: { $eq: '' } }] },
      populate: { curso: { fields: ['id','letra','anio','curso_letra_anio'] } as any },
      fields: ['id','letra','curso_letra_anio'],
      limit: 10000,
    });
    let updated = 0;
    for (const r of rows as any[]) {
      const curso = r?.curso || {};
      const letra = r.letra || curso.letra;
      const code = r.curso_letra_anio || curso.curso_letra_anio || (curso.letra && curso.anio ? `${String(curso.letra).toUpperCase()}${Number(curso.anio)}` : undefined);
      if (letra || code) {
        await strapi.entityService.update('api::curso-asignatura.curso-asignatura', r.id, { data: { letra, curso_letra_anio: code } });
        updated += 1;
      }
    }
    if (updated) strapi.log.info(`[backfillCursoAsignaturaMeta] Actualizados ${updated} curso-asignatura`);
  } catch (e) {
    strapi.log.warn(`[backfillCursoAsignaturaMeta] error: ${e?.message || e}`);
  }
};

export type BootstrapTaskName =
  | 'contentManagerSync'
  | 'migrateEstados'
  | 'backfillTelefono'
  | 'backfillCursoTitulos'
  | 'backfillCursoAsignatura'
  | 'ensureEmailTemplates';

export const bootstrapTasksMap: Record<BootstrapTaskName, (strapi: Core.Strapi) => Promise<void>> = {
  contentManagerSync: ensureContentManagerMainFields,
  migrateEstados: migrateEstadosData,
  backfillTelefono: backfillTelefonoNorm,
  backfillCursoTitulos: backfillCursoTitulos,
  backfillCursoAsignatura: backfillCursoAsignaturaMeta,
  ensureEmailTemplates,
};
