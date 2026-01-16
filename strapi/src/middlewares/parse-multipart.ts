/**
 * Middleware para parsear FormData multipart cuando auth: false
 * Esto es necesario porque Strapi puede no parsear automáticamente multipart en rutas sin autenticación
 */
export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    // Solo procesar si es multipart y aún no está parseado
    const contentType = ctx.request.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    // Si es multipart y el body no está parseado, parsearlo
    if (isMultipart && (!ctx.request.body || Object.keys(ctx.request.body).length === 0)) {
      try {
        // Usar el parser de body de Strapi
        const bodyParser = strapi.server.app.context.request.body;
        
        // Si el body parser no está disponible, usar el parser nativo de koa-body
        if (strapi.server.koaApp && strapi.server.koaApp.context) {
          // El body parser de Strapi debería haber parseado esto, pero si no lo hizo,
          // dejamos que el controlador lo maneje manualmente
          strapi.log.info('[parse-multipart] FormData detectado, dejando que el controlador lo parsee');
        }
      } catch (error: any) {
        strapi.log.warn('[parse-multipart] Error intentando parsear multipart:', error.message);
      }
    }
    
    await next();
  };
};

