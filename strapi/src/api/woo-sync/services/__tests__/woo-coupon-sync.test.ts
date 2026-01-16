import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooCouponSync from '../woo-coupon-sync';
import wooConfigService from '../woo-config';
import wooApiClient from '../woo-api-client';

// Mock dependencies
vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: vi.fn(),
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createCoupon: vi.fn(),
    updateCoupon: vi.fn(),
    deleteCoupon: vi.fn(),
  })),
}));

// Mock dependencies at module level
const mockGetWooConfig = vi.fn();
const mockCreateCoupon = vi.fn();
const mockUpdateCoupon = vi.fn();
const mockDeleteCoupon = vi.fn();

vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: mockGetWooConfig,
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createCoupon: mockCreateCoupon,
    updateCoupon: mockUpdateCoupon,
    deleteCoupon: mockDeleteCoupon,
  })),
}));

describe('Woo Coupon Sync Service', () => {
  let service: ReturnType<typeof wooCouponSync>;
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

  const mockWooCoupon = {
    id: 999,
    code: 'DESCUENTO10',
    discount_type: 'percent',
    amount: '10',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetWooConfig.mockReturnValue(mockConfig);
    mockCreateCoupon.mockResolvedValue(mockWooCoupon);
    mockUpdateCoupon.mockResolvedValue(mockWooCoupon);
    mockDeleteCoupon.mockResolvedValue({ deleted: true });
    
    service = wooCouponSync({ strapi: mockStrapi });
  });

  describe('normalizeDiscountType', () => {
    it('should normalize percent type', () => {
      expect(service.normalizeDiscountType('percent')).toBe('percent');
      expect(service.normalizeDiscountType('porcentaje')).toBe('percent');
      expect(service.normalizeDiscountType('percentage')).toBe('percent');
    });

    it('should normalize fixed_product type', () => {
      expect(service.normalizeDiscountType('fixed_product')).toBe('fixed_product');
      expect(service.normalizeDiscountType('producto_fijo')).toBe('fixed_product');
      expect(service.normalizeDiscountType('producto')).toBe('fixed_product');
    });

    it('should default to fixed_cart', () => {
      expect(service.normalizeDiscountType('fixed_cart')).toBe('fixed_cart');
      expect(service.normalizeDiscountType('fijo_carro')).toBe('fixed_cart');
      expect(service.normalizeDiscountType('fijo')).toBe('fixed_cart');
      expect(service.normalizeDiscountType(null)).toBe('fixed_cart');
      expect(service.normalizeDiscountType(undefined)).toBe('fixed_cart');
    });
  });

  describe('syncCoupon', () => {
    it('should create new coupon when no externalId exists', async () => {
      const woCupon = {
        id: 1,
        codigo: 'DESCUENTO10',
        tipo_cupon: 'percent',
        importe_cupon: 10,
        externalIds: {},
      };

      const result = await service.syncCoupon(woCupon, 'woo_moraleja');

      expect(result).toEqual(mockWooCoupon);
      expect(mockStrapi.entityService.update).toHaveBeenCalledWith(
        'api::wo-cupon.wo-cupon',
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            wooId: 999,
            externalIds: { woo_moraleja: 999 },
          }),
        })
      );
    });

    it('should update existing coupon when externalId exists', async () => {
      const woCupon = {
        id: 1,
        codigo: 'DESCUENTO10',
        wooId: 999,
        externalIds: { woo_moraleja: 999 },
      };

      const result = await service.syncCoupon(woCupon, 'woo_moraleja');

      expect(result).toEqual(mockWooCoupon);
    });

    it('should throw error if no codigo', async () => {
      const woCupon = {
        id: 1,
        tipo_cupon: 'percent',
      };

      await expect(service.syncCoupon(woCupon, 'woo_moraleja')).rejects.toThrow(
        'wo-cupon sin código'
      );
    });

    it('should handle producto_ids array', async () => {
      const woCupon = {
        id: 1,
        codigo: 'DESCUENTO10',
        tipo_cupon: 'fixed_product',
        importe_cupon: 5000,
        producto_ids: [123, 456],
        externalIds: {},
      };

      await service.syncCoupon(woCupon, 'woo_moraleja');

      expect(mockStrapi.entityService.update).toHaveBeenCalled();
    });
  });

  describe('deleteCoupon', () => {
    it('should delete coupon when wooId exists', async () => {
      const woCupon = {
        id: 1,
        wooId: 999,
        externalIds: { woo_moraleja: 999 },
      };

      await service.deleteCoupon(woCupon, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Cupón eliminado')
      );
    });

    it('should skip deletion if no wooId', async () => {
      const woCupon = {
        id: 1,
        externalIds: {},
      };

      await service.deleteCoupon(woCupon, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('No hay wooId')
      );
    });
  });
});
