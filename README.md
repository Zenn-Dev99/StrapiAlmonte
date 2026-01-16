# BD2025 - Strapi Backend

Backend con Strapi CMS para gestión de contenido.

## 🚀 Despliegue en Railway

Este repositorio está optimizado para desplegarse en Railway.

### Configuración

- **Root Directory**: `strapi` (configurado en `railway.json`)
- **Build Command**: `npm run build` (ejecutado desde `strapi/`)
- **Start Command**: `npm start` (ejecutado desde `strapi/`)

### Variables de Entorno Requeridas

Ver `strapi/DEPLOYMENT_RAILWAY.md` para la lista completa de variables de entorno.

### Estructura del Repositorio

```
.
├── strapi/              # Aplicación Strapi
│   ├── src/            # Código fuente
│   ├── config/         # Configuraciones
│   ├── database/       # Migraciones
│   └── package.json    # Dependencias
├── railway.json        # Configuración de Railway
└── README.md          # Este archivo
```

## 📝 Notas

- Los archivos de media (`public/uploads/`) deben estar en S3/R2, no en este repositorio
- Los datos de desarrollo (`data/`, `backups/`) no están incluidos en este repo
- Ver `.gitignore` para ver qué archivos están excluidos
