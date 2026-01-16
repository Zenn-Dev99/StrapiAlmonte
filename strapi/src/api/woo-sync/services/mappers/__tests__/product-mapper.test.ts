import { describe, it, expect, beforeEach } from 'vitest';
import productMapper from '../product-mapper';

describe('Product Mapper', () => {
  let mapper: ReturnType<typeof productMapper>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  beforeEach(() => {
    mapper = productMapper({ strapi: mockStrapi });
  });

  describe('mapLibroToWooProduct', () => {
    it('should map basic libro fields to WooCommerce product', async () => {
      const libro = {
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        descripcion_corta: 'Short description',
        descripcion_libro: 'Long description',
        stock_quantity: 10,
        manage_stock: true,
      };

      const result = await mapper.mapLibroToWooProduct(libro, 'woo_moraleja');

      expect(result).toMatchObject({
        name: 'Test Book',
        type: 'simple',
        sku: '978-1234567890',
        status: 'publish',
        short_description: 'Short description',
        description: 'Long description',
        manage_stock: true,
        stock_quantity: 10,
        stock_status: 'instock',
      });
    });

    it('should handle libro with no stock', async () => {
      const libro = {
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        stock_quantity: 0,
        manage_stock: true,
      };

      const result = await mapper.mapLibroToWooProduct(libro, 'woo_moraleja');

      expect(result.stock_status).toBe('outofstock');
      expect(result.stock_quantity).toBe(0);
    });

    it('should find and use active price', async () => {
      const libro = {
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        precio_regular: 10000,
      };

      const result = await mapper.mapLibroToWooProduct(libro, 'woo_moraleja');

      expect(result.regular_price).toBe('10000');
    });

    it('should handle libro with imagen_portada', async () => {
      const libro = {
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        imagen_portada: {
          url: 'https://example.com/image.jpg',
        },
      };

      const result = await mapper.mapLibroToWooProduct(libro, 'woo_moraleja');

      expect(result.images).toEqual([
        {
          src: 'https://example.com/image.jpg',
          alt: 'Test Book',
        },
      ]);
    });

    it('should handle libro with string imagen_portada', async () => {
      const libro = {
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        imagen_portada: 'https://example.com/image.jpg',
      };

      const result = await mapper.mapLibroToWooProduct(libro, 'woo_moraleja');

      expect(result.images).toEqual([
        {
          src: 'https://example.com/image.jpg',
          alt: 'Test Book',
        },
      ]);
    });
  });

  describe('mapWooProductToLibro', () => {
    it('should map WooCommerce product to libro format', () => {
      const wooProduct = {
        id: 123,
        name: 'Test Book',
        sku: '978-1234567890',
        short_description: 'Short description',
        description: 'Long description',
        regular_price: '15000',
        manage_stock: true,
        stock_quantity: 5,
        images: [
          {
            src: 'https://example.com/image.jpg',
          },
        ],
      };

      const result = mapper.mapWooProductToLibro(wooProduct, 'woo_moraleja');

      expect(result).toMatchObject({
        nombre_libro: 'Test Book',
        isbn_libro: '978-1234567890',
        descripcion_corta: 'Short description',
        descripcion_libro: 'Long description',
        precio: 15000,
        precio_regular: 15000,
        stock_quantity: 5,
        manage_stock: true,
        imagen_portada_url: 'https://example.com/image.jpg',
        externalIds: {
          woo_moraleja: 123,
        },
      });
    });

    it('should handle product without stock management', () => {
      const wooProduct = {
        id: 123,
        name: 'Test Book',
        sku: '978-1234567890',
        manage_stock: false,
        stock_quantity: 0,
      };

      const result = mapper.mapWooProductToLibro(wooProduct, 'woo_moraleja');

      // When manage_stock is false, stock_quantity might be 0 or undefined
      // The mapper sets it to stock_quantity || 0, so it will be 0
      expect(result.stock_quantity).toBe(0);
      expect(result.manage_stock).toBe(false);
    });
  });

  describe('findActivePrice', () => {
    it('should find active and valid price', () => {
      const ahora = new Date();
      const mañana = new Date(ahora);
      mañana.setDate(mañana.getDate() + 1);
      const ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);

      const precios = [
        {
          activo: true,
          precio_venta: 10000,
          fecha_inicio: ayer.toISOString(),
          fecha_fin: mañana.toISOString(),
        },
        {
          activo: false,
          precio_venta: 5000,
        },
      ];

      const result = mapper.findActivePrice(precios);

      expect(result).toMatchObject({
        activo: true,
        precio_venta: 10000,
      });
    });

    it('should return null if no active prices', () => {
      const precios = [
        {
          activo: false,
          precio_venta: 5000,
        },
      ];

      const result = mapper.findActivePrice(precios);

      expect(result).toBeNull();
    });

    it('should return most recent price if multiple valid', () => {
      const ahora = new Date();
      const mañana = new Date(ahora);
      mañana.setDate(mañana.getDate() + 1);
      const ayer = new Date(ahora);
      ayer.setDate(ayer.getDate() - 1);
      const hace2Dias = new Date(ahora);
      hace2Dias.setDate(hace2Dias.getDate() - 2);

      const precios = [
        {
          activo: true,
          precio_venta: 10000,
          fecha_inicio: hace2Dias.toISOString(),
          fecha_fin: mañana.toISOString(),
        },
        {
          activo: true,
          precio_venta: 12000,
          fecha_inicio: ayer.toISOString(),
          fecha_fin: mañana.toISOString(),
        },
      ];

      const result = mapper.findActivePrice(precios);

      expect(result?.precio_venta).toBe(12000);
    });
  });
});




