import { describe, it, expect, beforeEach } from 'vitest';
import orderMapper from '../order-mapper';

describe('Order Mapper', () => {
  let mapper: ReturnType<typeof orderMapper>;
  const mockStrapi = {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any;

  beforeEach(() => {
    mapper = orderMapper({ strapi: mockStrapi });
  });

  describe('mapWoPedidoToWooOrder', () => {
    it('should map basic wo-pedido to WooCommerce order', async () => {
      const woPedido = {
        estado: 'pending',
        total: 15000,
        subtotal: 13000,
        impuestos: 2000,
        envio: 0,
        descuento: 0,
        moneda: 'CLP',
        metodo_pago: 'bacs',
        metodo_pago_titulo: 'Transferencia bancaria',
        origen: 'web',
        fecha_pedido: '2024-01-01T00:00:00Z',
      };

      const result = await mapper.mapWoPedidoToWooOrder(woPedido, 'woo_moraleja');

      expect(result).toMatchObject({
        status: 'pending',
        total: '15000',
        subtotal: '13000',
        total_tax: '2000',
        shipping_total: '0',
        discount_total: '0',
        currency: 'CLP',
        payment_method: 'bacs',
        payment_method_title: 'Transferencia bancaria',
        created_via: 'web',
        date_created: '2024-01-01T00:00:00Z',
      });
    });

    it('should normalize order status', async () => {
      const woPedido = {
        estado: 'draft',
        total: 10000,
      };

      const result = await mapper.mapWoPedidoToWooOrder(woPedido, 'woo_moraleja');

      expect(result.status).toBe('auto-draft');
    });
  });

  describe('mapWooOrderToWoPedido', () => {
    it('should map WooCommerce order to wo-pedido format', () => {
      const wooOrder = {
        id: 456,
        number: '12345',
        status: 'processing',
        total: '15000',
        subtotal: '13000',
        total_tax: '2000',
        shipping_total: '0',
        discount_total: '0',
        currency: 'CLP',
        payment_method: 'bacs',
        payment_method_title: 'Transferencia bancaria',
        customer_note: 'Please deliver in the morning',
        created_via: 'web',
        date_created: '2024-01-01T00:00:00Z',
      };

      const result = mapper.mapWooOrderToWoPedido(wooOrder, 'woo_moraleja');

      expect(result).toMatchObject({
        numero_pedido: '12345',
        estado: 'processing',
        total: 15000,
        subtotal: 13000,
        impuestos: 2000,
        envio: 0,
        descuento: 0,
        fecha_pedido: '2024-01-01T00:00:00Z',
        moneda: 'CLP',
        metodo_pago: 'bacs',
        metodo_pago_titulo: 'Transferencia bancaria',
        nota_cliente: 'Please deliver in the morning',
        origen: 'web',
        externalIds: {
          woo_moraleja: 456,
        },
        wooId: 456,
      });
    });

    it('should use order id if number is not available', () => {
      const wooOrder = {
        id: 456,
        status: 'pending',
        total: '10000',
      };

      const result = mapper.mapWooOrderToWoPedido(wooOrder, 'woo_moraleja');

      expect(result.numero_pedido).toBe('456');
    });
  });

  describe('normalizeOrderStatus', () => {
    it('should return valid status as-is', () => {
      expect(mapper.normalizeOrderStatus('pending')).toBe('pending');
      expect(mapper.normalizeOrderStatus('processing')).toBe('processing');
      expect(mapper.normalizeOrderStatus('completed')).toBe('completed');
    });

    it('should map common status variations', () => {
      expect(mapper.normalizeOrderStatus('draft')).toBe('auto-draft');
      expect(mapper.normalizeOrderStatus('canceled')).toBe('cancelled');
      expect(mapper.normalizeOrderStatus('cancel')).toBe('cancelled');
      expect(mapper.normalizeOrderStatus('refund')).toBe('refunded');
      expect(mapper.normalizeOrderStatus('error')).toBe('failed');
    });

    it('should return pending for invalid status', () => {
      expect(mapper.normalizeOrderStatus('invalid-status')).toBe('pending');
      expect(mapper.normalizeOrderStatus(null)).toBe('pending');
      expect(mapper.normalizeOrderStatus(undefined)).toBe('pending');
    });

    it('should handle case-insensitive status', () => {
      expect(mapper.normalizeOrderStatus('PENDING')).toBe('pending');
      expect(mapper.normalizeOrderStatus('Processing')).toBe('processing');
    });
  });
});
