'use strict';

/**
 * proveedor service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::proveedor.proveedor');

