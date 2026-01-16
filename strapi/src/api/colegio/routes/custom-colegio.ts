export default {
  routes: [
    {
      method: 'GET',
      path: '/colegios/list',
      handler: 'api::colegio.colegio.list',
      config: {
        policies: ['global::is-authenticated-or-api-token'],
      },
    },
    {
      method: 'GET',
      path: '/colegios/public-list',
      handler: 'api::colegio.colegio.publicList',
      config: {
        auth: false, // Endpoint público, no requiere autenticación
      },
    },
  ],
};
