/**
 * Tipos TypeScript para el sistema de sincronización WooCommerce
 * Reemplaza los usos de `any` con tipos específicos
 */

export type WooPlatform = 'woo_moraleja' | 'woo_escolar';

// Tipos de WooCommerce API
export interface WooProduct {
  id?: number;
  name: string;
  type: string;
  sku: string;
  status: string;
  regular_price?: string;
  sale_price?: string;
  description?: string;
  short_description?: string;
  manage_stock?: boolean;
  stock_quantity?: number;
  stock_status?: string;
  images?: Array<{ src: string; alt?: string }>;
  categories?: Array<{ id: number }>;
  tags?: Array<{ id: number }>;
  attributes?: Array<{
    id: number;
    name: string;
    options: string[];
  }>;
}

export interface WooCustomer {
  id?: number;
  email: string;
  first_name?: string;
  last_name?: string;
  billing?: WooAddress;
  shipping?: WooAddress;
}

export interface WooAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface WooOrder {
  id?: number;
  number?: string;
  status: string;
  currency?: string;
  date_created?: string;
  date_modified?: string;
  total: string;
  subtotal?: string;
  total_tax?: string;
  shipping_total?: string;
  discount_total?: string;
  payment_method?: string;
  payment_method_title?: string;
  customer_id?: number;
  customer_note?: string;
  created_via?: string;
  line_items?: WooLineItem[];
  billing?: WooAddress;
  shipping?: WooAddress;
  meta_data?: Array<{ key: string; value: string | number }>;
}

export interface WooLineItem {
  id?: number;
  product_id: number;
  name?: string;
  sku?: string;
  quantity: number;
  price?: string;
  total?: string;
}

export interface WooCoupon {
  id?: number;
  code: string;
  discount_type: string;
  amount: string;
  description?: string;
  date_expires?: string;
  usage_limit?: number;
  usage_count?: number;
  product_ids?: number[];
  meta_data?: Array<{ key: string; value: string | number }>;
}

export interface WooAttribute {
  id: number;
  name: string;
  slug: string;
  type: string;
  order_by: string;
  has_archives: boolean;
}

export interface WooAttributeTerm {
  id: number;
  name: string;
  slug: string;
  description?: string;
  count?: number;
}

// Tipos de Strapi
export interface StrapiLibro {
  id?: number;
  documentId?: string;
  nombre_libro?: string;
  isbn_libro?: string;
  descripcion_corta?: string;
  descripcion_libro?: string;
  stock?: number;
  precios?: Array<{
    precio_venta?: number;
    activo?: boolean;
    fecha_inicio?: string;
    fecha_fin?: string;
    createdAt?: string;
  }>;
  imagen_portada?: string | { url?: string; formats?: any };
  portada_libro?: string | { url?: string; formats?: any };
  autor_relacion?: any;
  editorial?: any;
  marcas?: any[];
  etiquetas?: any[];
  categorias_producto?: any[];
  externalIds?: Record<string, number | string>;
}

export interface StrapiWoCliente {
  id?: number;
  documentId?: string;
  correo_electronico: string;
  nombre?: string;
  apellido?: string;
  billing?: StrapiAddress;
  shipping?: StrapiAddress;
  externalIds?: Record<string, number | string>;
  wooId?: number | string;
  originPlatform?: string;
  rawWooData?: any;
}

export interface StrapiAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface StrapiWoPedido {
  id?: number;
  documentId?: string;
  numero_pedido: string;
  estado: string;
  total: number;
  subtotal?: number;
  impuestos?: number;
  envio?: number;
  descuento?: number;
  moneda?: string;
  metodo_pago?: string;
  metodo_pago_titulo?: string;
  nota_cliente?: string;
  origen?: string;
  fecha_pedido?: string | Date;
  items?: StrapiWoItem[];
  cliente?: StrapiWoCliente | number | string;
  billing?: StrapiAddress;
  shipping?: StrapiAddress;
  externalIds?: Record<string, number | string>;
  wooId?: number | string;
  originPlatform?: string;
  rawWooData?: any;
}

export interface StrapiWoItem {
  id?: number;
  item_id?: number;
  producto_id?: number | string;
  libro?: number | string | { id?: number; documentId?: number };
  sku?: string;
  nombre?: string;
  cantidad?: number;
  precio_unitario?: number;
  total?: number;
  metadata?: Record<string, any>;
}

export interface StrapiWoCupon {
  id?: number;
  documentId?: string;
  codigo: string;
  tipo_cupon?: string;
  importe_cupon?: number;
  descripcion?: string;
  producto_ids?: number[];
  uso_limite?: number;
  fecha_caducidad?: string | Date;
  originPlatform?: string;
  externalIds?: Record<string, number | string>;
  wooId?: number | string;
  rawWooData?: any;
}

// Tipos de error personalizados
export class WooApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'WooApiError';
  }
}

export class WooConfigError extends Error {
  constructor(message: string, public platform?: WooPlatform) {
    super(message);
    this.name = 'WooConfigError';
  }
}

export class WooValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'WooValidationError';
  }
}
