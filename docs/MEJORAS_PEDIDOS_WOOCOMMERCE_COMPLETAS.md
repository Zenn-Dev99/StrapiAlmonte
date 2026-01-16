# Mejoras Completas en Pedidos WooCommerce

## 📋 Resumen de Mejoras

Se han implementado mejoras significativas en el manejo de pedidos para evitar conflictos, mejorar la experiencia de usuario y asegurar compatibilidad con WooCommerce.

## ✨ Funcionalidades Implementadas

### 1. **Generación Automática de `wooId` Único**

**Problema anterior:**
- Conflictos cuando múltiples pedidos tenían el mismo `wooId`
- Errores al sincronizar con WooCommerce

**Solución:**
- Función `generarWooIdUnico()` que crea IDs únicos basados en timestamp + random
- Función `wooIdExiste()` que verifica si un ID ya existe en la BD
- Función `generarWooIdUnicoValido()` que garantiza un ID único
- Se ejecuta automáticamente en `beforeCreate` y `beforeUpdate`

**Implementación:**
```typescript
// Genera ID único: timestamp (últimos 10 dígitos) + random (4 dígitos)
function generarWooIdUnico(): number {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return parseInt(String(timestamp).slice(-10) + String(random).padStart(4, '0'), 10);
}
```

### 2. **Auto-relleno Mejorado de Campos**

**Mejoras:**
- **Siempre rellena** los campos desde el libro (no solo si están vacíos)
- **Sobrescribe** nombre, SKU y producto_id con los valores actuales del libro
- **Calcula automáticamente** el total cuando cambia precio o cantidad
- **Establece cantidad por defecto** (1) si no se especifica

**Campos que se rellenan:**
- `nombre` ← `libro.nombre_libro`
- `sku` ← `libro.isbn_libro`
- `producto_id` ← `libro.externalIds[platform]`
- `precio_unitario` ← `libro.precios` (precio activo y vigente)
- `total` ← `precio_unitario * cantidad` (calculado automáticamente)

### 3. **Selección Múltiple de Libros**

**Nueva funcionalidad:**
- Campo `libros_para_agregar` (relación manyToMany con libros)
- Permite seleccionar múltiples libros de una vez
- Crea items automáticamente para cada libro seleccionado
- Rellena todos los campos de cada item desde el libro correspondiente

**Uso:**
1. Seleccionar libros en el campo `libros_para_agregar`
2. Al guardar, se crean items automáticamente
3. Cada item se rellena con los datos del libro correspondiente

### 4. **Valores por Defecto de WooCommerce**

**Campos con enumeraciones y valores por defecto:**

#### `estado` (enumeration)
- Valores: `auto-draft`, `pending`, `processing`, `on-hold`, `completed`, `cancelled`, `refunded`, `failed`, `checkout-draft`
- **Default:** `pending`

#### `metodo_pago` (enumeration)
- Valores: `bacs`, `cheque`, `cod`, `paypal`, `stripe`, `transferencia`, `otro`
- **Default:** `bacs`

#### `origen` (enumeration)
- Valores: `web`, `checkout`, `rest-api`, `admin`, `mobile`, `directo`, `otro`
- **Default:** `web`

#### `moneda` (string)
- **Default:** `CLP`

**Estos valores se establecen automáticamente en `beforeCreate` si no se especifican.**

## 🔧 Cambios Técnicos

### Schema Actualizado (`wo-pedido/schema.json`)

```json
{
  "estado": {
    "type": "enumeration",
    "enum": ["auto-draft", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed", "checkout-draft"],
    "default": "pending"
  },
  "metodo_pago": {
    "type": "enumeration",
    "enum": ["bacs", "cheque", "cod", "paypal", "stripe", "transferencia", "otro"],
    "default": "bacs"
  },
  "origen": {
    "type": "enumeration",
    "enum": ["web", "checkout", "rest-api", "admin", "mobile", "directo", "otro"],
    "default": "web"
  },
  "libros_para_agregar": {
    "type": "relation",
    "relation": "manyToMany",
    "target": "api::libro.libro",
    "private": true
  }
}
```

