# 👥 Mapeo Bidireccional: Clientes (Strapi) ↔ Customers (WooCommerce)

## 📋 Resumen Ejecutivo

Este documento describe la implementación completa del mapeo bidireccional entre los **Content Types de Clientes en Strapi** (`wo-cliente`) y los **Customers en WooCommerce**, incluyendo:

- ✅ Mapeo completo de todos los campos
- ✅ Protección de campos estáticos (email)
- ✅ Sincronización bidireccional
- ✅ Lógica de resolución de conflictos

---

## 🗺️ Mapeo de Campos

### Strapi → WooCommerce (`mapWoClienteToWooCustomer`)

| Campo Strapi | Campo WooCommerce | Tipo | Notas |
|--------------|-------------------|------|-------|
| `correo_electronico` | `email` | string | **Campo estático protegido** |
| `nombre` | `first_name` + `last_name` | string | Se separa si viene completo |
| `apellido` | `last_name` | string | Si está separado |
| `username` | `username` | string | Username del cliente |
| `billing` | `billing` | object | Dirección de facturación (usando address-mapper) |
| `shipping` | `shipping` | object | Dirección de envío (usando address-mapper) |
| `ciudad` | `billing.city` / `shipping.city` | string | Si no hay billing/shipping, se crea básico |
| `region` | `billing.state` / `shipping.state` | string | Si no hay billing/shipping, se crea básico |
| `codigo_postal` | `billing.postcode` / `shipping.postcode` | string | Si no hay billing/shipping, se crea básico |
| `pais_region` | `billing.country` / `shipping.country` | string | Si no hay billing/shipping, se crea básico |
| `pedidos` | `meta_data[pedidos]` | integer | Guardado en meta_data |
| `gasto_total` | `meta_data[gasto_total]` | decimal | Guardado en meta_data |
| `aov` | `meta_data[aov]` | decimal | Guardado en meta_data |
| `fecha_registro` | `meta_data[fecha_registro]` | datetime | Guardado en meta_data |
| `ultima_actividad` | `meta_data[ultima_actividad]` | datetime | Guardado en meta_data |

### WooCommerce → Strapi (`mapWooCustomerToWoCliente`)

| Campo WooCommerce | Campo Strapi | Tipo | Protección |
|-------------------|--------------|------|------------|
| `email` | `correo_electronico` | string | ⚠️ **PROTEGIDO** - Solo se actualiza si no existe |
| `first_name` | `nombre` (parte) | string | Siempre se actualiza |
| `last_name` | `apellido` + `nombre` (completo) | string | Siempre se actualiza |
| `username` | `username` | string | Siempre se actualiza |
| `billing` | `billing` | object | Siempre se actualiza |
| `shipping` | `shipping` | object | Siempre se actualiza |
| `billing.city` | `ciudad` | string | Siempre se actualiza |
| `billing.state` | `region` | string | Siempre se actualiza |
| `billing.postcode` | `codigo_postal` | string | Siempre se actualiza |
| `billing.country` | `pais_region` | string | Siempre se actualiza |
| `orders_count` | `pedidos` | integer | Siempre se actualiza |
| `total_spent` | `gasto_total` | decimal | Siempre se actualiza |
| `date_created` | `fecha_registro` | datetime | Siempre se actualiza |
| `date_modified` | `ultima_actividad` | datetime | Siempre se actualiza |
| `meta_data[pedidos]` | `pedidos` | integer | Backup desde meta_data |
| `meta_data[gasto_total]` | `gasto_total` | decimal | Backup desde meta_data |
| `meta_data[aov]` | `aov` | decimal | Backup desde meta_data |
| `meta_data[fecha_registro]` | `fecha_registro` | datetime | Backup desde meta_data |
| `meta_data[ultima_actividad]` | `ultima_actividad` | datetime | Backup desde meta_data |
| `id` | `externalIds[platform]` + `wooId` | integer | Siempre se actualiza |
| `*` (todo) | `rawWooData` | json | Siempre se guarda |

