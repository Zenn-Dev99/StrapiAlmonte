# 🔄 Cómo Funcionan los Términos de Atributos en WooCommerce

## 📋 Conceptos Básicos

### Estructura en WooCommerce

```
Product Attribute (Atributo de Producto)
    ↓
    ├── "Autor" (atributo)
    │   ├── Término: "Gabriel García Márquez" (con descripción)
    │   ├── Término: "Isabel Allende" (con descripción)
    │   └── Término: "Mario Vargas Llosa" (con descripción)
    │
    ├── "Obra" (atributo)
    │   ├── Término: "Cien años de soledad" (con descripción)
    │   └── Término: "Don Quijote" (con descripción)
    │
    └── "Editorial" (atributo)
        ├── Término: "Editorial Moraleja"
        └── Término: "Editorial Planeta"
```

### Mapeo Strapi ↔ WooCommerce

| Strapi | WooCommerce | Tipo |
|--------|-------------|------|
| `Autor` (Content Type) | `Product Attribute "Autor"` → `Term` | Relación |
| `Obra` (Content Type) | `Product Attribute "Obra"` → `Term` | Relación |
| `Editorial` (Content Type) | `Product Attribute "Editorial"` → `Term` | Relación |
| `Sello` (Content Type) | `Product Attribute "Sello"` → `Term` | Relación |
| `Colección` (Content Type) | `Product Attribute "Colección"` → `Term` | Relación |
| `Marca` (Content Type) | `Product Attribute "Marca"` → `Term` | Relación |

**Nota:** Todas estas entidades usan la **misma lógica de sincronización** (implementación unificada).

---

## 🔄 Flujos de Sincronización

### 1. Strapi → WooCommerce (Automático)

**Cuándo se activa:**
- Cuando se crea/actualiza/elimina un Autor, Editorial, Obra, Sello, Colección o Marca en Strapi
- Los lifecycles `afterCreate`, `afterUpdate`, y `afterDelete` sincronizan automáticamente

**Cómo funciona:**

#### **CREAR** (afterCreate)
1. Se crea la entidad en Strapi (ej: Autor "Gabriel García Márquez")
2. El lifecycle `afterCreate` llama a `syncAutorTerm()` (o equivalente)
3. Se busca o crea el atributo en WooCommerce (ej: "Autor")
4. Se crea el término usando `getOrCreateAttributeTerm()`:
   - **Slug**: Se usa el `documentId` de Strapi como slug (ej: `slug = "abc123def456"`)
   - **Nombre**: Se usa el nombre de la entidad (ej: "Gabriel García Márquez")
   - **Descripción**: Se convierte desde `resegna` (blocks) o `descripcion` (text)
5. Se guarda el `externalId` (WooCommerce term ID) en Strapi en el campo `externalIds`

#### **ACTUALIZAR** (afterUpdate)
1. Se actualiza la entidad en Strapi (ej: cambiar nombre del autor)
2. El lifecycle `afterUpdate` llama a `sync*Term()` (ej: `syncAutorTerm()`, `syncEditorialTerm()`, etc.)
3. **Logging de debugging**: Se registra el evento para facilitar troubleshooting
4. Si existe `externalId` guardado:
   - Se actualiza **directamente** usando PUT con el ID de WooCommerce
   - **Payload incluye**:
     - `name`: Nombre actualizado de la entidad
     - `slug`: Se mantiene como `documentId` (esencial para evitar que WooCommerce lo regenere)
     - `description`: Descripción actualizada (si aplica)
   - **Ventaja**: Actualización directa y rápida sin búsquedas
5. Si el PUT falla (404 = término eliminado, u otro error):
   - Se usa `getOrCreateAttributeTerm()` como fallback
   - Si encuentra/crea el término con ID diferente, se actualiza el `externalId`
6. Si no existe `externalId` desde el inicio, se usa `getOrCreateAttributeTerm()` directamente

