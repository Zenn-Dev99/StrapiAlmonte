import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::sello.sello' as any, ({ strapi }) => ({
  async find(ctx: any) {
    const query = { ...ctx.query };
    
    let page = 1;
    let pageSize = 100;
    
    if (query.pagination) {
      if (typeof query.pagination === 'object') {
        page = parseInt(String(query.pagination.page || '1'), 10);
        pageSize = parseInt(String(query.pagination.pageSize || '100'), 10);
      }
    }
    
    const start = (page - 1) * pageSize;
    const limit = pageSize;
    
    const [results, total] = await Promise.all([
      strapi.entityService.findMany('api::sello.sello', {
        start,
        limit,
        sort: query.sort || { id: 'asc' },
        populate: query.populate || '*',
        filters: query.filters,
      }),
      strapi.entityService.count('api::sello.sello', {
        filters: query.filters,
      }),
    ]);
    
    const pageCount = Math.ceil(total / pageSize);
    const pagination = {
      page,
      pageSize,
      pageCount,
      total,
    };
    
    if (!results || results.length === 0) {
      return {
        data: [],
        meta: {
          pagination,
        },
      };
    }
    
    const formattedResults = results.map((sello: any) => {
      const formatted = { ...sello };
      
      if (formatted.id_sello === null || formatted.id_sello === undefined) {
        delete formatted.id_sello;
      }
      
      if (formatted.attributes && (formatted.attributes.id_sello === null || formatted.attributes.id_sello === undefined)) {
        delete formatted.attributes.id_sello;
      }
      
      return formatted;
    });
    
    return {
      data: formattedResults,
      meta: {
        pagination,
      },
    };
  },
}));
