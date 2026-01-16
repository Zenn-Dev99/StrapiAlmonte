# Configurar mainField RUT en Persona

## Problema
El combobox de Persona en Colaboradores muestra IDs (1001, 1002) en lugar de RUTs.

## Solución Automática
El bootstrap debería configurarlo automáticamente al iniciar Strapi. Si no funciona, sigue estos pasos:

## Solución Manual

### Opción 1: Ejecutar endpoint de maintenance

1. Obtén tu API Token de Strapi (Settings → API Tokens)
2. Ejecuta este comando (reemplaza `TU_TOKEN` y `TU_URL_STRAPI`):

```bash
curl -X POST https://TU_URL_STRAPI/api/maintenance/content-manager-sync \
  -H "Authorization: Bearer TU_TOKEN"
```

O desde el navegador (con autenticación):
```
https://TU_URL_STRAPI/api/maintenance/content-manager-sync
```

### Opción 2: Configurar desde el Admin de Strapi

1. Ve a **Settings → Content Manager → Configuration**
2. Busca **"Persona"** en la lista
3. En **"Main field"**, selecciona **"rut"**
4. Guarda los cambios
5. Busca **"Colaborador"** en la lista
6. Expande **"persona"** en las relaciones
7. En **"Main field"** de la relación persona, selecciona **"rut"**
8. Guarda los cambios
9. Reinicia Strapi

### Opción 3: Verificar que las Personas tengan RUT

Si algunas Personas no tienen RUT, Strapi mostrará el ID como fallback. Asegúrate de que todas las Personas tengan el campo `rut` lleno.

## Verificar que funcionó

1. Ve a **Content Manager → Colaboradores**
2. Crea o edita un Colaborador
3. En el campo **"persona"**, deberías ver RUTs (ej: "923292399") en lugar de IDs (ej: "1001")












