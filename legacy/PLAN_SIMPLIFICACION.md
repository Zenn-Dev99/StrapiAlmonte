# 📋 Plan de Simplificación - Colegio y Componente Dirección

## 🎯 Objetivos

1. **Simplificar relaciones geográficas**: Eliminar relaciones redundantes (region, provincia, zona) y mantener solo `comuna`
2. **Limpiar componente dirección**: Eliminar campos de verificación no usados (las interacciones se llevan en otra colección)
3. **Optimizar controladores**: Derivar región/provincia desde comuna en lugar de hacer joins innecesarios

## 📊 Cambios Propuestos

### 1. Simplificación del Schema de Colegio

#### ❌ Eliminar (Relaciones redundantes)
- `region` (manyToOne) - Derivar desde comuna
- `provincia` (manyToOne) - Derivar desde comuna  
- `zona` (manyToOne) - Derivar desde comuna.provincia.zona

#### ✅ Mantener
- `comuna` (manyToOne) - Relación principal

### 2. Simplificación del Componente Dirección

#### ❌ Eliminar (Campos de verificación no usados)
- `estado` (enumeration) - No se usa, las interacciones están en otra colección
- `verificada_por` (string) - No se usa
- `fecha_verificacion` (date) - No se usa
- `aprobado_por` (string) - No se usa
- `fecha_aprobacion` (date) - No se usa
- `region` (relation) - Redundante, ya está en Colegio

#### ✅ Mantener
- `direccion_principal_envio_facturacion` (enumeration)
- `comuna` (relation) - Útil para direcciones específicas
- `nombre_calle` (string)
- `numero_calle` (string)
- `complemento_direccion` (string)
- `tipo_direccion` (enumeration)

### 3. Actualización del Controlador

#### Cambios en `colegio.ts`
- Eliminar `region` del populate
- Obtener región desde `comuna.provincia.region` cuando sea necesario
- Simplificar la lógica de location

### 4. Actualización de Lifecycles

#### Cambios en `src/index.js`
- Eliminar lógica de enriquecimiento de `provincia`, `region`, `zona`
- Mantener solo lógica necesaria para `comuna`

## 🔄 Migración de Datos

### Paso 1: Verificar datos existentes
```bash
# Verificar cuántos colegios tienen relaciones geográficas
npm run audit:fields
```

### Paso 2: Migrar datos (si es necesario)
- Los datos de región/provincia/zona ya están en comuna
- No se pierde información, solo se elimina redundancia

### Paso 3: Actualizar scripts de importación
- Los scripts que usan region/provincia/zona deben actualizarse para usar solo comuna

## ⚠️ Consideraciones

1. **Scripts de importación**: Muchos scripts usan region/provincia/zona - necesitarán actualización
2. **APIs externas**: Verificar que no haya APIs que dependan de relaciones directas
3. **Frontend**: Verificar que el frontend no dependa de relaciones directas

## 📝 Archivos a Modificar

1. `src/api/colegio/content-types/colegio/schema.json` - Eliminar relaciones
2. `src/components/contacto/direccion.json` - Eliminar campos de verificación
3. `src/api/colegio/controllers/colegio.ts` - Actualizar controlador
4. `src/index.js` - Simplificar lifecycles
5. Scripts de importación - Actualizar para usar solo comuna

---

**Estado**: ⏳ Pendiente de implementación
**Rama**: test/cursor-database-fix

