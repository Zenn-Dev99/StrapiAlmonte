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

export default factories.createCoreController('api::colegio.colegio', ({ strapi }) => ({
  async list(ctx) {
    const { search, dependencia } = ctx.query as Record<string, string | undefined>;
    const page = parsePositiveInt(ctx.query.page, 1);
    const pageSize = parsePositiveInt(ctx.query.pageSize, 12);

    const filters: any[] = [];

    if (search) {
      const term = search.trim();
      if (term) {
        const asNumber = Number(term);
        filters.push({
          $or: [
            { colegio_nombre: { $containsi: term } },
            ...(Number.isNaN(asNumber) ? [] : [{ rbd: { $eq: asNumber } }]),
          ],
        });
      }
    }

    if (dependencia) {
      filters.push({
        dependencia: { $eqi: dependencia.trim() },
      });
    }

    const queryFilters = filters.length ? { $and: filters } : undefined;

    const result = await strapi.entityService.findPage('api::colegio.colegio', {
      filters: queryFilters,
      fields: ['colegio_nombre', 'rbd', 'dependencia'],
      populate: {
        telefonos: true,
        emails: true,
        logo: {
          populate: { imagen: true },
        },
        comuna: {
          fields: [
            'comuna_nombre',
            'comuna_id',
            'provincia_nombre',
            'provincia_id',
            'region_nombre',
            'region_id',
            'zona_nombre',
            'zona_id',
          ],
        },
      },
      sort: ['colegio_nombre:asc', 'id:asc'],
      pagination: { page, pageSize },
    });

    const data = result.results.map((colegio: any) => {
      const emails = Array.isArray(colegio.emails)
        ? colegio.emails
            .map((email: any) => ({
              value: email?.email || null,
              principal: Boolean(email?.principal),
            }))
            .filter((email: any) => Boolean(email.value))
        : [];

      const phones = Array.isArray(colegio.telefonos)
        ? colegio.telefonos
            .map((telefono: any) => ({
              value: telefono?.telefono_norm || telefono?.telefono_raw || null,
              principal: Boolean(telefono?.principal),
            }))
            .filter((telefono: any) => Boolean(telefono.value))
        : [];

      const logoFile =
        colegio.logo?.imagen && Array.isArray(colegio.logo.imagen) ? colegio.logo.imagen[0] : undefined;
      const avatarUrl = resolveMediaUrl(logoFile, strapi);

      // Obtener ubicación desde comuna (derivando región si es necesario)
      const location = colegio.comuna?.comuna_nombre || 
                       colegio.comuna?.provincia?.region?.region_nombre || 
                       null;

      return {
        id: colegio.id,
        name: colegio.colegio_nombre,
        dependencia: colegio.dependencia || null,
        location,
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
  async publicList(ctx) {
    // Endpoint público para obtener solo ID y nombre de colegios
    // Usado en formularios de registro público
    try {
      const result = await strapi.entityService.findPage('api::colegio.colegio', {
        fields: ['id', 'colegio_nombre'],
        sort: ['colegio_nombre:asc'],
        pagination: { pageSize: 1000 },
      });

      const data = result.results.map((colegio: any) => ({
        id: colegio.id,
        colegio_nombre: colegio.colegio_nombre,
      }));

      ctx.body = {
        data,
        meta: { pagination: result.pagination },
      };
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },
}));
