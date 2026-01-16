import { describe, it, expect, beforeEach, vi } from 'vitest';
import lineItemMapper from '../line-item-mapper';

describe('Line Item Mapper', () => {
  let mapper: ReturnType<typeof lineItemMapper>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: vi.fn(),
      error: vi.fn(),
    },
    entityService: {
      findOne: vi.fn(),
      findMany: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mapper = lineItemMapper({ strapi: mockStrapi });
  });

  describe('mapItemToWooLineItem', () => {
    it('should map item with producto_id', async () => {
      const item = {
        producto_id: 123,
        nombre: 'Test Book',
        sku: '978-1234567890',
        cantidad: 2,
        precio_unitario: 10000,
        total: 20000,
      };

      const result = await mapper.mapItemToWooLineItem(item, 'woo_moraleja');

      expect(result).toMatchObject({
        product_id: 123,
        quantity: 2,
        name: 'Test Book',
        sku: '978-1234567890',
        price: '10000',
        total: '20000',
      });
    });

    it('should get product_id from libro relation', async () => {
      const item = {
        libro: { id: 1 },
        nombre: 'Test Book',
        cantidad: 1,
      };

      mockStrapi.entityService.findOne.mockResolvedValue({
        id: 1,
        externalIds: {
          woo_moraleja: 456,
        },
      });

      const result = await mapper.mapItemToWooLineItem(item, 'woo_moraleja');

      expect(result?.product_id).toBe(456);
      expect(mockStrapi.entityService.findOne).toHaveBeenCalledWith(
        'api::libro.libro',
        1
      );
    });

    it('should get product_id from libro by SKU', async () => {
      const item = {
        sku: '978-1234567890',
        nombre: 'Test Book',
        cantidad: 1,
      };

      mockStrapi.entityService.findMany.mockResolvedValue([
        {
          id: 1,
          isbn_libro: '978-1234567890',
          externalIds: {
            woo_moraleja: 789,
          },
        },
      ]);

      const result = await mapper.mapItemToWooLineItem(item, 'woo_moraleja');

      expect(result?.product_id).toBe(789);
      expect(mockStrapi.entityService.findMany).toHaveBeenCalledWith(
        'api::libro.libro',
        {
          filters: { isbn_libro: '978-1234567890' },
        }
      );
    });

    it('should return null if no valid product_id found', async () => {
      const item = {
        nombre: 'Test Book',
        cantidad: 1,
      };

      const result = await mapper.mapItemToWooLineItem(item, 'woo_moraleja');

      expect(result).toBeNull();
      expect(mockStrapi.log.error).toHaveBeenCalled();
    });

    it('should handle libro as object with documentId', async () => {
      const item = {
        libro: { documentId: 2 },
        nombre: 'Test Book',
        cantidad: 1,
      };

      mockStrapi.entityService.findOne.mockResolvedValue({
        id: 2,
        externalIds: {
          woo_moraleja: 999,
        },
      });

      const result = await mapper.mapItemToWooLineItem(item, 'woo_moraleja');

      expect(result?.product_id).toBe(999);
    });
  });

  describe('mapItemsToWooLineItems', () => {
    it('should map multiple items', async () => {
      const items = [
        {
          producto_id: 123,
          nombre: 'Book 1',
          cantidad: 1,
        },
        {
          producto_id: 456,
          nombre: 'Book 2',
          cantidad: 2,
        },
      ];

      const result = await mapper.mapItemsToWooLineItems(items, 'woo_moraleja');

      expect(result).toHaveLength(2);
      expect(result[0].product_id).toBe(123);
      expect(result[1].product_id).toBe(456);
    });

    it('should filter out null items', async () => {
      const items = [
        {
          producto_id: 123,
          nombre: 'Book 1',
          cantidad: 1,
        },
        {
          nombre: 'Book 2 without product_id',
          cantidad: 1,
        },
      ];

      const result = await mapper.mapItemsToWooLineItems(items, 'woo_moraleja');

      expect(result).toHaveLength(1);
      expect(result[0].product_id).toBe(123);
    });
  });

  describe('mapWooLineItemToItem', () => {
    it('should map WooCommerce line_item to Strapi item', () => {
      const wooLineItem = {
        id: 111,
        product_id: 123,
        sku: '978-1234567890',
        name: 'Test Book',
        quantity: 2,
        price: '10000',
        total: '20000',
      };

      const result = mapper.mapWooLineItemToItem(wooLineItem, 'woo_moraleja');

      expect(result).toMatchObject({
        item_id: 111,
        producto_id: 123,
        sku: '978-1234567890',
        nombre: 'Test Book',
        cantidad: 2,
        precio_unitario: 10000,
        total: 20000,
        metadata: {},
      });
    });

    it('should handle line_item with missing fields', () => {
      const wooLineItem = {
        product_id: 123,
        quantity: 1,
      };

      const result = mapper.mapWooLineItemToItem(wooLineItem, 'woo_moraleja');

      expect(result).toMatchObject({
        producto_id: 123,
        cantidad: 1,
        sku: '',
        nombre: '',
        precio_unitario: 0,
        total: 0,
      });
    });
  });

  describe('mapWooLineItemsToItems', () => {
    it('should map multiple line_items', () => {
      const wooLineItems = [
        {
          id: 111,
          product_id: 123,
          name: 'Book 1',
          quantity: 1,
        },
        {
          id: 222,
          product_id: 456,
          name: 'Book 2',
          quantity: 2,
        },
      ];

      const result = mapper.mapWooLineItemsToItems(wooLineItems, 'woo_moraleja');

      expect(result).toHaveLength(2);
      expect(result[0].producto_id).toBe(123);
      expect(result[1].producto_id).toBe(456);
    });
  });
});
