# Configuración de Cron Job en Railway

## Sincronización Automática cada 45 minutos

Este documento explica cómo configurar la sincronización periódica bidireccional de términos entre Strapi y WooCommerce para que se ejecute automáticamente cada 45 minutos en Railway.

## 📋 Requisitos Previos

1. **Railway Project** con el servicio Strapi desplegado
2. **Variables de entorno** configuradas:
   - `STRAPI_API_TOKEN` (requerido)
   - `STRAPI_URL` (opcional, por defecto: `https://strapi.moraleja.cl`)
   - `PLATFORM` (opcional, por defecto: `woo_moraleja`)
   - `RECENT_HOURS` (opcional, por defecto: `1`)

## 🚀 Opción 1: Usar Railway Cron Service (Recomendado)

Railway soporta servicios cron nativos. Sigue estos pasos:

### 1. Crear un nuevo servicio Cron en Railway

1. Ve a tu proyecto en Railway
2. Haz clic en **"+ New"** → **"Cron Job"**
3. Configura el servicio:

**Nombre del servicio:** `sync-woocommerce-terms`

**Cron Schedule:** `*/45 * * * *` (cada 45 minutos)

**Start Command:**
```bash
node scripts/sincronizacion-cron.mjs
```

**Working Directory:** `/` (raíz del proyecto)

### 2. Configurar Variables de Entorno

En el servicio cron, agrega las mismas variables de entorno que tiene tu servicio Strapi:

- `STRAPI_API_TOKEN` (copiar del servicio Strapi)
- `STRAPI_URL=https://strapi.moraleja.cl` (opcional)
- `PLATFORM=woo_moraleja` (opcional)
- `RECENT_HOURS=1` (opcional, recomendado para ejecuciones cada 45 min)

### 3. Configurar Build Settings

**Build Command:** (dejar vacío o usar el mismo del servicio Strapi)
```bash
npm install
```

**Root Directory:** `/` (raíz del proyecto)

## 🚀 Opción 2: Usar Cron dentro del servicio Strapi

Si prefieres ejecutar el cron dentro del mismo servicio Strapi, puedes usar un plugin de cron o configurarlo en el código.

### Usando node-cron dentro de Strapi

1. Instalar `node-cron`:
```bash
cd strapi
npm install node-cron
```

2. Crear un archivo de inicialización de cron en Strapi:
```typescript
// strapi/src/index.ts o crear strapi/src/config/cron.ts
import cron from 'node-cron';
import fetch from 'node-fetch';

export default {
  register({ strapi }) {
    // Ejecutar cada 45 minutos
    cron.schedule('*/45 * * * *', async () => {
      const STRAPI_URL = process.env.URL || 'https://strapi.moraleja.cl';
      const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
      const PLATFORM = process.env.PLATFORM || 'woo_moraleja';
      const RECENT_HOURS = process.env.RECENT_HOURS || '1';

      if (!STRAPI_API_TOKEN) {
        strapi.log.error('[cron] STRAPI_API_TOKEN no configurado');
        return;
      }

      try {
        const url = new URL(`/api/woo-webhook/sync-all/${PLATFORM}`, STRAPI_URL);
        url.searchParams.set('recentHours', RECENT_HOURS);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          strapi.log.info(`[cron] Sincronización completada: ${result.data?.summary?.totalSincronizados || 0} términos`);
        } else {
          strapi.log.error(`[cron] Error en sincronización: ${response.status}`);
        }
      } catch (error) {
        strapi.log.error('[cron] Error ejecutando sincronización:', error);
      }
    });

    strapi.log.info('[cron] Sincronización automática configurada: cada 45 minutos');
  },
};
```

## 🚀 Opción 3: Usar Railway Scheduled Tasks (si está disponible)

Railway puede tener soporte para scheduled tasks. Consulta la documentación actual de Railway para esta opción.

## ⚙️ Optimizaciones Aplicadas

### Script `sincronizacion-cron.mjs`

- **`recentHours=1`**: Ventana de tiempo optimizada para ejecuciones cada 45 minutos
- **Timeout de 5 minutos**: Evita ejecuciones colgadas
- **Logging optimizado**: Solo información esencial
- **Manejo de errores mejorado**: Exit codes apropiados para monitoreo

### Código de Sincronización

- **Paginación completa**: Obtiene todos los términos, no solo los primeros 100
- **Campos mínimos**: Solo obtiene los campos necesarios de Strapi (optimización de consultas)
- **Uso de objeto term completo**: Evita búsquedas redundantes
- **Filtrado inteligente**: Solo sincroniza cambios recientes

## 📊 Monitoreo

### Ver logs del cron en Railway

1. Ve al servicio cron en Railway
2. Haz clic en **"Logs"** para ver la salida del script
3. Busca mensajes como:
   - `✅ Sincronización completada`
   - `❌ Error en la sincronización`

### Verificar ejecución

El script registra:
- Tiempo de ejecución
- Número de términos sincronizados
- Número de errores (si los hay)

## 🔧 Troubleshooting

### El cron no se ejecuta

1. Verifica que el cron schedule esté correcto: `*/45 * * * *`
2. Revisa los logs del servicio cron en Railway
3. Verifica que `STRAPI_API_TOKEN` esté configurado

### La sincronización falla

1. Revisa los logs del servicio cron
2. Verifica que el endpoint `/api/woo-webhook/sync-all/:platform` esté accesible
3. Verifica que las credenciales de WooCommerce estén configuradas en Strapi

### La sincronización es muy lenta

1. Reduce `RECENT_HOURS` si es mayor a 1
2. Verifica la conexión a WooCommerce
3. Revisa los logs para ver qué atributos están causando lentitud

## 📝 Notas Importantes

- **Ventana de tiempo**: Con `recentHours=1` y ejecución cada 45 minutos, hay un margen de 15 minutos para capturar cambios
- **No re-sincroniza todo**: Solo sincroniza cambios nuevos o modificados en la ventana de tiempo
- **Prevención de bucles**: El sistema compara timestamps para evitar sincronizaciones infinitas
- **Timeout**: Si la sincronización tarda más de 5 minutos, se cancela automáticamente

## 🔄 Actualizar Frecuencia

Para cambiar la frecuencia de ejecución, modifica el cron schedule:

- **Cada 30 minutos**: `*/30 * * * *`
- **Cada hora**: `0 * * * *`
- **Cada 2 horas**: `0 */2 * * *`
- **Cada 45 minutos**: `*/45 * * * *` (actual)

## 📚 Referencias

- [Railway Cron Jobs Documentation](https://docs.railway.app/guides/cron-jobs)
- [Cron Expression Syntax](https://crontab.guru/)
- Documentación de sincronización: `docs/SINCRONIZACION_PERIODICA_BIDIRECCIONAL.md`




