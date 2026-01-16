# Data Model Registry

Repositorio declarativo del modelo de datos. Todas las entidades, enums y relaciones viven en `registry/` y los generadores producen artefactos para Strapi u otros consumidores.

## Flujo básico

1. Edita o crea archivos YAML dentro de `registry/entities`, `registry/enums` y `registry/relations`.
2. Ejecuta `npm install` dentro de `data-model/` la primera vez para instalar dependencias (`js-yaml`).
3. Corre `npm run model:sync` para regenerar los `schema.json` de Strapi (y futuros artefactos como tipos o SQL).
4. Levanta Strapi; en `bootstrap` se reporta el conteo de elementos cargados desde el registry.

Los scripts `generate-types.mjs`, `generate-sql.mjs` y `validate-imports.mjs` están definidos como *stubs* y se completarán a medida que avance la migración.
