'use strict';

/**
 * Ruta de debugging temporal para ver payloads RAW
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/pedidos/debug',
      handler: 'pedido.debug',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

