export default {
  routes: [
    {
      method: 'POST',
      path: '/presence/heartbeat',
      handler: 'heartbeat.index',
      config: {
        auth: false,
      },
    },
  ],
};
