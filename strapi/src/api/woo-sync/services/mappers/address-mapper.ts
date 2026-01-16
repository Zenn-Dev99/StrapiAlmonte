/**
 * Servicio de mapeo para Direcciones (Billing/Shipping) entre Strapi y WooCommerce
 */

export default ({ strapi }) => ({
  /**
   * Mapea datos de facturación de Strapi a formato WooCommerce
   */
  mapBillingToWoo(billing: any): any {
    if (!billing) return null;
    
    return {
      first_name: billing.first_name || billing.nombre || '',
      last_name: billing.last_name || billing.apellido || '',
      company: billing.company || billing.empresa || '',
      address_1: billing.address_1 || billing.direccion || billing.direccion_1 || '',
      address_2: billing.address_2 || billing.direccion_2 || '',
      city: billing.city || billing.ciudad || '',
      state: billing.state || billing.region || billing.provincia || '',
      postcode: billing.postcode || billing.codigo_postal || billing.postal_code || '',
      country: billing.country || 'CL',
      email: billing.email || '',
      phone: billing.phone || billing.telefono || '',
    };
  },

  /**
   * Mapea datos de envío de Strapi a formato WooCommerce
   */
  mapShippingToWoo(shipping: any): any {
    if (!shipping) return null;
    
    return {
      first_name: shipping.first_name || shipping.nombre || '',
      last_name: shipping.last_name || shipping.apellido || '',
      company: shipping.company || shipping.empresa || '',
      address_1: shipping.address_1 || shipping.direccion || shipping.direccion_1 || '',
      address_2: shipping.address_2 || shipping.direccion_2 || '',
      city: shipping.city || shipping.ciudad || '',
      state: shipping.state || shipping.region || shipping.provincia || '',
      postcode: shipping.postcode || shipping.codigo_postal || shipping.postal_code || '',
      country: shipping.country || 'CL',
    };
  },

  /**
   * Mapea datos de facturación de WooCommerce a formato Strapi
   */
  mapWooBillingToStrapi(wooBilling: any): any {
    if (!wooBilling) return null;
    
    return {
      first_name: wooBilling.first_name || '',
      last_name: wooBilling.last_name || '',
      company: wooBilling.company || '',
      address_1: wooBilling.address_1 || '',
      address_2: wooBilling.address_2 || '',
      city: wooBilling.city || '',
      state: wooBilling.state || '',
      postcode: wooBilling.postcode || '',
      country: wooBilling.country || 'CL',
      email: wooBilling.email || '',
      phone: wooBilling.phone || '',
    };
  },

  /**
   * Mapea datos de envío de WooCommerce a formato Strapi
   */
  mapWooShippingToStrapi(wooShipping: any): any {
    if (!wooShipping) return null;
    
    return {
      first_name: wooShipping.first_name || '',
      last_name: wooShipping.last_name || '',
      company: wooShipping.company || '',
      address_1: wooShipping.address_1 || '',
      address_2: wooShipping.address_2 || '',
      city: wooShipping.city || '',
      state: wooShipping.state || '',
      postcode: wooShipping.postcode || '',
      country: wooShipping.country || 'CL',
    };
  },

  /**
   * Normaliza direcciones asegurando que tengan el formato correcto
   */
  normalizeAddress(address: any, type: 'billing' | 'shipping' = 'billing'): any {
    if (!address) {
      return type === 'billing' 
        ? { country: 'CL' }
        : { country: 'CL' };
    }
    
    const normalized: any = {
      first_name: address.first_name || address.nombre || '',
      last_name: address.last_name || address.apellido || '',
      company: address.company || address.empresa || '',
      address_1: address.address_1 || address.direccion || address.direccion_1 || '',
      address_2: address.address_2 || address.direccion_2 || '',
      city: address.city || address.ciudad || '',
      state: address.state || address.region || address.provincia || '',
      postcode: address.postcode || address.codigo_postal || address.postal_code || '',
      country: address.country || 'CL',
    };
    
    if (type === 'billing') {
      normalized.email = address.email || '';
      normalized.phone = address.phone || address.telefono || '';
    }
    
    return normalized;
  },
});
