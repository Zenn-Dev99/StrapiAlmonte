import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::editorial.editorial' as any, ({ strapi }) => ({
  async find(ctx: any) {
    // Si se está ordenando por id_editorial, necesitamos ordenar numéricamente
    const sort = ctx.query?.sort;
    const sortStr = Array.isArray(sort) ? sort[0] : sort;
    const sortStrLower = String(sortStr || '').toLowerCase();
    const isSortingByIdEditorial = sortStr && (
      sortStrLower === 'id_editorial:asc' || 
      sortStrLower === 'id_editorial:desc' ||
      sortStrLower.startsWith('id_editorial:')
    );

    // Debug: log para verificar que el controlador se está ejecutando
    if (isSortingByIdEditorial) {
      strapi.log.info(`[editorial] Ordenando numéricamente por id_editorial: ${sortStr}`);
    }

    if (isSortingByIdEditorial) {
      // Obtener todas las editoriales sin ordenar (necesitamos todos para ordenar numéricamente)
      const queryWithoutSort = { ...ctx.query };
      delete queryWithoutSort.sort;
      
      // Obtener todos los datos
      const allData = await strapi.entityService.findMany('api::editorial.editorial', {
        ...queryWithoutSort,
        pagination: false,
      });

      // Ordenar numéricamente
      const sortDirection = sortStrLower.includes('desc') ? 'desc' : 'asc';
      const sortedData = allData.sort((a: any, b: any) => {
        const idA = parseInt(a.id_editorial || '0', 10) || 0;
        const idB = parseInt(b.id_editorial || '0', 10) || 0;
        
        if (sortDirection === 'desc') {
          return idB - idA;
        } else {
          return idA - idB;
        }
      });

      // Aplicar paginación manual
      const page = ctx.query?.pagination?.page || 1;
      const pageSize = ctx.query?.pagination?.pageSize || 25;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = sortedData.slice(start, end);

      // Formatear la respuesta como Strapi espera
      return {
        data: paginatedData,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.ceil(sortedData.length / pageSize),
            total: sortedData.length,
          },
        },
      };
    }

    // Si no se ordena por id_editorial, usar el comportamiento por defecto
    const { results, pagination } = await strapi.entityService.findPage('api::editorial.editorial', ctx.query);
    
    return {
      data: results,
      meta: {
        pagination,
      },
    };
  },
}));