#### **ELIMINAR** (afterDelete)
1. Se elimina la entidad en Strapi
2. El lifecycle `afterDelete` ejecuta **tres verificaciones de seguridad** para evitar eliminaciones incorrectas:

   **PASO 1: Verificar documentId duplicado (draft/publish)**
   - Si existen otros registros con el mismo `documentId`, se omite la eliminación
   - Esto previene eliminar términos cuando Strapi está limpiando versiones draft/publicadas
   
   **PASO 2: Verificar existencia real en BD**
   - Se consulta la BD directamente para verificar que la entidad realmente fue eliminada
   - Si aún existe en BD, se omite la eliminación del término
   - Esto previene eliminar términos en operaciones internas de Strapi
   
   **PASO 3: Verificar otros registros usando el mismo externalId**
   - Se busca si hay otras entidades (del mismo tipo) usando el mismo `externalId`
   - Si otros registros comparten el término, se omite la eliminación para esa plataforma
   - Esto previene eliminaciones en cascada cuando múltiples entidades comparten un término

3. Solo si **todas las verificaciones pasan**, se procede a eliminar:
   - Se obtiene el `externalId` guardado (desde BD o result)
   - Se elimina el término en WooCommerce usando DELETE con el ID
   - Se maneja 404 como éxito (término ya estaba eliminado)

**Estrategia clave:**
- **`documentId` como slug**: Permite matching preciso y evita duplicados
- **`externalId` para actualizar**: Usa directamente el ID guardado con PUT, incluyendo `slug` explícitamente para evitar que WooCommerce lo regenere
- **Lógica simple y unificada**: Todas las entidades (Autor, Editorial, Obra, Sello, Colección, Marca) usan la misma implementación
- **Protección robusta en DELETE**: Tres capas de verificación previenen eliminaciones incorrectas por interferencias de draft/publish o datos compartidos

**Logs que verás:**

**CREATE:**
```
[autor] ✅ Autor "Gabriel García Márquez" sincronizado a WooCommerce (tiempo real)
[woo-sync] Autor "Gabriel García Márquez" sincronizado a woo_moraleja
```

**UPDATE:**
```
[autor] 🔍 afterUpdate ejecutado para autor 5 - nombre: "Gabriel García Márquez"
[woo-sync] Autor "Gabriel García Márquez" actualizado en woo_moraleja (ID: 123)
[autor] ✅ Autor "Gabriel García Márquez" sincronizado a WooCommerce (tiempo real)
```

**DELETE (con protección):**
```
[autor] 🔍 afterDelete ejecutado para autor 147 (documentId: abc123...) - nombre: "Autor Viejo"
[autor] ⏭️  afterDelete omitido: existen otros autores con mismo documentId (173), probablemente draft/publish
```

O si realmente se elimina:
```
[autor] 🔍 afterDelete ejecutado para autor 147 (documentId: abc123...) - nombre: "Autor Eliminado"
[autor] ✅ Término eliminado de woo_moraleja: 123
```

---

### 2. WooCommerce → Strapi (Webhook)

**Problema actual:** ❌ **NO FUNCIONA AUTOMÁTICAMENTE**

WooCommerce **NO envía webhooks** cuando se crea/actualiza un término de atributo. Solo envía webhooks para:
- `product.created`
- `product.updated`
- `product.deleted`
- `customer.created`
- `order.created`
- etc.

**Eventos que NO existen en WooCommerce:**
- `product_attribute_term.created` ❌
- `product_attribute_term.updated` ❌
- `product_attribute_term.deleted` ❌

---

## 🛠️ Soluciones

### Opción 1: Sincronización Manual (✅ IMPLEMENTADA)

Usa el endpoint de sincronización manual cuando agregues/modifiques términos en WooCommerce:

```bash
# Sincronizar un término específico desde WooCommerce a Strapi
POST /api/woo-webhook/sync-term/:platform
```

**Parámetros:**
- `platform`: `woo_moraleja` o `woo_escolar` (en la URL)
- Body:
```json
{
  "attributeName": "Autor",
  "termName": "Gabriel García Márquez"
}
```

**Ejemplo con curl:**
```bash
curl -X POST "https://strapi.moraleja.cl/api/woo-webhook/sync-term/woo_moraleja" \
  -H "Content-Type: application/json" \
  -d '{
    "attributeName": "Autor",
    "termName": "Gabriel García Márquez"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Término sincronizado exitosamente",
  "data": {
    "success": true,
    "platform": "woo_moraleja",
    "attributeName": "Autor",
    "termName": "Gabriel García Márquez",
    "termDescription": "Biografía del autor...",
    "strapiId": 3,
    "wooAttributeId": 8,
    "wooTermId": 42
  }
}
```

