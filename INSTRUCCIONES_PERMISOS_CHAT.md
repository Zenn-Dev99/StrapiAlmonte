# Instrucciones para Corregir Permisos de remitente_id en Chat

## Problema
Los mensajes de otros usuarios no se muestran porque Strapi está ocultando el campo `remitente_id` debido a restricciones de permisos.

## Solución Rápida (Manual - 5 minutos)

### Paso 1: Abrir Panel de Strapi
1. Ve a: `https://strapi.moraleja.cl/admin` (o tu URL de Strapi)
2. Inicia sesión como administrador

### Paso 2: Ir a Permisos
1. **Settings** (Configuración) → **Users & Permissions plugin** → **Roles**

### Paso 3: Corregir Permisos
Para **cada rol** (especialmente `Authenticated`):

1. Haz clic en el nombre del rol
2. Busca permisos de `intranet-chat`
3. Para cada permiso (find, findOne):
   - Si hay una sección **"Fields"**:
     - Verifica que `remitente_id` esté en la lista
     - Si NO está, agrégalo
   - Si NO hay restricción de campos → ✅ Está bien
4. **Guarda** los cambios

### Campos que DEBEN estar permitidos:
- ✅ `texto`
- ✅ `remitente_id` ← **CRÍTICO**
- ✅ `cliente_id`
- ✅ `fecha`
- ✅ `leido`

## Verificación
Después de guardar:
1. Abre el chat en la aplicación
2. Abre la consola del navegador (F12)
3. Si NO ves errores `[Chat] ⚠️⚠️⚠️ ERROR CRÍTICO: Mensaje sin remitente_id` → ✅ Problema resuelto




