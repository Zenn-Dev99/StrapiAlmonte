/**
 * Servicio de Mappers para WooCommerce
 * 
 * Exporta todos los mappers disponibles para facilitar su uso
 * 
 * Uso:
 *   const mappers = strapi.service('api::woo-sync.mappers');
 *   const wooProduct = await mappers.product.mapLibroToWooProduct(libro, 'woo_moraleja');
 *   const wooCoupon = await mappers.coupon.mapWoCuponToWooCoupon(woCupon, 'woo_moraleja');
 */

import productMapper from './product-mapper';
import orderMapper from './order-mapper';
import lineItemMapper from './line-item-mapper';
import addressMapper from './address-mapper';
import customerMapper from './customer-mapper';
import couponMapper from './coupon-mapper';

export default ({ strapi }) => ({
  product: productMapper({ strapi }),
  order: orderMapper({ strapi }),
  lineItem: lineItemMapper({ strapi }),
  address: addressMapper({ strapi }),
  customer: customerMapper({ strapi }),
  coupon: couponMapper({ strapi }),
});
