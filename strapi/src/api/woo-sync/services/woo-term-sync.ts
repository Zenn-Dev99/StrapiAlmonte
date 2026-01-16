/**
 * Servicio de sincronización de términos (atributos) a WooCommerce
 * Maneja la sincronización de autores, obras, editoriales, sellos, colecciones
 */

import wooConfigService from './woo-config';
import wooApiClient from './woo-api-client';

export default ({ strapi }) => {
  const configService = wooConfigService({ strapi });
  const apiClient = wooApiClient({ strapi });

  /**
   * Convierte blocks de Strapi a texto plano
   */
  function blocksToText(blocks: any[]): string | null {
    if (!blocks || !Array.isArray(blocks)) return null;
    
    return blocks
      .map((block: any) => {
        if (block.type === 'paragraph' && block.children) {
          return block.children
            .filter((child: any) => child.type === 'text')
            .map((child: any) => child.text)
            .join('');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Sincroniza un término a todas las plataformas configuradas
   */
  async function syncTermToAllPlatforms(
    attributeName: string,
    attributeSlug: string,
    termName: string,
    termDescription?: string | null
  ) {
    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = configService.getWooConfig(platform);
        if (!wooConfig) continue;

        const attribute = await apiClient.getOrCreateAttribute(wooConfig, attributeName, attributeSlug);
        if (!attribute || !attribute.id) {
          strapi.log.warn(`[woo-term-sync] No se pudo obtener atributo "${attributeName}" para ${platform}`);
          continue;
        }

        await apiClient.getOrCreateAttributeTerm(wooConfig, attribute.id, termName, termDescription);
        strapi.log.info(`[woo-term-sync] Término "${termName}" sincronizado a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-term-sync] Error sincronizando término "${termName}" a ${platform}:`, error);
      }
    }
  }

  return {
    /**
     * Sincroniza un autor a todas las plataformas
     */
    async syncAutor(autor: any) {
      if (!autor || !autor.nombre_completo_autor) {
        strapi.log.warn('[woo-term-sync] Intento de sincronizar autor sin nombre_completo_autor');
        return;
      }

      const termName = autor.nombre_completo_autor;
      const termDescription = blocksToText(autor.resegna);

      await syncTermToAllPlatforms('Autor', 'autor', termName, termDescription);
    },

    /**
     * Sincroniza una obra a todas las plataformas
     */
    async syncObra(obra: any) {
      if (!obra || !obra.nombre_obra) {
        strapi.log.warn('[woo-term-sync] Intento de sincronizar obra sin nombre_obra');
        return;
      }

      const termName = obra.nombre_obra;
      const termDescription = obra.descripcion || null;

      await syncTermToAllPlatforms('Obra', 'obra', termName, termDescription);
    },

    /**
     * Sincroniza una editorial a todas las plataformas
     */
    async syncEditorial(editorial: any) {
      if (!editorial || !editorial.nombre_editorial) {
        strapi.log.warn('[woo-term-sync] Intento de sincronizar editorial sin nombre_editorial');
        return;
      }

      const termName = editorial.nombre_editorial;

      await syncTermToAllPlatforms('Editorial', 'editorial', termName);
    },

    /**
     * Sincroniza un sello a todas las plataformas
     */
    async syncSello(sello: any) {
      if (!sello || !sello.nombre_sello) {
        strapi.log.warn('[woo-term-sync] Intento de sincronizar sello sin nombre_sello');
        return;
      }

      const termName = sello.nombre_sello;

      await syncTermToAllPlatforms('Sello', 'sello', termName);
    },

    /**
     * Sincroniza una colección a todas las plataformas
     */
    async syncColeccion(coleccion: any) {
      if (!coleccion || !coleccion.nombre_coleccion) {
        strapi.log.warn('[woo-term-sync] Intento de sincronizar colección sin nombre_coleccion');
        return;
      }

      const termName = coleccion.nombre_coleccion;

      await syncTermToAllPlatforms('Colección', 'coleccion', termName);
    },
  };
};
