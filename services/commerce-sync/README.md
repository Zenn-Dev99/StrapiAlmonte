## commerce-sync

Servicio ligero para sincronizar productos y clientes entre WooCommerce (tienda por tenant) y Strapi (backend unificado multi-tenant).

### Objetivos

- Recibir webhooks de Woo (products, customers) → upsert en Strapi.
- Recibir webhooks de Strapi (products, customers) → upsert en la tienda Woo correspondiente al tenant.
- Mantener idempotencia y evitar bucles de sincronización.

### Endpoints propuestos

- `POST /webhooks/woo/:tenant`
  - Headers: `x-wc-webhook-signature` (opcional, recomendado)
  - Body: payload nativo de Woo (product.created/updated/deleted, customer.created/updated)
  - Acciones:
    - Normaliza payload, enriquece con `tenant` y hace upsert en Strapi:
      - Productos → `product` publicable (p.ej. Libro/Edición)
      - Clientes → `customer` + relación a `persona`

- `POST /webhooks/strapi/:tenant`
  - Headers: `x-strapi-signature` (opcional)
  - Body: payload nativo de Strapi (afterCreate/afterUpdate/afterDelete)
  - Acciones:
    - Normaliza y hace upsert/publish en Woo para el tenant indicado.

### Variables de entorno

Ver `.env.example` (no incluir credenciales en el repositorio).

### Reglas de sincronización

- Idempotencia:
  - Productos: llave natural `sku` (Woo) ↔ `product.sku` (Strapi). Mantener `externalIds.woo_<tenant>`.
  - Clientes: llave natural `email`. Mantener `externalIds.woo_<tenant>`.

- Bucles:
  - Añadir header `x-sync-source: woo|strapi` y/o flag `source` en payload; ignorar eventos que provengan de la misma operación.

- Tenancy:
  - Sólo sincronizar hacia una tienda Woo si `tenants` del producto incluye ese `tenant`.
  - Para clientes, asignar `customer.tenants` incluyendo el `tenant` de origen y `originPlatform=woo_<tenant>`.

### Mapeos (resumen)

Woo → Strapi (producto):
- `sku` → `product.sku` (único)
- `name` → `product.title`
- `short_description` → `product.summary`
- `description` → `product.description`
- `regular_price/sale_price` → `product.price`
- `manage_stock/stock_quantity/backorders` → `product.inventory`*
- `weight/length/width/height` → `product.shipping`
- `categories/tags/brands` → taxonomías/relaciones
- atributo `book-author` → relación `autor`
- `images` → `product.images[]`
- Id Woo → `product.externalIds.woo_<tenant>`

Woo → Strapi (cliente):
- `email/first_name/last_name` → `customer` + `persona`
- `billing/shipping` de pedidos → `customer.addresses` (cuando estén disponibles)
- Id Woo → `customer.externalIds.woo_<tenant>`
- `customer.tenants += <tenant>` y `originPlatform=woo_<tenant>`

Strapi → Woo (producto):
- Sólo si `tenants` contiene `<tenant>`
- SKU/título/precios/stock/atributos/relaciones/imagenes
- Id Woo se guarda en `externalIds.woo_<tenant>` tras creación

### Estructura mínima (sin dependencias)

Este servicio puede iniciarse con Node.js nativo (http) o Express. Si se usa Express, agregar `body-parser` y validación de firmas.

Archivos sugeridos:
- `src/server.ts` (o `server.js`): servidor http, routing básico.
- `src/handlers/woo.ts`: normalización y upsert en Strapi.
- `src/handlers/strapi.ts`: normalización y upsert en Woo.
- `src/mappers/`… conversores de payload.
- `src/clients/strapi.ts` y `src/clients/woo.ts`: clients REST.

> Nota: Este repositorio contiene sólo el esqueleto. La instancia operativa puede residir en Railway/Render/Kinsta con CI/CD.

### Seguridad

- Validar firmas (`x-wc-webhook-signature`, `x-strapi-signature`) cuando estén configuradas.
- Aceptar sólo tenants permitidos (`moraleja`, `escolar`, `listas`).
- Registrar auditoría mínima (request-id, source, entidad, id natural).

### Roadmap corto

1) Implementar `POST /webhooks/woo/:tenant` (products + customers).
2) Implementar `POST /webhooks/strapi/:tenant` (products).
3) Backfill inicial: scripts para importar CSV/API Woo → Strapi.
4) Añadir retries/cola simple (in-memory) y luego Redis/BullMQ si es necesario.

## Servicio `commerce-sync`

- Sincroniza catálogo, inventario y pedidos entre Strapi, WooCommerce y otros servicios internos.
- Expone workers/colas y webhooks para mantener los datos alineados.

### Próximos pasos

- Definir architecture (Node.js con BullMQ, serverless, etc.).
- Implementar listeners de webhooks desde Strapi y WooCommerce.
- Publicar SDK o hooks que consuman este servicio.



