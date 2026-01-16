import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooCustomerSync from '../woo-customer-sync';
import wooConfigService from '../woo-config';
import wooApiClient from '../woo-api-client';
import customerMapper from '../mappers/customer-mapper';

// Mock dependencies
vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: vi.fn(),
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
  })),
}));

vi.mock('../mappers/customer-mapper', () => ({
  default: vi.fn(() => ({
    mapWoClienteToWooCustomer: vi.fn(),
  })),
}));

// Mock dependencies at module level
const mockGetWooConfig = vi.fn();
const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockDeleteCustomer = vi.fn();
const mockMapWoClienteToWooCustomer = vi.fn();

vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: mockGetWooConfig,
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createCustomer: mockCreateCustomer,
    updateCustomer: mockUpdateCustomer,
    deleteCustomer: mockDeleteCustomer,
  })),
}));

vi.mock('../mappers/customer-mapper', () => ({
  default: vi.fn(() => ({
    mapWoClienteToWooCustomer: mockMapWoClienteToWooCustomer,
  })),
}));

describe('Woo Customer Sync Service', () => {
  let service: ReturnType<typeof wooCustomerSync>;
  const mockStrapi = {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    entityService: {
      update: vi.fn(),
    },
  } as any;

  const mockConfig = {
    url: 'https://example.com',
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
  };

  const mockWooCustomer = {
    id: 789,
    email: 'test@example.com',
    first_name: 'Juan',
    last_name: 'Pérez',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetWooConfig.mockReturnValue(mockConfig);
    mockMapWoClienteToWooCustomer.mockReturnValue({
      email: 'test@example.com',
      first_name: 'Juan',
      last_name: 'Pérez',
    });
    mockCreateCustomer.mockResolvedValue(mockWooCustomer);
    mockUpdateCustomer.mockResolvedValue(mockWooCustomer);
    mockDeleteCustomer.mockResolvedValue({ deleted: true });
    
    service = wooCustomerSync({ strapi: mockStrapi });
  });

  describe('syncCustomer', () => {
    it('should create new customer when no externalId exists', async () => {
      const woCliente = {
        id: 1,
        correo_electronico: 'test@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        externalIds: {},
      };

      const result = await service.syncCustomer(woCliente, 'woo_moraleja');

      expect(result).toEqual(mockWooCustomer);
      expect(mockStrapi.entityService.update).toHaveBeenCalledWith(
        'api::wo-cliente.wo-cliente',
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            wooId: 789,
            externalIds: { woo_moraleja: 789 },
          }),
        })
      );
    });

    it('should update existing customer when externalId exists', async () => {
      const woCliente = {
        id: 1,
        correo_electronico: 'test@example.com',
        wooId: 789,
        externalIds: { woo_moraleja: 789 },
      };

      const result = await service.syncCustomer(woCliente, 'woo_moraleja');

      expect(result).toEqual(mockWooCustomer);
    });

    it('should throw error if no correo_electronico', async () => {
      const woCliente = {
        id: 1,
        nombre: 'Juan',
      };

      await expect(service.syncCustomer(woCliente, 'woo_moraleja')).rejects.toThrow(
        'wo-cliente sin correo_electronico'
      );
    });

    it('should throw error if config not found', async () => {
      const configService = wooConfigService({ strapi: mockStrapi });
      (configService.getWooConfig as any).mockReturnValue(null);

      const woCliente = {
        id: 1,
        correo_electronico: 'test@example.com',
      };

      await expect(service.syncCustomer(woCliente, 'woo_moraleja')).rejects.toThrow(
        'Configuración de WooCommerce no encontrada'
      );
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer when externalId exists', async () => {
      const woCliente = {
        id: 1,
        externalIds: { woo_moraleja: 789 },
      };

      await service.deleteCustomer(woCliente, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Cliente eliminado')
      );
    });

    it('should skip deletion if no externalId', async () => {
      const woCliente = {
        id: 1,
        externalIds: {},
      };

      await service.deleteCustomer(woCliente, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('No hay externalId')
      );
    });
  });
});
