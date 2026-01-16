import { factories } from '@strapi/strapi';
import bcrypt from 'bcryptjs';

const buildDisplayName = (entity: Record<string, any> = {}) => {
  if (entity.nombre_completo) return entity.nombre_completo;
  if (entity.nombre_apellidos) return entity.nombre_apellidos;
  return [entity.nombres, entity.primer_apellido, entity.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

const formatEmails = (items: any[] | undefined) =>
  asArray(items)
    .map((email) => ({
      value: email?.email || null,
      tipo: email?.tipo || null,
      estado: email?.estado || null,
      principal: Boolean(email?.principal),
    }))
    .filter((email) => Boolean(email.value));

const formatPhones = (items: any[] | undefined) =>
  asArray(items)
    .map((phone) => ({
      value: phone?.telefono_norm || phone?.telefono_raw || null,
      tipo: phone?.tipo || null,
      estado: phone?.estado || null,
      principal: Boolean(phone?.principal),
    }))
    .filter((phone) => Boolean(phone.value));

const formatWebsites = (items: any[] | undefined) =>
  asArray(items)
    .map((website) => ({
      value: website?.website || null,
      estado: website?.estado || null,
      nota: website?.nota || null,
    }))
    .filter((website) => Boolean(website.value));

const formatAddresses = (items: any[] | undefined) =>
  asArray(items).map((direccion) => ({
    etiqueta: direccion?.direccion_principal_envio_facturacion || null,
    calle: [direccion?.nombre_calle, direccion?.numero_calle].filter(Boolean).join(' ').trim() || null,
    complemento: direccion?.complemento_direccion || null,
    comuna: direccion?.comuna?.comuna_nombre || null,
    region: direccion?.region?.region_nombre || null,
    estado: direccion?.estado || null,
  }));

const formatEstadoNombre = (items: any[] | undefined) => {
  if (!Array.isArray(items) || !items.length) return null;
  const [first] = items;
  if (!first) return null;
  return {
    estado: first.estado || null,
    nota: first.nota || null,
    fuente: first.fuente || null,
    verificadoPor: first.verificado_por || null,
    fechaVerificacion: first.fecha_verificacion || null,
  };
};

const formatPersonaSummary = (persona: any) => {
  if (!persona) return null;
  return {
    id: persona.id,
    nombreCompleto: buildDisplayName(persona) || null,
    nombres: persona.nombres || null,
    primerApellido: persona.primer_apellido || null,
    segundoApellido: persona.segundo_apellido || null,
    emails: formatEmails(persona.emails),
    telefonos: formatPhones(persona.telefonos),
    estadoVerificacion: persona.status_nombres || null,
  };
};

const collectUnique = <T>(items: T[], getKey: (item: T) => string | number | undefined) => {
  const map = new Map<string | number, T>();
  items.forEach((item) => {
    const key = getKey(item);
    if (key === undefined || key === null) return;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

export default factories.createCoreController('api::persona-trayectoria.persona-trayectoria', ({ strapi }) => ({
  async create(ctx) {
    // PROTECCIÓN TEMPRANA: Eliminar 'region' del payload antes del lifecycle hook
    // El campo 'region' NO existe en persona-trayectoria (existe 'colegio_region')
    // Esto previene el error "Invalid key region" de Strapi
    const { data } = ctx.request.body;
    
    if (data && 'region' in data) {
      strapi.log.warn('[persona-trayectoria.controller] ⚠️ Campo "region" detectado en controller.create, eliminándolo (debe ser colegio_region)');
      strapi.log.debug('[persona-trayectoria.controller] Data antes de limpiar:', JSON.stringify(data, null, 2));
      delete data.region;
      ctx.request.body.data = data;
    }
    
    // Continuar con el flujo normal del controller base
    return await super.create(ctx);
  },

  async update(ctx) {
    // PROTECCIÓN TEMPRANA: Eliminar 'region' del payload antes del lifecycle hook
    const { data } = ctx.request.body;
    
    if (data && 'region' in data) {
      strapi.log.warn('[persona-trayectoria.controller] ⚠️ Campo "region" detectado en controller.update, eliminándolo (debe ser colegio_region)');
      delete data.region;
      ctx.request.body.data = data;
    }
    
    // Continuar con el flujo normal del controller base
    return await super.update(ctx);
  },

  async login(ctx) {
    try {
      const { correo, password } = ctx.request.body;

      if (!correo || !password) {
        return ctx.badRequest('correo y password son requeridos');
      }

      // Buscar persona-trayectoria por correo
      const trayectorias = await strapi.entityService.findMany('api::persona-trayectoria.persona-trayectoria' as any, {
        filters: { correo } as any,
        populate: {
          persona: {
            populate: {
              emails: true,
            },
          },
          colegio: true,
        },
      }) as any[];

      if (!trayectorias || trayectorias.length === 0) {
        return ctx.notFound('No se encontró un profesor con este correo');
      }

      const trayectoria = trayectorias[0] as any;

      // Extraer campos (pueden venir en attributes si tiene draft/publish)
      const trayectoriaAttrs = trayectoria.attributes || trayectoria;
      const activo = trayectoriaAttrs.activo !== undefined ? trayectoriaAttrs.activo : trayectoria.activo;

      // Verificar que esté activo
      if (!activo) {
        return ctx.forbidden('Tu cuenta está desactivada. Contacta al administrador.');
      }

      // Obtener el password del profesor (campo privado)
      const trayectoriaCompleta = await strapi.db.query('api::persona-trayectoria.persona-trayectoria').findOne({
        where: { id: trayectoria.id },
        select: ['id', 'password', 'correo', 'activo'],
      });

      // Verificar password
      if (!trayectoriaCompleta?.password) {
        return ctx.forbidden('No se ha configurado una contraseña para este profesor.');
      }

      const passwordMatch = await bcrypt.compare(password, trayectoriaCompleta.password);

      if (!passwordMatch) {
        return ctx.unauthorized('Contraseña incorrecta');
      }

      // Generar JWT directamente con el ID del profesor (igual que estudiantes)
      // NO usar shadow users, generar JWT directamente
      let jwt = '';
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        jwt = jwtService.issue({
          id: trayectoria.id,
          email: trayectoriaCompleta.correo,
        });
        strapi.log.info(`[persona-trayectoria.login] JWT generado exitosamente para profesor ${trayectoria.id}`);
      } catch (jwtError: any) {
        strapi.log.error(`[persona-trayectoria.login] Error al generar JWT: ${jwtError.message}`);
      }

      // Actualizar último acceso
      await strapi.entityService.update('api::persona-trayectoria.persona-trayectoria' as any, trayectoria.id, {
        data: {
          ultimo_acceso: new Date(),
        } as any,
      });

      return ctx.send({
        jwt,
        usuario: {
          id: trayectoria.id,
          correo: trayectoriaCompleta.correo,
          tipo: 'profesor',
          persona: trayectoria.persona || null,
          colegio: trayectoria.colegio || null,
        },
      });
    } catch (error: any) {
      strapi.log.error('[persona-trayectoria.login] Error:', error);
      return ctx.internalServerError(error.message || 'Error al iniciar sesión');
    }
  },

  async getCurrentUser(ctx) {
    try {
      const { id } = ctx.query;

      if (!id) {
        return ctx.badRequest('ID de usuario es requerido');
      }

      const trayectoria = await strapi.entityService.findOne('api::persona-trayectoria.persona-trayectoria' as any, id as number, {
        populate: {
          persona: {
            populate: {
              emails: true,
            },
          },
          colegio: true,
        },
      }) as any;

      if (!trayectoria) {
        return ctx.notFound('Usuario no encontrado');
      }

      return ctx.send({
        data: {
          id: trayectoria.id,
          correo: trayectoria.correo,
          tipo: 'profesor',
          persona: trayectoria.persona || null,
          colegio: trayectoria.colegio || null,
        },
      });
    } catch (error: any) {
      strapi.log.error('[persona-trayectoria.getCurrentUser] Error:', error);
      return ctx.internalServerError(error.message || 'Error al obtener usuario');
    }
  },

  async libraryCard(ctx) {
    const rawId = ctx.params?.id;
    const trayectoriaId = Number(rawId);

    if (!Number.isInteger(trayectoriaId) || trayectoriaId <= 0) {
      return ctx.badRequest('El identificador solicitado no es válido.');
    }

    const record: any = await strapi.entityService.findOne(
      'api::persona-trayectoria.persona-trayectoria',
      trayectoriaId,
      {
        fields: ['cargo', 'anio', 'role_key', 'department', 'org_display_name', 'is_current'],
        populate: {
          persona: {
            fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'status_nombres'],
            populate: {
              emails: true,
              telefonos: true,
            },
          },
          colegio: {
            fields: ['id', 'colegio_nombre', 'dependencia', 'estado_estab'],
            populate: {
              emails: true,
              telefonos: true,
              Website: true,
              direcciones: {
                populate: {
                  region: { fields: ['id', 'region_nombre'] },
                  comuna: { fields: ['id', 'comuna_nombre'] },
                },
              },
              comuna: { fields: ['id', 'comuna_nombre'] },
              region: { fields: ['id', 'region_nombre'] },
              estado_nombre: true,
            },
          },
          asignatura: {
            fields: ['id', 'nombre', 'area_general', 'area_subsector', 'cod_subsector'],
          },
          curso: {
            fields: ['id', 'titulo', 'letra', 'anio'],
            populate: {
              nivel_ref: { fields: ['id', 'nombre', 'clave', 'ensenanza', 'ciclo'] },
            },
          },
          curso_asignatura: {
            fields: ['id', 'anio'],
            populate: {
              asignatura: {
                fields: ['id', 'nombre', 'area_general', 'area_subsector', 'cod_subsector'],
              },
              curso: {
                fields: ['id', 'titulo', 'letra', 'anio'],
                populate: {
                  nivel_ref: { fields: ['id', 'nombre', 'clave', 'ensenanza', 'ciclo'] },
                },
              },
            },
          },
          colegio_comuna: { fields: ['id', 'comuna_nombre'] },
          colegio_region: { fields: ['id', 'region_nombre'] },
        },
      },
    );

    if (!record) {
      return ctx.notFound('Registro de Colegio · Profesores no encontrado.');
    }

    const personaId = record.persona?.id;
    const colegioId = record.colegio?.id;

    const [relatedTrayectorias, assignments, events] = await Promise.all([
      personaId && colegioId
        ? strapi.entityService.findMany('api::persona-trayectoria.persona-trayectoria', {
            filters: { persona: personaId, colegio: colegioId },
            populate: {
              asignatura: {
                fields: ['id', 'nombre', 'area_general', 'area_subsector', 'cod_subsector'],
              },
              curso: {
                fields: ['id', 'titulo', 'letra', 'anio'],
                populate: {
                  nivel_ref: { fields: ['id', 'nombre', 'clave', 'ensenanza', 'ciclo'] },
                },
              },
              curso_asignatura: {
                fields: ['id', 'anio'],
                populate: {
                  asignatura: {
                    fields: ['id', 'nombre', 'area_general', 'area_subsector', 'cod_subsector'],
                  },
                  curso: {
                    fields: ['id', 'titulo', 'letra', 'anio'],
                    populate: {
                      nivel_ref: { fields: ['id', 'nombre', 'clave', 'ensenanza', 'ciclo'] },
                    },
                  },
                },
              },
            },
            fields: ['id', 'cargo', 'anio', 'role_key', 'department', 'org_display_name', 'is_current'],
            sort: ['is_current:desc', 'anio:desc', 'id:desc'],
            limit: 200,
          })
        : [],
      colegioId
        ? strapi.entityService.findMany('api::cartera-asignacion.cartera-asignacion', {
            filters: { colegio: colegioId, is_current: true },
            populate: {
              ejecutivo: {
                fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'status_nombres'],
                populate: {
                  emails: true,
                  telefonos: true,
                },
              },
            },
            fields: ['id', 'rol', 'prioridad', 'orden'],
            sort: ['updatedAt:desc', 'createdAt:desc'],
            limit: 10,
          })
        : [],
      colegioId
        ? strapi.entityService.findMany('api::colegio-event.colegio-event', {
            filters: { colegio: colegioId },
            fields: ['id', 'action', 'field', 'value', 'actor_email', 'actor_name', 'createdAt', 'meta'],
            sort: ['createdAt:desc'],
            limit: 10,
          })
        : [],
    ]);

    const trayectorias = relatedTrayectorias.length ? relatedTrayectorias : [record];

    const asignaturas = collectUnique(
      trayectorias
        .map((trayectoria: any) => trayectoria.asignatura || trayectoria.curso_asignatura?.asignatura)
        .filter(Boolean),
      (asignatura: any) => asignatura.id,
    ).map((asignatura: any) => ({
      id: asignatura.id,
      nombre: asignatura.nombre || null,
      areaGeneral: asignatura.area_general || null,
      areaSubsector: asignatura.area_subsector || null,
      codigo: asignatura.cod_subsector || null,
    }));

    const niveles = collectUnique(
      trayectorias
        .map(
          (trayectoria: any) =>
            trayectoria.curso?.nivel_ref ||
            trayectoria.curso_asignatura?.curso?.nivel_ref ||
            trayectoria.curso?.nivel ||
            trayectoria.curso_asignatura?.nivel,
        )
        .filter(Boolean),
      (nivel: any) => nivel.id || nivel.nombre,
    ).map((nivel: any) => ({
      id: nivel.id || null,
      nombre: nivel.nombre || null,
      clave: nivel.clave || null,
      ensenanza: nivel.ensenanza || null,
      ciclo: nivel.ciclo || null,
    }));

    const primaryAsignatura = asignaturas[0];
    const area =
      record.department ||
      record.org_display_name ||
      primaryAsignatura?.areaGeneral ||
      primaryAsignatura?.areaSubsector ||
      null;

    const comercialAssignment = assignments.find((assignment: any) => assignment.rol === 'comercial');
    const soporteAssignments = assignments.filter(
      (assignment: any) => assignment.rol === 'soporte1' || assignment.rol === 'soporte2',
    );
    const prioridad =
      comercialAssignment?.prioridad ||
      assignments.find((assignment: any) => Boolean(assignment.prioridad))?.prioridad ||
      null;
    const orden =
      typeof comercialAssignment?.orden === 'number'
        ? comercialAssignment.orden
        : assignments.find((assignment: any) => typeof assignment.orden === 'number')?.orden ?? null;

    const colegio = record.colegio;
    const persona = record.persona;

    const response = {
      personaTrayectoriaId: record.id,
      persona: formatPersonaSummary(persona),
      profesor: {
        nombre: buildDisplayName(persona) || null,
        primerApellido: persona?.primer_apellido || null,
        emails: formatEmails(persona?.emails),
        telefonos: formatPhones(persona?.telefonos),
        estadoVerificacion: persona?.status_nombres || null,
      },
      relacion: {
        cargo: record.cargo || null,
        area,
        rol: record.role_key || null,
        departamento: record.department || null,
        asignaturas,
        niveles,
        anio: record.anio || null,
        esActual: Boolean(record.is_current),
      },
      colegio: {
        id: colegio?.id || null,
        nombre: colegio?.colegio_nombre || null,
        dependencia: colegio?.dependencia || null,
        comuna: colegio?.comuna?.comuna_nombre || record?.colegio_comuna?.comuna_nombre || null,
        region: colegio?.region?.region_nombre || record?.colegio_region?.region_nombre || null,
        estadoEstablecimiento: colegio?.estado_estab || null,
        estadoVerificacion: formatEstadoNombre(colegio?.estado_nombre),
        emails: formatEmails(colegio?.emails),
        telefonos: formatPhones(colegio?.telefonos),
        websites: formatWebsites(colegio?.Website),
        direcciones: formatAddresses(colegio?.direcciones),
        prioridad,
        orden,
        ejecutivoComercial: comercialAssignment
          ? {
              rol: comercialAssignment.rol,
              prioridad: comercialAssignment.prioridad || null,
              orden: typeof comercialAssignment.orden === 'number' ? comercialAssignment.orden : null,
              persona: formatPersonaSummary(comercialAssignment.ejecutivo),
            }
          : null,
        ejecutivosSoporte: soporteAssignments.map((assignment: any) => ({
          rol: assignment.rol,
          prioridad: assignment.prioridad || null,
          orden: typeof assignment.orden === 'number' ? assignment.orden : null,
          persona: formatPersonaSummary(assignment.ejecutivo),
        })),
        accionesRecientes: events.map((event: any) => ({
          id: event.id,
          accion: event.action,
          campo: event.field || null,
          valor: event.value || null,
          actorNombre: event.actor_name || null,
          actorEmail: event.actor_email || null,
          fecha: event.createdAt || null,
          meta: event.meta || null,
        })),
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };

    ctx.body = { data: response };
  },
}));
