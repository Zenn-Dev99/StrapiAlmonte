export default {
  routes: [
    {
      method: 'GET',
      path: '/personas/list',
      handler: 'api::persona.persona.list',
      config: {
        policies: ['global::is-authenticated-or-api-token'],
      },
    },
  ],
};