**Atributos soportados:**
- `Autor` → Sincroniza a Content Type `Autor` con `resegna` (blocks)
- `Obra` → Sincroniza a Content Type `Obra` con `descripcion` (text)
- `Editorial` → Sincroniza a Content Type `Editorial`
- `Sello` → Sincroniza a Content Type `Sello`
- `Colección` / `Coleccion` → Sincroniza a Content Type `Colección`
- `Marca` → Sincroniza a Content Type `Marca`

**Logs que verás:**
```
[woo-webhook] Iniciando sincronización manual de término: "Gabriel García Márquez" del atributo "Autor" desde woo_moraleja
[woo-webhook] Atributo encontrado: "Autor" (ID: 8)
[woo-webhook] Término encontrado: "Gabriel García Márquez" con descripción: Sí
[woo-webhook] ✅ Autor sincronizado: "Gabriel García Márquez" → ID: 3
```

### Opción 2: Sincronización desde Producto

Cuando se actualiza un producto en WooCommerce, el webhook incluye los atributos:

```json
{
  "id": 9256,
  "name": "Cien años de soledad",
  "attributes": [
    {
      "id": 8,
      "name": "Autor",
      "options": ["Gabriel García Márquez"]
    }
  ]
}
```

El webhook actual **SÍ procesa estos atributos** y sincroniza los términos a Strapi.

**Problema:** Si solo modificas el término (descripción) sin tocar el producto, no se activa el webhook.

### Opción 3: Script de Sincronización Periódica

Ejecutar periódicamente un script que:
1. Obtiene todos los términos de atributos desde WooCommerce
2. Compara con Strapi
3. Sincroniza los cambios

---

## 📝 Cómo Agregar un Nuevo Término

### Desde WooCommerce:

1. **Ir a:** Productos → Atributos → [Seleccionar atributo, ej: "Autor"]
2. **Agregar término:**
   - Nombre: "Nuevo Autor"
   - Descripción: "Biografía del nuevo autor..."
3. **Guardar**

**⚠️ Problema:** Esto NO activa ningún webhook automáticamente.

**✅ Solución:** Después de agregar el término, ejecuta:

```bash
# Opción A: Actualizar cualquier producto que use ese atributo
# Esto activará el webhook de producto y sincronizará el término

# Opción B: Usar el endpoint de sincronización manual (si está implementado)
POST /api/woo-webhook/sync-term/woo_moraleja
```

### Desde Strapi:

1. **Crear/Actualizar Autor** en Strapi (o Editorial, Obra, Sello, Colección, Marca)
2. **✅ Se sincroniza automáticamente** a WooCommerce vía lifecycle hooks
3. El término se crea/actualiza en WooCommerce con:
   - **Slug**: `documentId` de Strapi (ej: `"abc123def456"`)
   - **Nombre**: Nombre de la entidad
   - **Descripción**: Convertida desde `resegna` o `descripcion`
4. El `externalId` (WooCommerce term ID) se guarda automáticamente en Strapi

**Nota**: No necesitas asignar el autor a un libro para que se sincronice. Se sincroniza directamente cuando creas/actualizas el autor.

---

## 🔍 Verificar Sincronización

### Ver logs de sincronización:

Busca en los logs de Railway/Strapi:

```
# Sincronización Strapi → WooCommerce
[woo-sync] Procesando Autor: ...
[woo-sync] ✅ Creando término Autor: "..." para atributo X
[woo-sync] Término "..." creado/obtenido para atributo X con descripción

# Sincronización WooCommerce → Strapi (webhook)
[woo-webhook] Producto extraído desde woo_moraleja
[woo-webhook] Procesando atributo: "autor" = "Gabriel García Márquez"
[woo-webhook] Detalles del término obtenidos: nombre="...", descripción="..."
[woo-webhook] Autor creado/actualizado: ... con descripción
```

### Verificar en WooCommerce:

1. **Productos → Atributos → Autor**
2. **Ver términos:** Deberías ver todos los autores sincronizados
3. **Clic en un término:** Deberías ver la descripción (si fue sincronizada)

### Verificar en Strapi:

1. **Content Manager → Autor**
2. **Buscar autor:** Deberías ver el autor con `resegna` (si fue sincronizado desde WooCommerce)

---

## ⚠️ Limitaciones Actuales