---

## 🔒 Protección de Campos Estáticos

### Campos Protegidos

Los siguientes campos **NO se pueden modificar** una vez que el cliente existe en Strapi:

1. **`correo_electronico`** (Email)
   - Es el identificador único del cliente
   - Se usa para buscar clientes en WooCommerce
   - **Protección**: Si un cliente ya tiene email, no se puede cambiar ni desde Strapi ni desde WooCommerce

### Lógica de Protección

#### En `beforeUpdate` (Lifecycle)

```typescript
// Si se intenta modificar email y ya existe
if (data.correo_electronico !== undefined && woClienteExistente.correo_electronico) {
  const emailNuevo = String(data.correo_electronico).trim().toLowerCase();
  const emailExistente = String(woClienteExistente.correo_electronico).trim().toLowerCase();
  
  if (emailNuevo !== emailExistente) {
    // ⚠️ BLOQUEAR: Eliminar correo_electronico de data
    delete data.correo_electronico;
    // Log advertencia
  }
}
```

#### En `mapWooCustomerToWoCliente` (Mapper)

```typescript
// Solo actualizar email si no existe en Strapi
if (wooCustomer.email) {
  const emailWoo = String(wooCustomer.email).trim().toLowerCase();
  const emailExistente = woClienteExistente?.correo_electronico;
  
  if (!emailExistente) {
    // ✅ Permitir: No existe email, usar el de WooCommerce
    woCliente.correo_electronico = emailWoo;
  } else if (emailExistente.toLowerCase() !== emailWoo) {
    // ⚠️ BLOQUEAR: Mantener email de Strapi
    // NO actualizar correo_electronico
    // Log advertencia
  }
}
```

### Comportamiento

| Escenario | Acción | Resultado |
|-----------|--------|-----------|
| Cliente nuevo sin email | WooCommerce envía email | ✅ Se crea con email de WooCommerce |
| Cliente existe con email | WooCommerce envía email diferente | ⚠️ Se mantiene email de Strapi, se loguea advertencia |
| Cliente existe con email | Intento de modificar desde Strapi | ⚠️ Se bloquea, se mantiene email original |
| Cliente existe con email | WooCommerce envía mismo email | ✅ No hay conflicto, no se actualiza |

---

## 🔄 Sincronización Bidireccional

### Flujo: Strapi → WooCommerce

**Cuándo se sincroniza:**
- Al crear un cliente con `originPlatform = "woo_moraleja"` o `"woo_escolar"`
- Al actualizar un cliente con `originPlatform` válido
- Solo si el cliente está publicado (`publishedAt`)
- Solo si aún no tiene `externalIds[platform]` (para evitar duplicados)

**Proceso:**
1. Se ejecuta en `afterCreate` / `afterUpdate` (lifecycles)
2. Se verifica `originPlatform` válido
3. Se verifica que esté publicado
4. Se verifica que no tenga `externalIds[platform]` ya
5. Se mapea el cliente a formato WooCommerce (`mapWoClienteToWooCustomer`)
6. Se busca si existe cliente en WooCommerce (`externalIds[platform]`)
7. Si existe: **UPDATE** en WooCommerce
8. Si no existe: **CREATE** en WooCommerce y se guarda `externalIds`

**Archivos:**
- `strapi/src/api/wo-cliente/content-types/wo-cliente/lifecycles.ts` (afterCreate/afterUpdate)
- `strapi/src/api/woo-sync/services/woo-customer-sync.ts` (syncCustomer)
- `strapi/src/api/woo-sync/services/mappers/customer-mapper.ts` (mapWoClienteToWooCustomer)

### Flujo: WooCommerce → Strapi

**Cuándo se sincroniza:**
- Cuando WooCommerce envía un webhook (cliente creado/actualizado)
- Cuando se ejecuta manualmente un script de sincronización

