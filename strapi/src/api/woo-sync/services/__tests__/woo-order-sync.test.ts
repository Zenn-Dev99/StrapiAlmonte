import { describe, it, expect, beforeEach, vi } from 'vitest';
import wooOrderSync from '../woo-order-sync';
import wooConfigService from '../woo-config';
import wooApiClient from '../woo-api-client';
import orderMapper from '../mappers/order-mapper';
import lineItemMapper from '../mappers/line-item-mapper';
import addressMapper from '../mappers/address-mapper';

// Mock dependencies
vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: vi.fn(),
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createOrder: vi.fn(),
    updateOrder: vi.fn(),
    deleteOrder: vi.fn(),
    get: vi.fn(),
  })),
}));

vi.mock('../mappers/order-mapper', () => ({
  default: vi.fn(() => ({
    mapWoPedidoToWooOrder: vi.fn(),
  })),
}));

vi.mock('../mappers/line-item-mapper', () => ({
  default: vi.fn(() => ({
    mapItemsToWooLineItems: vi.fn(),
    mapItemToWooLineItem: vi.fn(),
  })),
}));

vi.mock('../mappers/address-mapper', () => ({
  default: vi.fn(() => ({
    mapBillingToWoo: vi.fn(),
    mapShippingToWoo: vi.fn(),
  })),
}));

// Mock dependencies at module level
const mockGetWooConfig = vi.fn();
const mockCreateOrder = vi.fn();
const mockUpdateOrder = vi.fn();
const mockDeleteOrder = vi.fn();
const mockGet = vi.fn();
const mockMapWoPedidoToWooOrder = vi.fn();
const mockMapItemsToWooLineItems = vi.fn();
const mockMapItemToWooLineItem = vi.fn();
const mockMapBillingToWoo = vi.fn();
const mockMapShippingToWoo = vi.fn();

vi.mock('../woo-config', () => ({
  default: vi.fn(() => ({
    getWooConfig: mockGetWooConfig,
  })),
}));

vi.mock('../woo-api-client', () => ({
  default: vi.fn(() => ({
    createOrder: mockCreateOrder,
    updateOrder: mockUpdateOrder,
    deleteOrder: mockDeleteOrder,
    get: mockGet,
  })),
}));

vi.mock('../mappers/order-mapper', () => ({
  default: vi.fn(() => ({
    mapWoPedidoToWooOrder: mockMapWoPedidoToWooOrder,
  })),
}));

vi.mock('../mappers/line-item-mapper', () => ({
  default: vi.fn(() => ({
    mapItemsToWooLineItems: mockMapItemsToWooLineItems,
    mapItemToWooLineItem: mockMapItemToWooLineItem,
  })),
}));

vi.mock('../mappers/address-mapper', () => ({
  default: vi.fn(() => ({
    mapBillingToWoo: mockMapBillingToWoo,
    mapShippingToWoo: mockMapShippingToWoo,
  })),
}));

describe('Woo Order Sync Service', () => {
  let service: ReturnType<typeof wooOrderSync>;
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

  const mockWooOrder = {
    id: 456,
    number: '12345',
    status: 'processing',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGetWooConfig.mockReturnValue(mockConfig);
    mockMapWoPedidoToWooOrder.mockResolvedValue({
      status: 'processing',
      total: '15000',
    });
    mockMapItemsToWooLineItems.mockResolvedValue([
      { product_id: 123, quantity: 2 },
    ]);
    mockCreateOrder.mockResolvedValue(mockWooOrder);
    mockUpdateOrder.mockResolvedValue(mockWooOrder);
    mockDeleteOrder.mockResolvedValue({ deleted: true });
    mockGet.mockResolvedValue({ id: 789 }); // Para validar customer
    
    service = wooOrderSync({ strapi: mockStrapi });
  });

  describe('syncOrder', () => {
    it('should create new order when no externalId exists', async () => {
      const woPedido = {
        id: 1,
        numero_pedido: '12345',
        estado: 'pending',
        total: 15000,
        externalIds: {},
        items: [{ id: 1, producto_id: 123, cantidad: 2 }],
      };

      mockStrapi.entityService.findOne.mockResolvedValue(woPedido);

      const result = await service.syncOrder(woPedido, 'woo_moraleja');

      expect(result).toEqual(mockWooOrder);
      expect(mockStrapi.entityService.update).toHaveBeenCalledWith(
        'api::wo-pedido.wo-pedido',
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            wooId: 456,
            externalIds: { woo_moraleja: 456 },
          }),
        })
      );
    });

    it('should update existing order when externalId exists', async () => {
      const woPedido = {
        id: 1,
        numero_pedido: '12345',
        wooId: 456,
        externalIds: { woo_moraleja: 456 },
        items: [{ id: 1, producto_id: 123, cantidad: 2 }],
      };

      mockStrapi.entityService.findOne.mockResolvedValue(woPedido);

      const result = await service.syncOrder(woPedido, 'woo_moraleja');

      expect(result).toEqual(mockWooOrder);
    });

    it('should throw error if no numero_pedido', async () => {
      const woPedido = {
        id: 1,
        items: [],
      };

      await expect(service.syncOrder(woPedido, 'woo_moraleja')).rejects.toThrow(
        'wo-pedido sin numero_pedido'
      );
    });

    it('should throw error if no valid line items', async () => {
      const woPedido = {
        id: 1,
        numero_pedido: '12345',
        items: [],
      };

      const lineItemMap = lineItemMapper({ strapi: mockStrapi });
      (lineItemMap.mapItemsToWooLineItems as any).mockResolvedValue([]);

      mockStrapi.entityService.findOne.mockResolvedValue(woPedido);

      await expect(service.syncOrder(woPedido, 'woo_moraleja')).rejects.toThrow(
        'No se puede crear/actualizar un pedido sin productos válidos'
      );
    });
  });

  describe('deleteOrder', () => {
    it('should delete order when wooId exists', async () => {
      const woPedido = {
        id: 1,
        wooId: 456,
        externalIds: { woo_moraleja: 456 },
      };

      await service.deleteOrder(woPedido, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Pedido eliminado')
      );
    });

    it('should skip deletion if no wooId', async () => {
      const woPedido = {
        id: 1,
        externalIds: {},
      };

      await service.deleteOrder(woPedido, 'woo_moraleja');

      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('No hay wooId')
      );
    });
  });
});
