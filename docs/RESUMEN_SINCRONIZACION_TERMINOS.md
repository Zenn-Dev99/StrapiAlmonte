# 🔄 Resumen de Sincronización de Términos WooCommerce

## 📋 Entidades Sincronizadas

Todas las siguientes entidades se sincronizan automáticamente entre Strapi y WooCommerce usando la misma lógica unificada:

- **Autor** → Product Attribute "Autor"
- **Editorial** → Product Attribute "Editorial"
- **Obra** → Product Attribute "Obra"
- **Sello** → Product Attribute "Sello"
- **Colección** → Product Attribute "Colección"
- **Marca** → Product Attribute "Marca"

## 🔄 Flujo de Sincronización

### CREATE (Crear)
1. Se crea entidad en Strapi
2. `afterCreate` llama a `sync*Term()` (ej: `syncAutorTerm()`)
3. Se crea término en WooCommerce usando `getOrCreateAttributeTerm()`
4. Se guarda `externalId` (WooCommerce term ID) en `externalIds[platform]`

### UPDATE (Actualizar)
1. Se actualiza entidad en Strapi
2. `afterUpdate` registra evento en logs (debugging)
3. Si existe `externalId`:
   - **PUT directo** a WooCommerce con:
     - `name`: Nombre actualizado
     - `slug`: `documentId` (explícito, para evitar regeneración)
     - `description`: Descripción actualizada
   - Si falla (404): fallback a `getOrCreateAttributeTerm()`
4. Si no existe `externalId`: usar `getOrCreateAttributeTerm()`

### DELETE (Eliminar)
1. Se elimina entidad en Strapi
2. `afterDelete` ejecuta **3 verificaciones de seguridad**:
   - ✅ Verificar que no hay otros registros con mismo `documentId` (draft/publish)
   - ✅ Verificar que la entidad realmente no existe en BD
   - ✅ Verificar que otros registros no compartan el mismo `externalId`
3. Solo si todas las verificaciones pasan:
   - DELETE término en WooCommerce usando `externalId`
   - Manejar 404 como éxito (ya eliminado)

## 🎯 Estrategias Clave

### 1. `documentId` como Slug
- Usa el `documentId` de Strapi como `slug` en WooCommerce
- Permite matching preciso y evita duplicados
- Esencial incluirlo explícitamente en UPDATE para evitar regeneración

### 2. `externalId` para Operaciones Directas
- Se guarda `{ woo_moraleja: 123, woo_escolar: 456 }` en cada entidad
- Permite UPDATE y DELETE directos sin búsquedas
- Más eficiente y confiable

### 3. Protección en DELETE
- Tres capas de verificación previenen eliminaciones incorrectas
- Evita interferencias de draft/publish
- Evita eliminaciones en cascada cuando se comparten términos

### 4. Lógica Unificada
- Todas las entidades usan la misma implementación
- Mismos métodos, misma protección, mismo logging
- Fácil de mantener y extender

## 📝 Archivos de Implementación

### Servicio Principal
- `strapi/src/api/woo-sync/services/woo-sync.ts`
  - `syncAutorTerm(autor)`
  - `syncEditorialTerm(editorial)`
  - `syncObraTerm(obra)`
  - `syncSelloTerm(sello)`
  - `syncColeccionTerm(coleccion)`

### Lifecycles (una por entidad)
- `strapi/src/api/autor/content-types/autor/lifecycles.ts`
- `strapi/src/api/editorial/content-types/editorial/lifecycles.ts`
- `strapi/src/api/obra/content-types/obra/lifecycles.ts`
- `strapi/src/api/sello/content-types/sello/lifecycles.ts`
- `strapi/src/api/coleccion/content-types/coleccion/lifecycles.ts`
- `strapi/src/api/marca/content-types/marca/lifecycles.ts`

## 🔍 Logs de Ejemplo

### CREATE
```
[autor] ✅ Autor "Gabriel García Márquez" sincronizado a WooCommerce (tiempo real)
[woo-sync] Autor "Gabriel García Márquez" sincronizado a woo_moraleja
```

### UPDATE
```
[autor] 🔍 afterUpdate ejecutado para autor 5 - nombre: "Gabriel García Márquez"
[woo-sync] Autor "Gabriel García Márquez" actualizado en woo_moraleja (ID: 123)
[autor] ✅ Autor "Gabriel García Márquez" sincronizado a WooCommerce (tiempo real)
```

### DELETE (protección activa)
```
[autor] 🔍 afterDelete ejecutado para autor 147 (documentId: abc123...) - nombre: "Autor"
[autor] ⏭️  afterDelete omitido: existen otros autores con mismo documentId (173), probablemente draft/publish
```

### DELETE (eliminación exitosa)
```
[autor] 🔍 afterDelete ejecutado para autor 147 (documentId: abc123...) - nombre: "Autor"
[autor] ✅ Término eliminado de woo_moraleja: 123
```

## ✅ Estado Actual

- ✅ CREATE funcionando para todas las entidades
- ✅ UPDATE funcionando para todas las entidades (sin duplicados, usando externalId)
- ✅ DELETE funcionando para todas las entidades (con protección robusta)
- ✅ Lógica unificada implementada
- ✅ Logging de debugging implementado
- ✅ Protección contra interferencias implementada

## 📚 Documentación Relacionada

- [COMO_FUNCIONAN_TERMINOS_ATRIBUTOS.md](./COMO_FUNCIONAN_TERMINOS_ATRIBUTOS.md) - Documentación detallada completa
- [ESTRUCTURA_MAPPERS_WOOCOMMERCE.md](./ESTRUCTURA_MAPPERS_WOOCOMMERCE.md) - Estructura de mappers
