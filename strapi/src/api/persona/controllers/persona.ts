import { factories } from '@strapi/strapi';

const parsePositiveInt = (value: unknown, fallback: number, min = 1, max = 100) => {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (Number.isNaN(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
};

const resolveMediaUrl = (file: any, strapiInstance: any) => {
  if (!file || typeof file !== 'object') return undefined;
  const url = file.url || file.formats?.thumbnail?.url;
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const baseUrl =
    strapiInstance.config.get('server.url') ||
    strapiInstance.config.get('server.admin.url') ||
    process.env.STRAPI_URL ||
    '';
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${url}` : url;
};

const buildDisplayName = (entity: Record<string, any>) => {
  if (entity.nombre_completo) return entity.nombre_completo;
  if (entity.nombre_apellidos) return entity.nombre_apellidos;
  const parts = [entity.nombres, entity.primer_apellido, entity.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .trim();
  return parts || 'Sin nombre';
};

// Map temporal para guardar datos MIRA durante la creación
// Clave: email de la persona, Valor: { password, colegio, nivel, curso }
// Se guarda en strapi para que el lifecycle pueda acceder
let datosMiraTemporales: Map<string, { password: string; colegio?: string; nivel?: string; curso?: string }>;

export default factories.createCoreController('api::persona.persona', ({ strapi }) => ({
  /**
   * Sobrescribir create para crear automáticamente persona-mira cuando se registra desde web
   */
  async create(ctx: any) {
    strapi.log.info('[persona.create] ═══════════════════════════════════════════════════════');
    strapi.log.info('[persona.create] Método create ejecutado');
    
    // Obtener body - puede venir en ctx.request.body.data o directamente
    const rawBody = ctx.request.body || {};
    const body = rawBody.data || rawBody;
    
    strapi.log.info('[persona.create] Raw body keys:', Object.keys(rawBody));
    strapi.log.info('[persona.create] Body keys:', Object.keys(body || {}));
    strapi.log.info('[persona.create] Body completo (sin password):', JSON.stringify({
      ...body,
      _mira_password: body?._mira_password ? '[HIDDEN]' : undefined,
      mira_password: body?.mira_password ? '[HIDDEN]' : undefined
    }, null, 2));
    
    // Extraer datos MIRA antes de limpiar
    const datosMira = {
      password: body?._mira_password || body?.mira_password,
      colegio: body?._mira_colegio || body?.mira_colegio,
      nivel: body?._mira_nivel || body?.mira_nivel,
      curso: body?._mira_curso || body?.mira_curso,
    };
    
    strapi.log.info('[persona.create] Datos MIRA extraídos:', {
      tienePassword: !!datosMira.password,
      colegio: datosMira.colegio,
      nivel: datosMira.nivel,
      curso: datosMira.curso
    });
    
    // Obtener email para guardar datos MIRA temporalmente
    const emails = Array.isArray(body?.emails) ? body.emails : (body?.emails ? [body.emails] : []);
    const primaryEmail = emails.find((e: any) => e.principal === true)?.email || emails[0]?.email;
    
    strapi.log.info('[persona.create] Email encontrado:', primaryEmail);
    
    // Si hay password y email, guardar temporalmente para el lifecycle
    if (datosMira.password && primaryEmail) {
      // Inicializar Map si no existe
      if (!(strapi as any).__datosMiraTemporales) {
        (strapi as any).__datosMiraTemporales = new Map();
        strapi.log.info('[persona.create] Map temporal inicializado');
      }
      const emailKey = primaryEmail.toLowerCase().trim();
      (strapi as any).__datosMiraTemporales.set(emailKey, datosMira);
      strapi.log.info(`[persona.create] ✅ Datos MIRA guardados temporalmente para email: ${emailKey}`);
      strapi.log.info(`[persona.create] Map tiene ${(strapi as any).__datosMiraTemporales.size} entradas`);
    } else {
      strapi.log.warn('[persona.create] ⚠️ No se guardaron datos MIRA temporalmente:', {
        tienePassword: !!datosMira.password,
        tieneEmail: !!primaryEmail
      });
    }
    
    // Limpiar campos MIRA del body para que no se guarden en persona
    const bodyLimpio = body ? { ...body } : {};
    delete bodyLimpio._mira_password;
    delete bodyLimpio.mira_password;
    delete bodyLimpio._mira_colegio;
    delete bodyLimpio.mira_colegio;
    delete bodyLimpio._mira_nivel;
    delete bodyLimpio.mira_nivel;
    delete bodyLimpio._mira_curso;
    delete bodyLimpio.mira_curso;
    
    // Crear persona usando entityService (como lo hace el core controller)
    strapi.log.info('[persona.create] Creando persona con body limpio (sin campos MIRA)...');
    const personaCreada = await strapi.entityService.create('api::persona.persona', {
      data: bodyLimpio,
      populate: ['emails'],
    });
    
    strapi.log.info('[persona.create] ✅ Persona creada:', {
      id: personaCreada?.id || personaCreada?.documentId,
      origen: (personaCreada as any)?.origen,
      tieneEmails: !!(personaCreada as any)?.emails
    });
    
    // Formatear respuesta como el core controller
    return { data: personaCreada };
  },
  
  async list(ctx) {
    const { search, department, location } = ctx.query as Record<string, string | undefined>;
    const page = parsePositiveInt(ctx.query.page, 1);
    const pageSize = parsePositiveInt(ctx.query.pageSize, 12);

    const filters: any[] = [];

    if (search) {
      const term = search.trim();
      if (term) {
        filters.push({
          $or: [
            { nombre_completo: { $containsi: term } },
            { nombre_apellidos: { $containsi: term } },
            { nombres: { $containsi: term } },
            { primer_apellido: { $containsi: term } },
            { segundo_apellido: { $containsi: term } },
          ],
        });
      }
    }

    if (department) {
      filters.push({
        tags: {
          name: { $containsi: department.trim() },
        },
      });
    }

    if (location) {
      filters.push({
        portal_roles: {
          colegio: {
            colegio_nombre: { $containsi: location.trim() },
          },
        },
      });
    }

    const queryFilters = filters.length ? { $and: filters } : undefined;

    const result = await strapi.entityService.findPage('api::persona.persona', {
      filters: queryFilters,
      fields: ['nombres', 'primer_apellido', 'segundo_apellido', 'nombre_apellidos', 'nombre_completo'],
      populate: {
        emails: true,
        telefonos: true,
        imagen: {
          populate: { imagen: true },
        },
        tags: {
          fields: ['name'],
        },
        portal_roles: {
          populate: {
            colegio: {
              fields: ['colegio_nombre'],
            },
          },
        },
      },
      sort: ['nombre_completo:asc', 'id:asc'],
      pagination: { page, pageSize },
    });

    const data = result.results.map((persona: any) => {
      const emails = Array.isArray(persona.emails)
        ? persona.emails
            .map((email: any) => ({
              value: email?.email || null,
              principal: Boolean(email?.principal),
            }))
            .filter((email: any) => Boolean(email.value))
        : [];

      const phones = Array.isArray(persona.telefonos)
        ? persona.telefonos
            .map((telefono: any) => ({
              value: telefono?.telefono_norm || telefono?.telefono_raw || null,
              principal: Boolean(telefono?.principal),
            }))
            .filter((telefono: any) => Boolean(telefono.value))
        : [];

      const avatarFile =
        persona.imagen?.imagen && Array.isArray(persona.imagen.imagen) ? persona.imagen.imagen[0] : undefined;
      const avatarUrl = resolveMediaUrl(avatarFile, strapi);

      const primaryRole = Array.isArray(persona.portal_roles) ? persona.portal_roles[0] : undefined;

      return {
        id: persona.id,
        name: buildDisplayName(persona),
        designation: primaryRole?.role || (Array.isArray(persona.tags) ? persona.tags[0]?.name : undefined) || null,
        department: (Array.isArray(persona.tags) ? persona.tags[0]?.name : undefined) || null,
        location: primaryRole?.colegio?.colegio_nombre || null,
        emails,
        phones,
        avatarUrl: avatarUrl || null,
      };
    });

    ctx.body = {
      data,
      meta: { pagination: result.pagination },
    };
  },
}));
