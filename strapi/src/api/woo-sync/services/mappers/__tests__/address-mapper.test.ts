import { describe, it, expect, beforeEach } from 'vitest';
import addressMapper from '../address-mapper';

describe('Address Mapper', () => {
  let mapper: ReturnType<typeof addressMapper>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  beforeEach(() => {
    mapper = addressMapper({ strapi: mockStrapi });
  });

  describe('mapBillingToWoo', () => {
    it('should map billing address to WooCommerce format', () => {
      const billing = {
        first_name: 'Juan',
        last_name: 'Pérez',
        company: 'Mi Empresa',
        address_1: 'Calle Principal 123',
        address_2: 'Depto 4B',
        city: 'Santiago',
        state: 'Región Metropolitana',
        postcode: '7500000',
        country: 'CL',
        email: 'juan@example.com',
        phone: '+56912345678',
      };

      const result = mapper.mapBillingToWoo(billing);

      expect(result).toEqual(billing);
    });

    it('should handle alternative field names', () => {
      const billing = {
        nombre: 'Juan',
        apellido: 'Pérez',
        empresa: 'Mi Empresa',
        direccion: 'Calle Principal 123',
        direccion_2: 'Depto 4B',
        ciudad: 'Santiago',
        region: 'Región Metropolitana',
        codigo_postal: '7500000',
        country: 'CL',
        email: 'juan@example.com',
        telefono: '+56912345678',
      };

      const result = mapper.mapBillingToWoo(billing);

      expect(result).toMatchObject({
        first_name: 'Juan',
        last_name: 'Pérez',
        company: 'Mi Empresa',
        address_1: 'Calle Principal 123',
        address_2: 'Depto 4B',
        city: 'Santiago',
        state: 'Región Metropolitana',
        postcode: '7500000',
        country: 'CL',
        email: 'juan@example.com',
        phone: '+56912345678',
      });
    });

    it('should return null for null input', () => {
      expect(mapper.mapBillingToWoo(null)).toBeNull();
      expect(mapper.mapBillingToWoo(undefined)).toBeNull();
    });

    it('should default country to CL', () => {
      const billing = {
        first_name: 'Juan',
        last_name: 'Pérez',
      };

      const result = mapper.mapBillingToWoo(billing);

      expect(result?.country).toBe('CL');
    });
  });

  describe('mapShippingToWoo', () => {
    it('should map shipping address to WooCommerce format', () => {
      const shipping = {
        first_name: 'María',
        last_name: 'González',
        company: 'Mi Empresa',
        address_1: 'Avenida Secundaria 456',
        address_2: 'Oficina 201',
        city: 'Valparaíso',
        state: 'Valparaíso',
        postcode: '2340000',
        country: 'CL',
      };

      const result = mapper.mapShippingToWoo(shipping);

      expect(result).toEqual(shipping);
    });

    it('should handle alternative field names', () => {
      const shipping = {
        nombre: 'María',
        apellido: 'González',
        direccion: 'Avenida Secundaria 456',
        ciudad: 'Valparaíso',
        region: 'Valparaíso',
        codigo_postal: '2340000',
      };

      const result = mapper.mapShippingToWoo(shipping);

      expect(result).toMatchObject({
        first_name: 'María',
        last_name: 'González',
        address_1: 'Avenida Secundaria 456',
        city: 'Valparaíso',
        state: 'Valparaíso',
        postcode: '2340000',
        country: 'CL',
      });
    });
  });

  describe('mapWooBillingToStrapi', () => {
    it('should map WooCommerce billing to Strapi format', () => {
      const wooBilling = {
        first_name: 'Juan',
        last_name: 'Pérez',
        company: 'Mi Empresa',
        address_1: 'Calle Principal 123',
        address_2: 'Depto 4B',
        city: 'Santiago',
        state: 'Región Metropolitana',
        postcode: '7500000',
        country: 'CL',
        email: 'juan@example.com',
        phone: '+56912345678',
      };

      const result = mapper.mapWooBillingToStrapi(wooBilling);

      expect(result).toEqual(wooBilling);
    });

    it('should default country to CL', () => {
      const wooBilling = {
        first_name: 'Juan',
        last_name: 'Pérez',
      };

      const result = mapper.mapWooBillingToStrapi(wooBilling);

      expect(result?.country).toBe('CL');
    });
  });

  describe('mapWooShippingToStrapi', () => {
    it('should map WooCommerce shipping to Strapi format', () => {
      const wooShipping = {
        first_name: 'María',
        last_name: 'González',
        company: 'Mi Empresa',
        address_1: 'Avenida Secundaria 456',
        address_2: 'Oficina 201',
        city: 'Valparaíso',
        state: 'Valparaíso',
        postcode: '2340000',
        country: 'CL',
      };

      const result = mapper.mapWooShippingToStrapi(wooShipping);

      expect(result).toEqual(wooShipping);
    });
  });

  describe('normalizeAddress', () => {
    it('should normalize billing address', () => {
      const address = {
        nombre: 'Juan',
        apellido: 'Pérez',
        direccion: 'Calle Principal 123',
        ciudad: 'Santiago',
      };

      const result = mapper.normalizeAddress(address, 'billing');

      expect(result).toMatchObject({
        first_name: 'Juan',
        last_name: 'Pérez',
        address_1: 'Calle Principal 123',
        city: 'Santiago',
        country: 'CL',
      });
    });

    it('should normalize shipping address', () => {
      const address = {
        nombre: 'María',
        apellido: 'González',
        direccion: 'Avenida Secundaria 456',
        ciudad: 'Valparaíso',
      };

      const result = mapper.normalizeAddress(address, 'shipping');

      expect(result).toMatchObject({
        first_name: 'María',
        last_name: 'González',
        address_1: 'Avenida Secundaria 456',
        city: 'Valparaíso',
        country: 'CL',
      });
    });

    it('should return default address for null input', () => {
      const result = mapper.normalizeAddress(null, 'billing');

      expect(result).toMatchObject({
        country: 'CL',
      });
    });
  });
});
