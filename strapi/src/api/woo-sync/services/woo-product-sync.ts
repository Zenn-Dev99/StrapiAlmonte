/**
 * Servicio de sincronización de productos (libros) a WooCommerce
 * Usa mappers y api-client para mantener la separación de responsabilidades
 */

import wooConfigService from './woo-config';
import wooApiClient from './woo-api-client';
import productMapper from './mappers/product-mapper';
import { createLogger } from './utils/logger';
import type { WooPlatform, StrapiLibro } from './types';

export default ({ strapi }) => {
  const configService = wooConfigService({ strapi });
  const apiClient = wooApiClient({ strapi });
  const mapper = productMapper({ strapi });
  const logger = createLogger(strapi);

  /**
   * Obtiene URL de imagen desde portada_libro
   */
  function getImageUrl(portadaLibro: any): string | null {
    if (!portadaLibro) return null;
    
    if (typeof portadaLibro === 'string') {
      return portadaLibro;
    }
    
    if (portadaLibro.url) {
      return portadaLibro.url;
    }
    
    if (portadaLibro.formats) {
      // Intentar obtener formato grande primero
      if (portadaLibro.formats.large?.url) {
        return portadaLibro.formats.large.url;
      }
      if (portadaLibro.formats.medium?.url) {
        return portadaLibro.formats.medium.url;
      }
      if (portadaLibro.formats.small?.url) {
        return portadaLibro.formats.small.url;
      }
    }
    
    return null;
  }

  /**
   * Sincroniza un producto (libro) de Strapi a WooCommerce
   */
  async function syncProduct(libro: StrapiLibro, platform: WooPlatform) {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    // Asegurar que el libro tiene las relaciones pobladas
    if (libro.id) {
      const libroCompleto = await strapi.entityService.findOne('api::libro.libro', libro.id, {
        populate: ['autor_relacion', 'editorial', 'marcas', 'etiquetas', 'categorias_producto'] as any,
      }) as any;
      if (libroCompleto) {
        if (!libro.autor_relacion) libro.autor_relacion = libroCompleto.autor_relacion;
        if (!libro.editorial) libro.editorial = libroCompleto.editorial;
        if (!libro.marcas) libro.marcas = libroCompleto.marcas;
        if (!libro.etiquetas) libro.etiquetas = libroCompleto.etiquetas;
        if (!libro.categorias_producto) libro.categorias_producto = libroCompleto.categorias_producto;
      }
    }

    // Usar mapper para construir el producto
    const wooProduct = await mapper.mapLibroToWooProduct(libro, platform);

    // Agregar imagen si existe
    const imageUrl = getImageUrl(libro.portada_libro || libro.imagen_portada);
    if (imageUrl) {
      wooProduct.images = [{
        src: imageUrl,
        alt: libro.nombre_libro || 'Portada del libro',
      }];
    }

    // Obtener externalId si existe
    const externalIds = libro.externalIds || {};
    const wooId = externalIds[platform];

    let result;
    if (wooId) {
      // Actualizar producto existente
      result = await apiClient.updateProduct(wooConfig, wooId, wooProduct);
      logger.info(`Producto actualizado`, {
        platform,
        entity: 'product',
        entityId: wooId,
        operation: 'update',
      });
    } else {
      // Crear nuevo producto
      result = await apiClient.createProduct(wooConfig, wooProduct);
      const newWooId = result.id;
      
      // Actualizar externalIds en Strapi
      const updatedExternalIds = { ...externalIds, [platform]: newWooId };
      await strapi.entityService.update('api::libro.libro', libro.id, {
        data: { externalIds: updatedExternalIds },
      });
      
      logger.info(`Producto creado`, {
        platform,
        entity: 'product',
        entityId: newWooId,
        operation: 'create',
      });
    }

    return result;
  }

  return {
    syncProduct,
    getImageUrl,
  };
};
