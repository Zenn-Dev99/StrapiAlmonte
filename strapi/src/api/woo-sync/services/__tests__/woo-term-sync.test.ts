import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooTermSync from '../woo-term-sync';

// Mock dependencies
const mockGetWooConfig = vi.fn();
const mockGetOrCreateAttribute = vi.fn();
const mockGetOrCreateAttributeTerm = vi.fn();

vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: mockGetWooConfig,
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    getOrCreateAttribute: mockGetOrCreateAttribute,
    getOrCreateAttributeTerm: mockGetOrCreateAttributeTerm,
  })),
}));

describe('Woo Term Sync Service', () => {
  let service: ReturnType<typeof wooTermSync>;
  const mockStrapi = {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as any;

  const mockConfig = {
    url: 'https://example.com',
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
  };

  const mockAttribute = { id: 1, name: 'Autor', slug: 'autor' };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetWooConfig.mockImplementation((platform: string) => {
      if (platform === 'woo_moraleja' || platform === 'woo_escolar') {
        return mockConfig;
      }
      return null;
    });
    
    mockGetOrCreateAttribute.mockResolvedValue(mockAttribute);
    mockGetOrCreateAttributeTerm.mockResolvedValue({ id: 1, name: 'Test' });
    
    service = wooTermSync({ strapi: mockStrapi });
  });

  describe('syncAutor', () => {
    it('should sync autor with nombre_completo_autor', async () => {
      const autor = {
        nombre_completo_autor: 'Miguel de Cervantes',
        resegna: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Escritor español' },
            ],
          },
        ],
      };

      await service.syncAutor(autor);

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Miguel de Cervantes')
      );
    });

    it('should warn if autor has no nombre_completo_autor', async () => {
      const autor = {};

      await service.syncAutor(autor);

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin nombre_completo_autor')
      );
    });

    it('should handle autor without resegna', async () => {
      const autor = {
        nombre_completo_autor: 'Test Author',
      };

      await service.syncAutor(autor);

      expect(mockStrapi.log.info).toHaveBeenCalled();
    });
  });

  describe('syncObra', () => {
    it('should sync obra with nombre_obra', async () => {
      const obra = {
        nombre_obra: 'El Quijote',
        descripcion: 'Novela clásica',
      };

      await service.syncObra(obra);

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('El Quijote')
      );
    });

    it('should warn if obra has no nombre_obra', async () => {
      const obra = {};

      await service.syncObra(obra);

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin nombre_obra')
      );
    });
  });

  describe('syncEditorial', () => {
    it('should sync editorial with nombre_editorial', async () => {
      const editorial = {
        nombre_editorial: 'Planeta',
      };

      await service.syncEditorial(editorial);

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Planeta')
      );
    });

    it('should warn if editorial has no nombre_editorial', async () => {
      const editorial = {};

      await service.syncEditorial(editorial);

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin nombre_editorial')
      );
    });
  });

  describe('syncSello', () => {
    it('should sync sello with nombre_sello', async () => {
      const sello = {
        nombre_sello: 'Planeta Junior',
      };

      await service.syncSello(sello);

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Planeta Junior')
      );
    });

    it('should warn if sello has no nombre_sello', async () => {
      const sello = {};

      await service.syncSello(sello);

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin nombre_sello')
      );
    });
  });

  describe('syncColeccion', () => {
    it('should sync coleccion with nombre_coleccion', async () => {
      const coleccion = {
        nombre_coleccion: 'Plan Lector',
      };

      await service.syncColeccion(coleccion);

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Plan Lector')
      );
    });

    it('should warn if coleccion has no nombre_coleccion', async () => {
      const coleccion = {};

      await service.syncColeccion(coleccion);

      expect(mockStrapi.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('sin nombre_coleccion')
      );
    });
  });
});
