export default {
  routes: [
    {
      method: 'POST',
      path: '/personas-mira/auth/login',
      handler: 'persona-mira.login',
      config: {
        auth: false, // Endpoint público para login
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/personas-mira/auth/reset-password',
      handler: 'persona-mira.resetPassword',
      config: {
        auth: false, // Endpoint público para reset (solo para desarrollo/testing)
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/personas-mira/auth/me',
      handler: 'persona-mira.getCurrentUser',
      config: {
        auth: false, // Endpoint público (usa ID del query param)
        policies: [],
        middlewares: [],
      },
    },
  ],
};