### Lifecycle Hooks Mejorados

#### `beforeCreate`
1. Genera `wooId` único si no existe
2. Establece valores por defecto (`estado`, `moneda`, `metodo_pago`, `origen`, `fecha_pedido`)
3. Procesa items para auto-rellenar desde libros
4. Crea items automáticamente desde `libros_para_agregar`

#### `beforeUpdate`
1. Genera `wooId` único si el pedido no tiene uno
2. Procesa items para auto-rellenar desde libros
3. Actualiza campos cuando se cambia el libro en un item

## 📊 Flujo Completo

### Crear Pedido con Selección Múltiple de Libros

```
1. Usuario crea nuevo wo-pedido
2. Selecciona múltiples libros en "libros_para_agregar"
3. beforeCreate se ejecuta:
   a. Genera wooId único
   b. Establece valores por defecto
   c. Crea items automáticamente desde libros seleccionados
   d. Rellena cada item con datos del libro:
      - nombre, SKU, producto_id, precio_unitario
      - Calcula total automáticamente
4. Pedido guardado con items completos
```

### Actualizar Item con Libro

```
1. Usuario selecciona/cambia libro en un item existente
2. beforeUpdate se ejecuta:
   a. Detecta que el item tiene libro
   b. Obtiene datos completos del libro
   c. Rellena/actualiza campos del item:
      - nombre (sobrescribe)
      - SKU (sobrescribe)
      - producto_id (sobrescribe)
      - precio_unitario (si está vacío o es 0)
      - total (recalcula)
3. Item actualizado con datos del libro
```

## ✅ Beneficios

1. **Sin conflictos de wooId**: Cada pedido tiene un ID único garantizado
2. **Menos trabajo manual**: Los campos se rellenan automáticamente
3. **Datos siempre actualizados**: Los campos se actualizan desde el libro
4. **Selección múltiple**: Agregar varios libros de una vez
5. **Valores válidos**: Enumeraciones aseguran valores compatibles con WooCommerce
6. **Valores por defecto**: Campos se llenan automáticamente con valores sensatos

## 🎯 Casos de Uso

### Caso 1: Crear Pedido Rápido
1. Seleccionar múltiples libros en `libros_para_agregar`
2. Guardar → Items se crean automáticamente con todos los datos
3. Ajustar cantidades si es necesario
4. Publicar → Se sincroniza a WooCommerce

### Caso 2: Actualizar Item
1. Cambiar el libro en un item existente
2. Guardar → Todos los campos se actualizan automáticamente
3. El precio se actualiza al precio actual del libro

### Caso 3: Agregar Item Manualmente
1. Agregar nuevo item
2. Seleccionar libro
3. Guardar → Campos se rellenan automáticamente
4. Solo ajustar cantidad si es necesario

## 🔍 Debugging

### Logs Importantes

```
[wo-pedido] wooId único generado: {wooId}
[wo-pedido] ✅ Item rellenado automáticamente desde libro: {nombre}
[wo-pedido] Item creado automáticamente desde libro: {libroId}
```

### Verificar wooId Único

Si hay conflictos, revisar:
- Logs de generación de wooId
- Verificar que no haya pedidos duplicados con el mismo wooId
- El sistema intenta hasta 10 veces generar un ID único

## 📝 Notas Importantes

- **wooId se genera automáticamente**: No es necesario especificarlo manualmente
- **Campos se sobrescriben**: Al cambiar el libro, nombre/SKU/producto_id se actualizan
- **Precio solo si está vacío**: El precio solo se rellena si es 0 o no existe
- **Campo temporal**: `libros_para_agregar` se elimina después de procesar (no se guarda)
- **Valores por defecto**: Se establecen solo si el campo está vacío

## 🚀 Próximos Pasos

1. Probar creación de pedidos con selección múltiple
2. Verificar que no hay conflictos de wooId
3. Confirmar que los campos se rellenan correctamente
4. Validar que los valores por defecto funcionan
