import { describe, it, expect, beforeEach, vi } from 'vitest';
import customerMapper from '../customer-mapper';
import addressMapper from '../address-mapper';

// Mock address mapper
vi.mock('../address-mapper', () => ({
  default: vi.fn(() => ({
    mapBillingToWoo: vi.fn((billing) => ({
      ...billing,
      mapped: true,
    })),
    mapShippingToWoo: vi.fn((shipping) => ({
      ...shipping,
      mapped: true,
    })),
    mapWooBillingToStrapi: vi.fn((billing) => ({
      ...billing,
      mapped: true,
    })),
    mapWooShippingToStrapi: vi.fn((shipping) => ({
      ...shipping,
      mapped: true,
    })),
  })),
}));

describe('Customer Mapper', () => {
  let mapper: ReturnType<typeof customerMapper>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mapper = customerMapper({ strapi: mockStrapi });
  });

  describe('mapWoClienteToWooCustomer', () => {
    it('should map wo-cliente to WooCommerce customer', () => {
      const woCliente = {
        correo_electronico: 'juan@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        billing: {
          address_1: 'Calle Principal 123',
          city: 'Santiago',
        },
        shipping: {
          address_1: 'Avenida Secundaria 456',
          city: 'Valparaíso',
        },
      };

      const result = mapper.mapWoClienteToWooCustomer(woCliente, 'woo_moraleja');

      expect(result).toMatchObject({
        email: 'juan@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
      });
      expect(result.billing.mapped).toBe(true);
      expect(result.shipping.mapped).toBe(true);
    });

    it('should handle wo-cliente without names', () => {
      const woCliente = {
        correo_electronico: 'test@example.com',
      };

      const result = mapper.mapWoClienteToWooCustomer(woCliente, 'woo_moraleja');

      expect(result).toMatchObject({
        email: 'test@example.com',
      });
      expect(result.first_name).toBeUndefined();
      expect(result.last_name).toBeUndefined();
    });

    it('should handle wo-cliente without addresses', () => {
      const woCliente = {
        correo_electronico: 'test@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      const result = mapper.mapWoClienteToWooCustomer(woCliente, 'woo_moraleja');

      expect(result.billing).toBeUndefined();
      expect(result.shipping).toBeUndefined();
    });
  });

  describe('mapWooCustomerToWoCliente', () => {
    it('should map WooCommerce customer to wo-cliente', () => {
      const wooCustomer = {
        id: 789,
        email: 'juan@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
        billing: {
          address_1: 'Calle Principal 123',
          city: 'Santiago',
        },
        shipping: {
          address_1: 'Avenida Secundaria 456',
          city: 'Valparaíso',
        },
      };

      const result = mapper.mapWooCustomerToWoCliente(wooCustomer, 'woo_moraleja');

      expect(result).toMatchObject({
        correo_electronico: 'juan@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        originPlatform: 'woo_moraleja',
        externalIds: {
          woo_moraleja: 789,
        },
        wooId: 789,
      });
      expect(result.billing.mapped).toBe(true);
      expect(result.shipping.mapped).toBe(true);
      expect(result.rawWooData).toEqual(wooCustomer);
    });

    it('should handle customer without id', () => {
      const wooCustomer = {
        email: 'test@example.com',
        first_name: 'Juan',
      };

      const result = mapper.mapWooCustomerToWoCliente(wooCustomer, 'woo_moraleja');

      expect(result.externalIds).toBeUndefined();
      expect(result.wooId).toBeUndefined();
    });

    it('should handle customer without addresses', () => {
      const wooCustomer = {
        id: 789,
        email: 'test@example.com',
        first_name: 'Juan',
        last_name: 'Pérez',
      };

      const result = mapper.mapWooCustomerToWoCliente(wooCustomer, 'woo_moraleja');

      expect(result.billing).toBeUndefined();
      expect(result.shipping).toBeUndefined();
    });
  });
});
