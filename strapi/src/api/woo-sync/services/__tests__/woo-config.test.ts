import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooConfigService from '../woo-config';

describe('Woo Config Service', () => {
  let service: ReturnType<typeof wooConfigService>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Limpiar variables de entorno
    delete process.env.WOO_MORALEJA_URL;
    delete process.env.WOO_MORALEJA_CONSUMER_KEY;
    delete process.env.WOO_MORALEJA_CONSUMER_SECRET;
    delete process.env.WOO_ESCOLAR_URL;
    delete process.env.WOO_ESCOLAR_CONSUMER_KEY;
    delete process.env.WOO_ESCOLAR_CONSUMER_SECRET;
    
    service = wooConfigService({ strapi: mockStrapi });
  });

  describe('getWooConfig', () => {
    it('should return config for woo_moraleja when all env vars are set', () => {
      process.env.WOO_MORALEJA_URL = 'https://moraleja.example.com';
      process.env.WOO_MORALEJA_CONSUMER_KEY = 'ck_test_123';
      process.env.WOO_MORALEJA_CONSUMER_SECRET = 'cs_test_456';

      const config = service.getWooConfig('woo_moraleja');

      expect(config).toEqual({
        url: 'https://moraleja.example.com',
        consumerKey: 'ck_test_123',
        consumerSecret: 'cs_test_456',
      });
    });

    it('should return config for woo_escolar when all env vars are set', () => {
      process.env.WOO_ESCOLAR_URL = 'https://escolar.example.com';
      process.env.WOO_ESCOLAR_CONSUMER_KEY = 'ck_test_789';
      process.env.WOO_ESCOLAR_CONSUMER_SECRET = 'cs_test_012';

      const config = service.getWooConfig('woo_escolar');

      expect(config).toEqual({
        url: 'https://escolar.example.com',
        consumerKey: 'ck_test_789',
        consumerSecret: 'cs_test_012',
      });
    });

    it('should return null when URL is missing', () => {
      process.env.WOO_MORALEJA_CONSUMER_KEY = 'ck_test_123';
      process.env.WOO_MORALEJA_CONSUMER_SECRET = 'cs_test_456';

      const config = service.getWooConfig('woo_moraleja');

      expect(config).toBeNull();
    });

    it('should return null when consumerKey is missing', () => {
      process.env.WOO_MORALEJA_URL = 'https://moraleja.example.com';
      process.env.WOO_MORALEJA_CONSUMER_SECRET = 'cs_test_456';

      const config = service.getWooConfig('woo_moraleja');

      expect(config).toBeNull();
    });

    it('should return null when consumerSecret is missing', () => {
      process.env.WOO_MORALEJA_URL = 'https://moraleja.example.com';
      process.env.WOO_MORALEJA_CONSUMER_KEY = 'ck_test_123';

      const config = service.getWooConfig('woo_moraleja');

      expect(config).toBeNull();
    });

    it('should return null when all env vars are missing', () => {
      const config = service.getWooConfig('woo_moraleja');

      expect(config).toBeNull();
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      const config = {
        url: 'https://example.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      };

      expect(service.validateConfig(config)).toBe(true);
    });

    it('should return false for null config', () => {
      expect(service.validateConfig(null)).toBe(false);
    });

    it('should return false for config with missing url', () => {
      const config = {
        url: '',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      };

      expect(service.validateConfig(config)).toBe(false);
    });

    it('should return false for config with missing consumerKey', () => {
      const config = {
        url: 'https://example.com',
        consumerKey: '',
        consumerSecret: 'cs_test',
      };

      expect(service.validateConfig(config)).toBe(false);
    });

    it('should return false for config with missing consumerSecret', () => {
      const config = {
        url: 'https://example.com',
        consumerKey: 'ck_test',
        consumerSecret: '',
      };

      expect(service.validateConfig(config)).toBe(false);
    });
  });
});
