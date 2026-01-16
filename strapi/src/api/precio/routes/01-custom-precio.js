'use strict';

/**
 * custom precio router
 * Prefijo "01-" asegura que esta ruta se cargue antes que otras
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/precios/crear',
      handler: 'precio.crear',
      config: {
        auth: false, // Permitir acceso sin autenticación
        policies: [],
        middlewares: [],
      },
    },
  ],
};

