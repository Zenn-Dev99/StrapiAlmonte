export default {
  routes: [
    {
      method: 'GET',
      path: '/activity-logs/listar',
      handler: 'activity-log.listar',
      config: {
        auth: false,  // ← SIN autenticación
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/activity-logs/detalle/:id',
      handler: 'activity-log.detalle',
      config: {
        auth: false,  // ← SIN autenticación
        policies: [],
        middlewares: [],
      },
    },
  ],
};




