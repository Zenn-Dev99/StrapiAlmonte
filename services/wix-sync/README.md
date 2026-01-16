# 🔗 Integración Wix CMS ↔ Strapi

Servicio para sincronizar datos entre Wix CMS (Content Manager) y Strapi automáticamente.

## 📋 Resumen

Sí, **se puede integrar Wix CMS con Strapi** usando la API REST de Wix. Este servicio permite sincronizar colecciones de contenido de Wix a Strapi automáticamente.

## 🔑 Configuración

### 1. Obtener Credenciales de Wix

Wix ofrece acceso a su Content Manager a través de:

1. **Wix Site ID**: ID único de tu sitio Wix
2. **Wix OAuth Token**: Recomendado para acceso completo al Content Manager
3. **Wix API Key**: Alternativa, puede tener limitaciones

**Pasos**:
1. Ve a https://dev.wix.com/
2. Crea una app o usa una existente
3. Configura OAuth para obtener tokens de acceso
4. Obtén el **Site ID** de tu sitio Wix
5. Genera un **OAuth Token** con permisos para Content Manager

### 2. Obtener IDs de Colecciones de Wix

1. Ve al Content Manager en tu sitio Wix
2. Abre la colección que quieres sincronizar
3. El ID de la colección aparece en la URL o configuración

### 3. Configurar Variables de Entorno

```env
# Wix API
WIX_SITE_ID=tu_site_id_aqui
WIX_API_KEY=tu_api_key_aqui
WIX_OAUTH_TOKEN=tu_oauth_token_aqui  # Recomendado

# IDs de Colecciones de Wix
WIX_COLLECTION_AUTORES=collection_id_autores
WIX_COLLECTION_LIBROS=collection_id_libros

# Strapi API
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=tu_token_aqui
```

## 🚀 Uso

```bash
# Instalar dependencias
npm install

# Sincronizar autores
npm run sync:autores

# Sincronizar todas las colecciones
npm run sync
```

## 📚 Recursos

- [Wix REST API Documentation](https://dev.wix.com/api/rest/getting-started)
- [Wix Content Manager API](https://dev.wix.com/api/rest/content-management/items)
- [Wix OAuth Setup](https://dev.wix.com/api/rest/getting-started/authentication)

## ⚠️ Notas Importantes

1. **Autenticación OAuth**: Wix recomienda usar OAuth tokens para acceso completo al Content Manager
2. **Rate Limits**: Wix tiene límites de rate. Implementa retry logic si es necesario
3. **Webhooks**: Wix también soporta webhooks para sincronización en tiempo real
