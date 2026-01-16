/**
 * Controlador personalizado para roles de users-permissions
 * Soluciona el error "Undefined attribute level operator id"
 * 
 * Este controlador extiende el controlador original de Strapi
 * y limpia cualquier filtro malformado antes de procesar.
 */

export default {
  async find(ctx: any) {
    // Limpiar filtros problemáticos antes de procesar
    const cleanFilters = (filters: any): any => {
      if (!filters || typeof filters !== 'object') {
        return filters;
      }
      
      // Si hay un filtro con 'id' que es un objeto con 'id' anidado, corregirlo
      if (filters.id && typeof filters.id === 'object' && filters.id.id !== undefined) {
        const idValue = filters.id.id || filters.id.$eq || filters.id.$in;
        if (idValue !== undefined) {
          return {
            ...filters,
            id: idValue,
          };
        }
      }
      
      // Recursivamente limpiar filtros anidados
      const cleaned: any = {};
      for (const [key, value] of Object.entries(filters)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          cleaned[key] = cleanFilters(value);
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    };
    
    // Limpiar filtros en query.filters
    if (ctx.query?.filters) {
      const originalFilters = JSON.stringify(ctx.query.filters);
      ctx.query.filters = cleanFilters(ctx.query.filters);
      if (originalFilters !== JSON.stringify(ctx.query.filters)) {
        strapi.log.warn('[users-permissions/role] Filtros limpiados');
      }
    }
    
    // También limpiar cualquier filtro directo en query
    if (ctx.query?.id && typeof ctx.query.id === 'object' && ctx.query.id.id !== undefined) {
      ctx.query.id = ctx.query.id.id || ctx.query.id.$eq || ctx.query.id.$in || ctx.query.id;
    }
    
    // Limpiar TODOS los parámetros de query que puedan tener estructuras anidadas problemáticas
    for (const [key, value] of Object.entries(ctx.query)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const cleaned = cleanFilters(value);
        if (JSON.stringify(value) !== JSON.stringify(cleaned)) {
          ctx.query[key] = cleaned;
        }
      }
    }
    
    try {
      // Parsear parámetros de paginación
      const query = { ...ctx.query };
      let page = 1;
      let pageSize = 25;
      
      if (query.pagination) {
        if (typeof query.pagination === 'object') {
          page = parseInt(String(query.pagination.page || '1'), 10);
          pageSize = parseInt(String(query.pagination.pageSize || '25'), 10);
        }
      }
      
      // Calcular start y limit
      const start = (page - 1) * pageSize;
      const limit = pageSize;
      
      // Usar findMany y count en lugar de findPage (más compatible con plugins)
      const [results, total] = await Promise.all([
        strapi.entityService.findMany('plugin::users-permissions.role', {
          start,
          limit,
          sort: query.sort || { id: 'asc' },
          filters: query.filters,
        }),
        strapi.entityService.count('plugin::users-permissions.role', {
          filters: query.filters,
        }),
      ]);
      
      // Calcular información de paginación
      const pageCount = Math.ceil(total / pageSize);
      const pagination = {
        page,
        pageSize,
        pageCount,
        total,
      };
      
      return {
        data: results || [],
        meta: {
          pagination,
        },
      };
    } catch (error: any) {
      // Si el error persiste, intentar sin filtros
      if (error.message && error.message.includes('Undefined attribute level operator id')) {
        strapi.log.warn('[users-permissions/role] Error persistente, intentando sin filtros');
        const cleanQuery: any = { ...ctx.query };
        delete cleanQuery.filters;
        delete cleanQuery.id;
        
        // Parsear paginación
        let page = 1;
        let pageSize = 25;
        if (cleanQuery.pagination && typeof cleanQuery.pagination === 'object') {
          page = parseInt(String(cleanQuery.pagination.page || '1'), 10);
          pageSize = parseInt(String(cleanQuery.pagination.pageSize || '25'), 10);
        }
        
        const start = (page - 1) * pageSize;
        const limit = pageSize;
        
        // Usar findMany y count sin filtros
        const [results, total] = await Promise.all([
          strapi.entityService.findMany('plugin::users-permissions.role', {
            start,
            limit,
            sort: cleanQuery.sort || { id: 'asc' },
          }),
          strapi.entityService.count('plugin::users-permissions.role', {}),
        ]);
        
        const pageCount = Math.ceil(total / pageSize);
        const pagination = {
          page,
          pageSize,
          pageCount,
          total,
        };
        
        return {
          data: results || [],
          meta: {
            pagination,
          },
        };
      }
      throw error;
    }
  },
};