1. **❌ No hay webhook automático para términos:**
   - WooCommerce no envía webhooks cuando se crea/actualiza un término
   - Solo se sincroniza cuando se actualiza el producto completo

2. **❌ Sincronización unidireccional para términos nuevos:**
   - Si creas un término en WooCommerce sin tocar el producto, no se sincroniza automáticamente
   - Necesitas actualizar un producto o usar sincronización manual

3. **✅ Sincronización bidireccional para descripciones:**
   - Si el término ya existe y solo cambias la descripción, se sincroniza cuando se actualiza el producto

---

## 🚀 Mejoras Implementadas

1. **✅ Uso de `documentId` como slug en WooCommerce:**
   - Permite matching preciso entre Strapi y WooCommerce
   - Evita duplicados al usar identificador único
   - Búsqueda eficiente por slug en lugar de nombre
   - **Estado:** ✅ Implementado y funcionando

2. **✅ Actualización directa con `externalId` y `slug` explícito:**
   - Actualización directa usando PUT con el ID guardado (más eficiente)
   - **Incluye `slug` explícitamente** en el payload para evitar que WooCommerce lo regenere
   - Si falla (404), usa `getOrCreateAttributeTerm()` como fallback robusto
   - No requiere búsqueda por slug/nombre cuando ya existe `externalId`
   - Lógica simple y confiable
   - **Estado:** ✅ Implementado y funcionando

3. **✅ Campo `externalIds` en entidades:**
   - Se guarda `{ woo_moraleja: 123, woo_escolar: 456 }`
   - Permite tracking de términos en múltiples plataformas
   - **Estado:** ✅ Implementado y funcionando en todas las entidades

4. **✅ Protección robusta en `afterDelete` (implementado para todas las entidades):**
   - **Verificación 1**: Previene eliminación si existen otros registros con mismo `documentId` (draft/publish)
   - **Verificación 2**: Verifica que la entidad realmente no existe en BD antes de eliminar
   - **Verificación 3**: Previene eliminación si otros registros comparten el mismo `externalId`
   - Evita interferencias entre procesos de actualización/eliminación
   - **Estado:** ✅ Implementado y funcionando en Autor, Editorial, Obra, Sello, Colección, Marca

5. **✅ Logging de debugging en `afterUpdate`:**
   - Registra cuando se ejecuta `afterUpdate` con ID y nombre de la entidad
   - Facilita troubleshooting de problemas de sincronización
   - **Estado:** ✅ Implementado en todas las entidades

6. **✅ Lógica unificada para todas las entidades:**
   - Autor, Editorial, Obra, Sello, Colección y Marca usan la misma implementación
   - Mismos métodos de sincronización (`sync*Term()`)
   - Misma protección en `afterDelete`
   - Mismo logging de debugging
   - **Estado:** ✅ Implementado y funcionando

7. **✅ Endpoint de sincronización manual de términos:**
   ```typescript
   POST /api/woo-webhook/sync-term/:platform
   ```
   **Estado:** ✅ Implementado y funcionando

8. **✅ Scripts de prueba y utilidades:**
   - `test-autor-completo.mjs`: Prueba completa CRUD de autores
   - `test-actualizar-autor.mjs`: Prueba específica de actualización
   - `resincronizar-autores.mjs`: Resincroniza todos los autores desde Strapi
   - **Estado:** ✅ Disponibles para testing

## 🚀 Mejoras Sugeridas (Futuras)

1. **Script de sincronización periódica:**
   - Ejecutar cada X horas
   - Comparar términos entre WooCommerce y Strapi
   - Sincronizar diferencias

3. **Webhook personalizado (si es posible):**
   - Configurar en WooCommerce un webhook personalizado
   - Escuchar eventos de términos (si WooCommerce lo permite)

4. **Notificación cuando se crea término en WooCommerce:**
   - Alertar al usuario que debe sincronizar manualmente
   - O ejecutar sincronización automática después de X minutos

---

## 📚 Referencias

- [WooCommerce REST API - Product Attributes](https://woocommerce.github.io/woocommerce-rest-api-docs/#product-attributes)
- [WooCommerce REST API - Product Attribute Terms](https://woocommerce.github.io/woocommerce-rest-api-docs/#product-attribute-terms)
- [Strapi Lifecycle Hooks](https://docs.strapi.io/dev-docs/backend-customization/models#lifecycle-hooks)




