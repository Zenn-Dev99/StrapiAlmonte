/**
 * Servicio de Mappers para WooCommerce
 * 
 * Este servicio expone todos los mappers disponibles para facilitar su uso
 * 
 * Uso:
 *   const mappers = strapi.service('api::woo-sync.mappers-service');
 *   const wooProduct = await mappers.product.mapLibroToWooProduct(libro, 'woo_moraleja');
 */

import mappers from './mappers';

// Exportar directamente como función que recibe strapi
export default mappers;
