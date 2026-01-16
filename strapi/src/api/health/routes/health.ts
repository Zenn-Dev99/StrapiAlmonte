export default {
  routes: [
    {
      method: 'GET',
      path: '/health/strapi',
      handler: 'health.index',
      config: {
        auth: false,
      },
    },
  ],
};
