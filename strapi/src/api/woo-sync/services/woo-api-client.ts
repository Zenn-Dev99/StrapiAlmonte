/**
 * Cliente de API de WooCommerce
 * Maneja todas las operaciones HTTP con WooCommerce
 * Incluye retry logic, rate limiting, y cache
 */

import type { WooConfig } from './woo-config';
import type { WooProduct, WooCustomer, WooOrder, WooCoupon, WooAttribute, WooAttributeTerm } from './types';
import { WooApiError } from './types';
import { withRetry } from './utils/retry';
import { getRateLimiter } from './utils/rate-limiter';
import { attributeCache, termCache } from './utils/cache';
import { createLogger } from './utils/logger';

export default ({ strapi }) => {
  const logger = createLogger(strapi);

  /**
  /**
   * Crea la autenticación Basic Auth para WooCommerce
   */
  function createAuthHeader(config: WooConfig): string {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    return `Basic ${auth}`;
  }

  /**
   * Realiza una petición HTTP con retry y rate limiting
   */
  async function request(
    config: WooConfig,
    method: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<any> {
    // Obtener rate limiter para la plataforma (identificada por URL)
    const platform = config.url.includes('moraleja') ? 'woo_moraleja' : 'woo_escolar';
    const rateLimiter = getRateLimiter(platform);
    
    // Esperar slot disponible
    await rateLimiter.waitForSlot();

    // Construir URL
    const url = new URL(`${config.url}/wp-json/wc/v3/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Realizar petición con retry
    return withRetry(
      async () => {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: createAuthHeader(config),
          },
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url.toString(), options);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new WooApiError(
            `WooCommerce API error (${method} ${endpoint}): ${response.status} ${errorText}`,
            response.status,
            endpoint,
            errorText
          );
          throw error;
        }

        // Manejar 204 No Content
        if (response.status === 204) {
          return null;
        }

        return await response.json();
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        retryableStatusCodes: [429, 500, 502, 503, 504],
      },
      (error, attempt) => {
        logger.warn(`Retry attempt ${attempt} for ${method} ${endpoint}`, {
          platform,
          endpoint,
          attempt,
          error: error.message,
        });
      }
    );
  }

  /**
   * Realiza una petición GET a WooCommerce
   */
  async function get(config: WooConfig, endpoint: string, params?: Record<string, any>): Promise<any> {
    return request(config, 'GET', endpoint, undefined, params);
  }

  /**
   * Realiza una petición POST a WooCommerce
   */
  async function post(config: WooConfig, endpoint: string, data: any): Promise<any> {
    return request(config, 'POST', endpoint, data);
  }

  /**
   * Realiza una petición PUT a WooCommerce
   */
  async function put(config: WooConfig, endpoint: string, data: any): Promise<any> {
    return request(config, 'PUT', endpoint, data);
  }

  /**
   * Realiza una petición DELETE a WooCommerce
   */
  async function deleteRequest(config: WooConfig, endpoint: string, force: boolean = false): Promise<any> {
    const url = force ? `${endpoint}?force=true` : endpoint;
    try {
      return await request(config, 'DELETE', url);
    } catch (error) {
      // 404 significa que ya estaba eliminado, no es un error
      if (error instanceof WooApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // Métodos específicos para entidades comunes

  /**
   * Crea un producto en WooCommerce
   */
  async function createProduct(config: WooConfig, productData: WooProduct): Promise<WooProduct> {
    return post(config, 'products', productData);
  }

  /**
   * Actualiza un producto en WooCommerce
   */
  async function updateProduct(config: WooConfig, productId: number | string, productData: Partial<WooProduct>): Promise<WooProduct> {
    return put(config, `products/${productId}`, productData);
  }

  /**
   * Elimina un producto en WooCommerce
   */
  async function deleteProduct(config: WooConfig, productId: number | string): Promise<any> {
    return deleteRequest(config, `products/${productId}`, true);
  }

  /**
   * Crea un cliente en WooCommerce
   */
  async function createCustomer(config: WooConfig, customerData: WooCustomer): Promise<WooCustomer> {
    return post(config, 'customers', customerData);
  }

  /**
   * Actualiza un cliente en WooCommerce
   */
  async function updateCustomer(config: WooConfig, customerId: number | string, customerData: Partial<WooCustomer>): Promise<WooCustomer> {
    return put(config, `customers/${customerId}`, customerData);
  }

  /**
   * Elimina un cliente en WooCommerce
   */
  async function deleteCustomer(config: WooConfig, customerId: number | string): Promise<any> {
    return deleteRequest(config, `customers/${customerId}`, true);
  }

  /**
   * Crea un pedido en WooCommerce
   */
  async function createOrder(config: WooConfig, orderData: WooOrder): Promise<WooOrder> {
    return post(config, 'orders', orderData);
  }

  /**
   * Actualiza un pedido en WooCommerce
   */
  async function updateOrder(config: WooConfig, orderId: number | string, orderData: Partial<WooOrder>): Promise<WooOrder> {
    return put(config, `orders/${orderId}`, orderData);
  }

  /**
   * Elimina un pedido en WooCommerce
   */
  async function deleteOrder(config: WooConfig, orderId: number | string): Promise<any> {
    return deleteRequest(config, `orders/${orderId}`, true);
  }

  /**
   * Crea un cupón en WooCommerce
   */
  async function createCoupon(config: WooConfig, couponData: WooCoupon): Promise<WooCoupon> {
    return post(config, 'coupons', couponData);
  }

  /**
   * Actualiza un cupón en WooCommerce
   */
  async function updateCoupon(config: WooConfig, couponId: number | string, couponData: Partial<WooCoupon>): Promise<WooCoupon> {
    return put(config, `coupons/${couponId}`, couponData);
  }

  /**
   * Elimina un cupón en WooCommerce
   */
  async function deleteCoupon(config: WooConfig, couponId: number | string): Promise<any> {
    return deleteRequest(config, `coupons/${couponId}`, true);
  }

  /**
   * Obtiene o crea un atributo de producto (con cache)
   */
  async function getOrCreateAttribute(config: WooConfig, attributeName: string, slug: string): Promise<WooAttribute> {
    const cacheKey = `${config.url}:attribute:${slug}`;
    
    // Intentar obtener del cache
    const cached = attributeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Buscar atributo existente
      const attributes = await get(config, 'products/attributes', { search: attributeName });
      const existing = Array.isArray(attributes) 
        ? attributes.find((attr: WooAttribute) => 
            attr.name.toLowerCase() === attributeName.toLowerCase() || attr.slug === slug
          )
        : null;

      if (existing) {
        // Guardar en cache
        attributeCache.set(cacheKey, existing);
        return existing;
      }

      // Crear nuevo atributo
      const newAttribute = await post(config, 'products/attributes', {
        name: attributeName,
        slug: slug,
        type: 'select',
        order_by: 'name',
        has_archives: false,
      });

      // Guardar en cache
      attributeCache.set(cacheKey, newAttribute);
      return newAttribute;
    } catch (error) {
      logger.error(`Error obteniendo/creando atributo ${attributeName}`, error, {
        platform: config.url.includes('moraleja') ? 'woo_moraleja' : 'woo_escolar',
        entity: 'attribute',
        operation: 'getOrCreate',
      });
      throw error;
    }
  }

  /**
   * Obtiene o crea un término de atributo (con cache)
   * Mejora: Usa documentId de Strapi como slug para matching más preciso
   * @param strapiDocumentId - DocumentId de Strapi para usar como slug (opcional pero recomendado)
   */
  async function getOrCreateAttributeTerm(
    config: WooConfig,
    attributeId: number,
    termName: string,
    description?: string | null,
    strapiDocumentId?: string | null
  ): Promise<WooAttributeTerm> {
    // Usar documentId como clave de cache si está disponible, sino usar nombre normalizado
    const cacheKey = strapiDocumentId 
      ? `${config.url}:term:${attributeId}:${strapiDocumentId}`
      : `${config.url}:term:${attributeId}:${termName.toLowerCase()}`;
    
    // Intentar obtener del cache
    const cached = termCache.get(cacheKey);
    if (cached) {
      // Si hay descripción nueva, actualizar
      if (description !== null && description !== undefined && cached.description !== description) {
        const updated = await put(config, `products/attributes/${attributeId}/terms/${cached.id}`, {
          description: description,
        });
        termCache.set(cacheKey, updated);
        return updated;
      }
      return cached;
    }

    try {
      // Si tenemos documentId, buscar directamente por slug (más eficiente y preciso)
      if (strapiDocumentId) {
        const termsResponse = await get(config, `products/attributes/${attributeId}/terms`, { 
          slug: strapiDocumentId,
          per_page: 100,
        });
        
        const terms = Array.isArray(termsResponse) ? termsResponse : [];
        const existingBySlug = terms.find((term: WooAttributeTerm) => term.slug === strapiDocumentId);
        
        if (existingBySlug) {
          // Actualizar nombre y descripción si es necesario
          const needsUpdate = 
            existingBySlug.name !== termName ||
            (description !== null && description !== undefined && existingBySlug.description !== description);
          
          if (needsUpdate) {
            const updatePayload: Partial<WooAttributeTerm> = { name: termName };
            if (description !== null && description !== undefined) {
              updatePayload.description = description;
            }
            // IMPORTANTE: Mantener el slug para que no se regenere
            // WooCommerce tiene límite de 28 caracteres para slugs
            if (strapiDocumentId) {
              const slugToUse = String(strapiDocumentId).length <= 28 
                ? strapiDocumentId 
                : String(strapiDocumentId).substring(0, 28);
              updatePayload.slug = slugToUse;
            }
            const updated = await put(config, `products/attributes/${attributeId}/terms/${existingBySlug.id}`, updatePayload);
            termCache.set(cacheKey, updated);
            return updated;
          }
          
          termCache.set(cacheKey, existingBySlug);
          return existingBySlug;
        }
      }
      
      // Si no encontramos por slug, buscar TODOS los términos del atributo por nombre
      let allTerms: WooAttributeTerm[] = [];
      let page = 1;
      const perPage = 100;
      
      while (true) {
        const termsResponse = await get(config, `products/attributes/${attributeId}/terms`, { 
          page,
          per_page: perPage,
        });
        
        const terms = Array.isArray(termsResponse) ? termsResponse : [];
        if (terms.length === 0) break;
        
        allTerms = allTerms.concat(terms);
        
        // Si recibimos menos de perPage, es la última página
        if (terms.length < perPage) break;
        page++;
      }
      
      // Buscar término existente por nombre exacto (case-insensitive)
      const normalizedName = termName.toLowerCase().trim();
      const existing = allTerms.find((term: WooAttributeTerm) => 
        term.name.toLowerCase().trim() === normalizedName
      );

      if (existing) {
        // Si tenemos documentId pero el término existente no tiene ese slug, actualizarlo
        if (strapiDocumentId && existing.slug !== strapiDocumentId) {
          const updated = await put(config, `products/attributes/${attributeId}/terms/${existing.id}`, {
            name: termName,
            slug: strapiDocumentId,
            ...(description !== null && description !== undefined ? { description } : {}),
          });
          termCache.set(cacheKey, updated);
          return updated;
        }
        
        // Si hay múltiples términos con el mismo nombre, usar el primero y limpiar los duplicados
        const duplicates = allTerms.filter((term: WooAttributeTerm) => 
          term.name.toLowerCase().trim() === normalizedName && term.id !== existing.id
        );
        
        if (duplicates.length > 0) {
          logger.warn(`Encontrados ${duplicates.length} términos duplicados para "${termName}" en atributo ${attributeId}. Se usará el término ID ${existing.id}`);
          // Limpiar cache para forzar refresco después de limpiar duplicados
          for (const dup of duplicates) {
            termCache.delete(`${config.url}:term:${attributeId}:${dup.name.toLowerCase()}`);
            if (dup.slug) termCache.delete(`${config.url}:term:${attributeId}:${dup.slug}`);
          }
        }
        
        // Actualizar descripción si se proporciona y es diferente
        if (description !== null && description !== undefined && existing.description !== description) {
          const updated = await put(config, `products/attributes/${attributeId}/terms/${existing.id}`, {
            description: description,
            ...(strapiDocumentId && existing.slug !== strapiDocumentId ? { slug: strapiDocumentId } : {}),
          });
          termCache.set(cacheKey, updated);
          return updated;
        }
        termCache.set(cacheKey, existing);
        return existing;
      }

      // Crear nuevo término con slug = documentId si está disponible
      const termData: Partial<WooAttributeTerm> = {
        name: termName,
      };
      if (description) {
        termData.description = description;
      }
      if (strapiDocumentId) {
        termData.slug = strapiDocumentId;
      }

      const newTerm = await post(config, `products/attributes/${attributeId}/terms`, termData);
      termCache.set(cacheKey, newTerm);
      return newTerm;
    } catch (error) {
      logger.error(`Error obteniendo/creando término ${termName}`, error, {
        platform: config.url.includes('moraleja') ? 'woo_moraleja' : 'woo_escolar',
        entity: 'term',
        operation: 'getOrCreate',
        documentId: strapiDocumentId,
      });
      throw error;
    }
  }

  return {
    get,
    post,
    put,
    delete: deleteRequest,
    createProduct,
    updateProduct,
    deleteProduct,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createOrder,
    updateOrder,
    deleteOrder,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getOrCreateAttribute,
    getOrCreateAttributeTerm,
    createAuthHeader, // Exportado para testing
  };
};
