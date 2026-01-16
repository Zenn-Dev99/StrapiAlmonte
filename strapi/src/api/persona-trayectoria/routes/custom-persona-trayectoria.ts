export default {
  routes: [
    {
      method: 'GET',
      path: '/biblioteca/colegio-profesor/:id',
      handler: 'api::persona-trayectoria.persona-trayectoria.libraryCard',
      config: {
        policies: ['global::is-authenticated-or-api-token'],
      },
    },
  ],
};
