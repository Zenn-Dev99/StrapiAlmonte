# 🔗 Integración Notion ↔ Strapi

Servicio para sincronizar datos entre Notion y Strapi automáticamente.

## 📋 Resumen

Este servicio permite:
- **Notion → Strapi**: Sincronizar bases de datos de Notion a Strapi automáticamente
- **Sincronización bidireccional**: Opcionalmente, actualizar Notion cuando cambias datos en Strapi
- **Colecciones específicas**: Mapear bases de datos de Notion a content types de Strapi
- **Sincronización programada**: Ejecutar automáticamente en intervalos configurados

## 🔑 Configuración

### 1. Obtener API Key de Notion

1. Ve a https://www.notion.so/my-integrations
2. Crea una nueva integración o usa una existente
3. Copia el **Internal Integration Token** (empieza con `secret_`)
4. Comparte las bases de datos que quieres sincronizar con esta integración

### 2. Obtener IDs de Bases de Datos de Notion

Cada base de datos de Notion tiene un ID único:
- Abre la base de datos en Notion
- Copia la URL: `https://www.notion.so/workspace/[DATABASE_ID]?v=...`
- El `DATABASE_ID` es el ID que necesitas (32 caracteres, separado por guiones)

**Ejemplo**: 
- URL: `https://www.notion.so/workspace/1234567890abcdef1234567890abcdef?v=...`
- Database ID: `1234567890abcdef1234567890abcdef`

### 3. Configurar Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
# Notion API
NOTION_API_KEY=secret_tu_api_key_aqui
NOTION_API_VERSION=2022-06-28

# IDs de Bases de Datos de Notion
NOTION_DB_AUTORES=database_id_autores
NOTION_DB_LIBROS=database_id_libros

# Strapi API
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=tu_token_aqui
```

## 🚀 Instalación

```bash
cd backend/services/notion-sync
npm install
```

## 🚀 Uso

### Sincronización Manual

```bash
# Sincronizar solo autores
npm run sync:autores

# O ejecutar directamente
tsx src/cli/sync-autores.ts
```

### Sincronización Automática (Cron)

Puedes configurar un cron job para sincronizar automáticamente:

```bash
# Sincronizar cada hora
0 * * * * cd /path/to/backend/services/notion-sync && npm run sync:autores

# Sincronizar cada día a las 2 AM
0 2 * * * cd /path/to/backend/services/notion-sync && npm run sync:autores
```

## 🔄 Mapeo de Campos

### Autores (Notion → Strapi)

| Notion (propiedad) | Strapi (campo) | Tipo |
|-------------------|----------------|------|
| `id_autor` | `id_autor` | Texto/Número |
| `nombre_completo_autor` o `nombre` | `nombre_completo_autor` | Título |
| `tipo_autor` | `tipo_autor` | Select (Persona/Empresa) |
| `resegna` | `resegna` | Rich Text |
| `website` | `website` | URL |
| `foto` | `foto_url` | URL/File |

## 📝 Estructura de la Base de Datos en Notion

### Autores

Crea una base de datos en Notion con estas propiedades:

- **id_autor** (Text o Number) - ID único del autor
- **nombre_completo_autor** (Title) - Nombre completo del autor
- **tipo_autor** (Select) - Opciones: "Persona", "Empresa"
- **resegna** (Text o Rich Text) - Biografía del autor
- **website** (URL) - Sitio web del autor
- **foto** (Files & media o URL) - Foto del autor

## 🔄 Flujo de Sincronización

1. **Conectar a Notion**: Autenticar usando API key
2. **Obtener datos**: Consultar base de datos de Notion
3. **Transformar datos**: Mapear campos de Notion a Strapi
4. **Sincronizar con Strapi**:
   - Si existe (por `id_autor`) → Actualizar
   - Si no existe → Crear
5. **Registrar cambios**: Log de lo que se sincronizó

## 🛠️ Desarrollo

```bash
# Modo desarrollo (watch mode)
npm run dev

# Compilar TypeScript
npm run build

# Ejecutar compilado
npm start
```

## 📚 Recursos

- [Notion API Documentation](https://developers.notion.com/reference/intro)
- [Notion API SDK (Node.js)](https://github.com/makenotion/notion-sdk-js)
