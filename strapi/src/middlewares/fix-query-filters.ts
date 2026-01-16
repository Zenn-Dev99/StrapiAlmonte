/**
 * Middleware para corregir filtros de consulta malformados
 * Soluciona el error "Undefined attribute level operator id"
 * que ocurre cuando hay estructuras anidadas incorrectas en los filtros
 */

export default (config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    // NO procesar rutas del admin (archivos estáticos, API del admin, etc.)
    // Solo procesar rutas de la API pública
    const url = ctx.url || ctx.request?.url || '';
    
    if (!url || 
        url.startsWith('/admin/') || 
        url.includes('/users-permissions/roles') ||
        url.endsWith('.js') ||
        url.endsWith('.css') ||
        url.endsWith('.map') ||
        url.endsWith('.woff') ||
        url.endsWith('.woff2') ||
        url.endsWith('.ttf') ||
        url.endsWith('.eot') ||
        url.endsWith('.svg') ||
        url.endsWith('.png') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.gif') ||
        url.endsWith('.ico') ||
        url.startsWith('/_next/') ||
        url.startsWith('/static/')) {
      return await next();
    }
    
    // Solo procesar si hay query parameters
    if (ctx.query) {
      try {
        const cleanFilters = (filters: any): any => {
          if (!filters || typeof filters !== 'object') {
            return filters;
          }
          
          // Si hay un filtro con 'id' que es un objeto con 'id' anidado, corregirlo
          if (filters.id && typeof filters.id === 'object' && filters.id.id !== undefined) {
            // Esto es una estructura incorrecta: { id: { id: value } }
            // Convertir a la estructura correcta: { id: value }
            const idValue = filters.id.id || filters.id.$eq || filters.id.$in;
            if (idValue !== undefined) {
              return {
                ...filters,
                id: idValue,
              };
            }
          }
          
          // También verificar si hay otros campos con estructuras anidadas problemáticas
          // Buscar cualquier campo que tenga un objeto con 'id' anidado
          const cleaned: any = {};
          for (const [key, value] of Object.entries(filters)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Si el valor es un objeto con 'id' anidado, extraerlo
              if ((value as any).id !== undefined && typeof (value as any).id === 'object' && (value as any).id.id !== undefined) {
                cleaned[key] = (value as any).id.id || (value as any).id.$eq || (value as any).id.$in || value;
              } else {
                cleaned[key] = cleanFilters(value);
              }
            } else {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };
        
        // Limpiar filtros en query.filters
        if (ctx.query.filters) {
          ctx.query.filters = cleanFilters(ctx.query.filters);
        }
        
        // También limpiar filtros en ctx.query directamente si existen
        if (ctx.query.id && typeof ctx.query.id === 'object' && ctx.query.id.id !== undefined) {
          ctx.query.id = ctx.query.id.id || ctx.query.id.$eq || ctx.query.id.$in || ctx.query.id;
        }
        
        // Limpiar cualquier otro parámetro de query que pueda tener estructuras anidadas
        for (const [key, value] of Object.entries(ctx.query)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value) && (value as any).id !== undefined) {
            const nestedId = (value as any).id;
            if (typeof nestedId === 'object' && nestedId.id !== undefined) {
              ctx.query[key] = nestedId.id || nestedId.$eq || nestedId.$in || nestedId;
            }
          }
        }
      } catch (error: any) {
        // Si hay un error en el middleware, solo loguearlo pero continuar
        strapi.log.warn('[fix-query-filters] Error procesando query (continuando sin modificar):', error.message);
      }
    }
    
    // SIEMPRE llamar a next() una sola vez al final
    await next();
  };
};