**Proceso:**
1. WooCommerce envía webhook con datos del cliente
2. Se busca cliente en Strapi por:
   - `externalIds[platform]` (si existe)
   - `correo_electronico` + `originPlatform` (fallback)
3. Se mapea cliente WooCommerce a cliente Strapi (`mapWooCustomerToWoCliente`)
4. **Protección de email**: Si el cliente ya tiene email, no se modifica
5. Se calculan campos derivados (AOV, fechas, etc.)
6. Si existe: **UPDATE** en Strapi
7. Si no existe: **CREATE** en Strapi (solo si tiene email válido)

**Archivos:**
- `strapi/src/api/woo-webhook/services/woo-webhook.ts` (webhook handler)
- `strapi/src/api/woo-sync/services/mappers/customer-mapper.ts` (mapWooCustomerToWoCliente)

---

## 📊 Resolución de Conflictos

### Prioridad de Datos

1. **Email**: Siempre gana Strapi si ya existe
2. **Direcciones**: WooCommerce → Strapi (si viene de webhook)
3. **Datos de negocio**: WooCommerce → Strapi (si viene de webhook)
4. **Nombres**: WooCommerce → Strapi (si viene de webhook)
5. **Otros campos**: WooCommerce → Strapi (si viene de webhook)

### Estrategia de Sincronización

```
┌─────────────────────────────────────────────────────────┐
│              Sincronización de Clientes                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Strapi → WooCommerce (Push)                             │
│  ├─ Trigger: afterCreate / afterUpdate                   │
│  ├─ Condición: originPlatform === "woo_moraleja/escolar" │
│  ├─ Condición: publishedAt existe                       │
│  ├─ Condición: NO tiene externalIds[platform]            │
│  └─ Acción: CREATE/UPDATE en WooCommerce                 │
│                                                          │
│  WooCommerce → Strapi (Pull)                             │
│  ├─ Trigger: Webhook / Script manual                     │
│  ├─ Protección: Email no se modifica si existe           │
│  ├─ Cálculo: AOV, fechas, etc.                          │
│  └─ Acción: CREATE/UPDATE en Strapi                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🐛 Posibles Problemas y Soluciones

### Problema 1: Email se modifica desde WooCommerce

**Síntoma:**
- Cliente en Strapi tiene email "cliente@example.com"
- WooCommerce tiene email "nuevo@example.com"
- Al sincronizar, el email cambia

**Causa:**
- Falta protección en `mapWooCustomerToWoCliente`

**Solución:**
- ✅ Implementada: Verificar `woClienteExistente` antes de actualizar email
- ✅ Implementada: Protección en `beforeUpdate` lifecycle

### Problema 2: Campos no se mapean correctamente

**Síntoma:**
- Algunos campos de WooCommerce no aparecen en Strapi

**Causa:**
- Falta mapeo en `mapWooCustomerToWoCliente`

**Solución:**
- ✅ Implementada: Mapeo completo de todos los campos
- ✅ Implementada: Soporte para `meta_data` de WooCommerce
- ✅ Implementada: Cálculo automático de AOV

### Problema 3: Sincronización bidireccional crea duplicados

**Síntoma:**
- Se crean clientes duplicados al sincronizar

**Causa:**
- No se busca correctamente por `externalIds` o `correo_electronico`

**Solución:**
- ✅ Implementada: Búsqueda por `externalIds[platform]` primero
- ✅ Implementada: Búsqueda por `correo_electronico` + `originPlatform` como fallback

### Problema 4: Direcciones no se mapean

**Síntoma:**
- Las direcciones billing/shipping no se sincronizan

**Causa:**
- Falta mapeo de direcciones

**Solución:**
- ✅ Implementada: Uso de `address-mapper` para billing y shipping
- ✅ Implementada: Creación automática de direcciones básicas desde campos directos

---

## 🔍 Mejoras Futuras

### 1. Sincronización de Metadatos Avanzados

**Estado actual:**
- Los metadatos básicos se guardan en `meta_data` pero no se sincronizan automáticamente

**Mejora propuesta:**
- Sincronizar metadatos personalizados de WooCommerce
- Mapear campos personalizados a campos específicos de Strapi

### 2. Validación de Email

**Estado actual:**
- El email se valida como string pero no se valida formato

**Mejora propuesta:**
- Validar formato de email antes de sincronizar
- Normalizar emails (lowercase, trim)

### 3. Sincronización Incremental

**Estado actual:**
- Se sincroniza todo el objeto cada vez

**Mejora propuesta:**
- Sincronizar solo campos que han cambiado
- Usar `date_modified` para detectar cambios

### 4. Relación con Persona

**Estado actual:**
- `wo-cliente` no tiene relación directa con `persona`

**Mejora propuesta:**
- Agregar relación opcional `wo-cliente` → `persona`
- Sincronizar automáticamente si el email coincide

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Crear cliente y sincronizar a WooCommerce

```typescript
// Crear cliente en Strapi
const cliente = await strapi.entityService.create('api::wo-cliente.wo-cliente', {
  data: {
    correo_electronico: 'cliente@example.com',
    nombre: 'Juan',
    apellido: 'Pérez',
    originPlatform: 'woo_moraleja',
    billing: {
      first_name: 'Juan',
      last_name: 'Pérez',
      address_1: 'Calle 123',
      city: 'Santiago',
      state: 'Región Metropolitana',
      postcode: '1234567',
      country: 'CL',
      email: 'cliente@example.com',
      phone: '+56912345678',
    },
  },
});

