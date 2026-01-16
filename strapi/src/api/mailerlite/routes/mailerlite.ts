export default {
  routes: [
    {
      method: 'POST',
      path: '/mailerlite/subscribers',
      handler: 'mailerlite.addSubscriber',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/mailerlite/subscribers/:email',
      handler: 'mailerlite.getSubscriber',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/mailerlite/subscribers/:email',
      handler: 'mailerlite.removeSubscriber',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/mailerlite/sync-persona/:id',
      handler: 'mailerlite.syncPersona',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/mailerlite/groups',
      handler: 'mailerlite.getGroups',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

