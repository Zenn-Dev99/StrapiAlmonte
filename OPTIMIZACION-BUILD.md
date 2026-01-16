# Optimización del Build de Strapi

## Problema Identificado
El build está tardando ~13 minutos, lo cual es excesivo para un proyecto Strapi.

## Causas Potenciales

1. **Muchos Content-Types**: Más de 60 content-types que TypeScript debe compilar
2. **Falta de Memoria**: El build no tenía `NODE_OPTIONS` configurado (a diferencia del script `develop`)
3. **TypeScript `noEmitOnError: true`**: Si hay errores, puede causar reintentos

## Optimizaciones Aplicadas

### 1. Aumentar Memoria para el Build
✅ **Aplicado**: Agregado `NODE_OPTIONS='--max-old-space-size=8192'` al script de build en `strapi/package.json`

```json
"build": "NODE_OPTIONS='--max-old-space-size=8192' strapi build"
```

### 2. Verificar Configuración TypeScript
El `tsconfig.json` ya tiene:
- ✅ `incremental: true` - Compilación incremental habilitada
- ✅ `skipLibCheck: true` - Omite verificación de tipos en node_modules
- ⚠️ `noEmitOnError: true` - Puede causar problemas si hay errores

## Recomendaciones Adicionales

### Si el build sigue siendo lento:

1. **Limpiar cache de TypeScript**:
   ```bash
   rm -rf strapi/.cache strapi/.tmp strapi/dist strapi/tsconfig.tsbuildinfo
   ```

2. **Verificar errores de TypeScript**:
   ```bash
   cd strapi
   npx tsc --noEmit
   ```

3. **Deshabilitar temporalmente `noEmitOnError`** para ver si hay errores que estén causando reintentos:
   ```json
   "noEmitOnError": false
   ```

4. **Usar build paralelo** (si Strapi lo soporta):
   - Verificar si hay opciones de build paralelo en Strapi v5

5. **Optimizar el número de content-types**:
   - Considerar si algunos content-types pueden ser combinados
   - Verificar si hay content-types duplicados o no utilizados

## Monitoreo

Después de aplicar las optimizaciones:
- Medir el tiempo de build nuevamente
- Verificar que no haya errores de TypeScript
- Confirmar que el build se complete exitosamente

## Notas

- El script `develop` ya tenía `NODE_OPTIONS='--max-old-space-size=8192'`
- El build ahora usa la misma configuración de memoria
- Con 60+ content-types, un build de 5-8 minutos sería más razonable
- Si sigue tardando 13+ minutos, puede haber errores de compilación o problemas de configuración
