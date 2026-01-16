import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::editorial.editorial' as any, ({ strapi }) => ({
  async findMany(params: any) {
    // Si se está ordenando por id_editorial, necesitamos ordenar numéricamente
    const sort = params?.sort;
    const sortStr = Array.isArray(sort) ? sort[0] : sort;
    const sortStrLower = String(sortStr || '').toLowerCase();
    const isSortingByIdEditorial = sortStr && sortStrLower.startsWith('id_editorial:');

    if (isSortingByIdEditorial) {
      // Obtener todas las editoriales sin ordenar
      const paramsWithoutSort = { ...params };
      delete paramsWithoutSort.sort;
      
      const allData = await strapi.entityService.findMany('api::editorial.editorial', {
        ...paramsWithoutSort,
        pagination: false,
      });

      // Ordenar numéricamente
      const sortDirection = sortStrLower.includes('desc') ? 'desc' : 'asc';
      const sortedData = allData.sort((a: any, b: any) => {
        const idA = parseInt(a.id_editorial || '0', 10) || 0;
        const idB = parseInt(b.id_editorial || '0', 10) || 0;
        
        return sortDirection === 'desc' ? idB - idA : idA - idB;
      });

      return sortedData;
    }

    // Si no se ordena por id_editorial, usar el comportamiento por defecto
    return await strapi.entityService.findMany('api::editorial.editorial', params);
  },

  async findPage(params: any) {
    // Si se está ordenando por id_editorial, necesitamos ordenar numéricamente
    const sort = params?.sort;
    const sortStr = Array.isArray(sort) ? sort[0] : sort;
    const sortStrLower = String(sortStr || '').toLowerCase();
    const isSortingByIdEditorial = sortStr && sortStrLower.startsWith('id_editorial:');

    if (isSortingByIdEditorial) {
      // Obtener todas las editoriales sin ordenar
      const paramsWithoutSort = { ...params };
      delete paramsWithoutSort.sort;
      
      const allData = await strapi.entityService.findMany('api::editorial.editorial', {
        ...paramsWithoutSort,
        pagination: false,
      });

      // Ordenar numéricamente
      const sortDirection = sortStrLower.includes('desc') ? 'desc' : 'asc';
      const sortedData = allData.sort((a: any, b: any) => {
        const idA = parseInt(a.id_editorial || '0', 10) || 0;
        const idB = parseInt(b.id_editorial || '0', 10) || 0;
        
        return sortDirection === 'desc' ? idB - idA : idA - idB;
      });

      // Aplicar paginación manual
      const page = params?.pagination?.page || 1;
      const pageSize = params?.pagination?.pageSize || 25;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = sortedData.slice(start, end);

      return {
        results: paginatedData,
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(sortedData.length / pageSize),
          total: sortedData.length,
        },
      };
    }

    // Si no se ordena por id_editorial, usar el comportamiento por defecto
    return await strapi.entityService.findPage('api::editorial.editorial', params);
  },
}));