// Se sincroniza automáticamente a WooCommerce en afterCreate
```

### Ejemplo 2: Actualizar desde WooCommerce (webhook)

```typescript
// WooCommerce envía webhook con cliente actualizado
// El webhook handler busca el cliente por externalIds o email
// Si existe, actualiza campos (excepto email si ya existe)
// Si no existe, crea nuevo cliente
```

### Ejemplo 3: Protección de Email

```typescript
// Intento de modificar email existente
await strapi.entityService.update('api::wo-cliente.wo-cliente', clienteId, {
  data: {
    correo_electronico: 'nuevo@example.com', // Diferente al existente
  },
});

// ⚠️ Resultado: Email NO se modifica, se mantiene el original
// Se loguea advertencia
```

---

## 📚 Archivos Modificados

1. **`strapi/src/api/woo-sync/services/mappers/customer-mapper.ts`**
   - ✅ Mejorado `mapWoClienteToWooCustomer`: Mapea todos los campos
   - ✅ Mejorado `mapWooCustomerToWoCliente`: Mapea todos los campos + protección de email
   - ✅ Soporte para separar nombre completo en first_name/last_name
   - ✅ Creación automática de direcciones básicas desde campos directos
   - ✅ Cálculo automático de AOV

2. **`strapi/src/api/wo-cliente/content-types/wo-cliente/lifecycles.ts`**
   - ✅ Agregada protección de email en `beforeUpdate`
   - ✅ Verificación de conflictos de email

3. **`strapi/src/api/woo-sync/services/woo-customer-sync.ts`**
   - ✅ Mejorado para poblar relaciones antes de mapear

---

## ✅ Checklist de Implementación

- [x] Mapeo completo Strapi → WooCommerce
- [x] Mapeo completo WooCommerce → Strapi
- [x] Protección de campos estáticos (email)
- [x] Soporte para direcciones billing/shipping
- [x] Cálculo automático de AOV
- [x] Soporte para meta_data de WooCommerce
- [x] Logging de advertencias
- [x] Documentación completa

---

**Última actualización:** 2025-12-22  
**Autor:** Auto (Cursor AI)  
**Versión:** 1.0


