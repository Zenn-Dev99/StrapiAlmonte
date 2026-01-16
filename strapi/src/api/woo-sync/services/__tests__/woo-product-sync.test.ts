import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooProductSync from '../woo-product-sync';
import wooConfigService from '../woo-config';
import wooApiClient from '../woo-api-client';
import productMapper from '../mappers/product-mapper';

// Mock dependencies
vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: vi.fn(),
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  })),
}));

vi.mock('../mappers/product-mapper', () => ({
  default: vi.fn(() => ({
    mapLibroToWooProduct: vi.fn(),
  })),
}));

// Mock dependencies at module level
const mockGetWooConfig = vi.fn();
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockMapLibroToWooProduct = vi.fn();

vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: mockGetWooConfig,
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createProduct: mockCreateProduct,
    updateProduct: mockUpdateProduct,
  })),
}));

vi.mock('../mappers/product-mapper', () => ({
  default: vi.fn(() => ({
    mapLibroToWooProduct: mockMapLibroToWooProduct,
  })),
}));

describe('Woo Product Sync Service', () => {
  let service: ReturnType<typeof wooProductSync>;
  const mockStrapi = {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    entityService: {
      findOne: vi.fn(),
      update: vi.fn(),
    },
  } as any;

  const mockConfig = {
    url: 'https://example.com',
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
  };

  const mockWooProduct = {
    id: 123,
    name: 'Test Book',
    sku: '978-1234567890',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetWooConfig.mockReturnValue(mockConfig);
    mockMapLibroToWooProduct.mockResolvedValue({
      name: 'Test Book',
      sku: '978-1234567890',
    });
    mockCreateProduct.mockResolvedValue(mockWooProduct);
    mockUpdateProduct.mockResolvedValue(mockWooProduct);
    
    service = wooProductSync({ strapi: mockStrapi });
  });

  describe('syncProduct', () => {
    it('should create new product when no externalId exists', async () => {
      const libro = {
        id: 1,
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        externalIds: {},
      };

      const result = await service.syncProduct(libro, 'woo_moraleja');

      expect(result).toEqual(mockWooProduct);
      expect(mockStrapi.entityService.update).toHaveBeenCalledWith(
        'api::libro.libro',
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            externalIds: { woo_moraleja: 123 },
          }),
        })
      );
    });

    it('should update existing product when externalId exists', async () => {
      const libro = {
        id: 1,
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        externalIds: { woo_moraleja: 123 },
      };

      const result = await service.syncProduct(libro, 'woo_moraleja');

      expect(result).toEqual(mockWooProduct);
      expect(mockStrapi.entityService.update).not.toHaveBeenCalled();
    });

    it('should populate libro relations if id exists', async () => {
      const libro = {
        id: 1,
        nombre_libro: 'Test Book',
        externalIds: {},
      };

      mockStrapi.entityService.findOne.mockResolvedValue({
        id: 1,
        autor_relacion: { id: 1 },
        editorial: { id: 1 },
      });

      await service.syncProduct(libro, 'woo_moraleja');

      expect(mockStrapi.entityService.findOne).toHaveBeenCalledWith(
        'api::libro.libro',
        1,
        expect.any(Object)
      );
    });

    it('should throw error if config not found', async () => {
      const configService = wooConfigService({ strapi: mockStrapi });
      (configService.getWooConfig as any).mockReturnValue(null);

      const libro = {
        id: 1,
        nombre_libro: 'Test Book',
      };

      await expect(service.syncProduct(libro, 'woo_moraleja')).rejects.toThrow(
        'Configuración de WooCommerce no encontrada'
      );
    });
  });

  describe('getImageUrl', () => {
    it('should return url from string', () => {
      const result = service.getImageUrl('https://example.com/image.jpg');
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('should return url from object with url property', () => {
      const result = service.getImageUrl({ url: 'https://example.com/image.jpg' });
      expect(result).toBe('https://example.com/image.jpg');
    });

    it('should return null for null input', () => {
      expect(service.getImageUrl(null)).toBeNull();
    });
  });
});
