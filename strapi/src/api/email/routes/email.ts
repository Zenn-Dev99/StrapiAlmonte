export default {
  routes: [
    {
      method: 'POST',
      path: '/emails/send',
      handler: 'email.send',
      config: { policies: ['global::is-authenticated-or-api-token'] },
    },
  ],
};
