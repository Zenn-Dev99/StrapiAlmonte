import { factories } from '@strapi/strapi';

const defaultRouter = factories.createCoreRouter('api::colaborador.colaborador');

export default {
  get routes() {
    // Obtener las rutas del router core (debe hacerse dentro del getter, no en tiempo de carga)
    const defaultRoutes = typeof defaultRouter.routes === 'function' 
      ? defaultRouter.routes() 
      : defaultRouter.routes;
    
    return [
      ...(Array.isArray(defaultRoutes) ? defaultRoutes : []),
      {
        method: 'POST',
        path: '/colaboradores/login',
        handler: 'api::colaborador.colaborador.login',
        config: {
          auth: false, // Endpoint público para login
        },
      },
    ];
  },
};

