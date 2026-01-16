export default {
  routes: [
    {
      method: 'POST',
      path: '/woo-webhook/product/:platform',
      handler: 'woo-webhook.product',
      config: {
        auth: false, // Los webhooks de WooCommerce no usan autenticación Strapi (usar secret en producción)
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/customer/:platform',
      handler: 'woo-webhook.customer',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/coupon/:platform',
      handler: 'woo-webhook.coupon',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/order/:platform',
      handler: 'woo-webhook.order',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/import/:platform',
      handler: 'woo-webhook.import',
      config: {
        auth: false, // Usamos autenticación manual con Bearer token
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/sync-term/:platform',
      handler: 'woo-webhook.syncTerm',
      config: {
        auth: false, // Usamos autenticación manual con Bearer token
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/woo-webhook/sync-all/:platform',
      handler: 'woo-webhook.syncAll',
      config: {
        auth: false, // Usamos autenticación manual con Bearer token
        policies: ['global::is-authenticated-or-api-token'], // Usar política existente para validar tokens
      },
    },
  ],
};

