import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooApiClient from '../woo-api-client';
import { attributeCache, termCache } from '../utils/cache';

// Mock fetch
global.fetch = vi.fn();

describe('Woo API Client', () => {
  let client: ReturnType<typeof wooApiClient>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  const mockConfig = {
    url: 'https://example.com',
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Limpiar caches para evitar interferencia entre tests
    attributeCache.clear();
    termCache.clear();
    client = wooApiClient({ strapi: mockStrapi });
    (global.fetch as any).mockClear();
  });

  describe('createAuthHeader', () => {
    it('should create Basic Auth header', () => {
      const header = client.createAuthHeader(mockConfig);
      
      expect(header).toBe('Basic Y2tfdGVzdDpjc190ZXN0');
      // Decode to verify
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('ck_test:cs_test');
    });
  });

  describe('get', () => {
    it('should make GET request with correct headers', async () => {
      const mockResponse = { id: 1, name: 'Test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.get(mockConfig, 'products/123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products/123',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic Y2tfdGVzdDpjc190ZXN0',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include query parameters', async () => {
      const mockResponse = [];
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.get(mockConfig, 'products', { search: 'test', per_page: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('per_page=10'),
        expect.any(Object)
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      await expect(client.get(mockConfig, 'products/999')).rejects.toThrow(
        'WooCommerce API error (GET products/999): 404 Not Found'
      );
    });
  });

  describe('post', () => {
    it('should make POST request with data', async () => {
      const mockData = { name: 'New Product', type: 'simple' };
      const mockResponse = { id: 1, ...mockData };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.post(mockConfig, 'products', mockData);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic Y2tfdGVzdDpjc190ZXN0',
          },
          body: JSON.stringify(mockData),
        }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('put', () => {
    it('should make PUT request with data', async () => {
      const mockData = { name: 'Updated Product' };
      const mockResponse = { id: 1, ...mockData };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.put(mockConfig, 'products/1', mockData);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products/1',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic Y2tfdGVzdDpjc190ZXN0',
          },
          body: JSON.stringify(mockData),
        }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      const mockResponse = { id: 1, deleted: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.delete(mockConfig, 'products/1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products/1',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic Y2tfdGVzdDpjc190ZXN0',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null on 404', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const result = await client.delete(mockConfig, 'products/999');

      expect(result).toBeNull();
    });

    it('should add force=true when force is true', async () => {
      const mockResponse = { id: 1, deleted: true };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.delete(mockConfig, 'products/1', true);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products/1?force=true',
        expect.any(Object)
      );
    });
  });

  describe('createProduct', () => {
    it('should call post with products endpoint', async () => {
      const mockData = { name: 'Test Product' };
      const mockResponse = { id: 1, ...mockData };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.createProduct(mockConfig, mockData);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateProduct', () => {
    it('should call put with products/{id} endpoint', async () => {
      const mockData = { name: 'Updated Product' };
      const mockResponse = { id: 1, ...mockData };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.updateProduct(mockConfig, 1, mockData);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/wp-json/wc/v3/products/1',
        expect.objectContaining({
          method: 'PUT',
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getOrCreateAttribute', () => {
    it('should return existing attribute if found', async () => {
      const existingAttribute = { id: 1, name: 'Autor', slug: 'autor' };
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [existingAttribute],
        });

      const result = await client.getOrCreateAttribute(mockConfig, 'Autor', 'autor');

      expect(result).toEqual(existingAttribute);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should create attribute if not found', async () => {
      const newAttribute = { id: 2, name: 'Autor', slug: 'autor' };
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => newAttribute,
        });

      const result = await client.getOrCreateAttribute(mockConfig, 'Autor', 'autor');

      expect(result).toEqual(newAttribute);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
