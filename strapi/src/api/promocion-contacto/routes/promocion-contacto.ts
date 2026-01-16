import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::promocion-contacto.promocion-contacto', {
  config: {
    find: {
      policies: ['global::is-authenticated-or-api-token'],
    },
    findOne: {
      policies: ['global::is-authenticated-or-api-token'],
    },
    create: {
      policies: ['global::is-authenticated-or-api-token'],
    },
    update: {
      policies: ['global::is-authenticated-or-api-token'],
    },
    delete: {
      policies: ['global::is-authenticated-or-api-token'],
    },
  },
});
