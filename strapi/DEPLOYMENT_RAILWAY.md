Deployment to Railway (strapi.moraleja.cl)

Overview
- Flow: push to GitHub -> Railway builds and deploys -> Strapi runs on Postgres + Cloudflare R2.
- Content types are versioned (src/api, src/components). Do not edit them in production.
- Data transfer uses Strapi Data Transfer CLI.

Prerequisites
- GitHub repo connected to Railway.
- Railway project with:
  - Service: Strapi app (Node). Auto-deploy from main branch.
  - Plugin: PostgreSQL (or external Postgres credentials).
  - Domain: strapi.moraleja.cl (via Railway domain config / your DNS).

Package scripts
- build: `strapi build`
- start: `strapi start`

Environment Variables (Railway)
- NODE_ENV=production
- URL=https://strapialmonte-production.up.railway.app
  ⚠️ IMPORTANTE: La URL debe ser solo el dominio con protocolo (https://), sin paths adicionales.
  Ejemplo correcto: `https://strapialmonte-production.up.railway.app`
  Ejemplo incorrecto: `strapialmonte-production.up.railway.app` (falta https://)
  Ejemplo incorrecto: `https://strapialmonte-production.up.railway.app/admin` (tiene path)
- HOST=0.0.0.0
- PORT=8080 (Railway proporciona PORT automáticamente, pero puedes fijarlo)
- ADMIN_PATH=/admin (opcional, por defecto es /admin)
- TZ=America/Santiago (zona horaria de Chile)

Secrets (generate unique values)
- APP_KEYS: CSV of 4 values
- API_TOKEN_SALT
- ADMIN_JWT_SECRET
- JWT_SECRET
- TRANSFER_TOKEN_SALT
- ENCRYPTION_KEY

Database (choose URL or discrete vars)
- DATABASE_CLIENT=postgres
- DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
  or
- DATABASE_HOST
- DATABASE_PORT=5432
- DATABASE_NAME
- DATABASE_USERNAME
- DATABASE_PASSWORD
- DATABASE_SSL=true
- DATABASE_SSL_REJECT_UNAUTHORIZED=false

Uploads: Cloudflare R2 via S3 provider
- S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
- S3_REGION=auto
- S3_BUCKET=<bucket-name>
- S3_ACCESS_KEY_ID=<r2-access-key>
- S3_SECRET_ACCESS_KEY=<r2-secret>
- S3_BASE_URL=https://media.moraleja.cl  (optional CDN/public host)
- S3_FORCE_PATH_STYLE=true

Hardening
- STRAPI_ENABLE_CONTENT_TYPE_BUILDER=false

CORS/CSP
- Already configured in `config/middlewares.ts` to allow media from your R2/CDN and origins:
  - https://strapi.moraleja.cl, https://intranet.moraleja.cl
  Adjust if you add more frontends.

Deploy Steps
1) Push to main (or create PRs and merge into main).
2) Railway builds with Nixpacks and deploys automatically.
3) Visit https://strapi.moraleja.cl/admin to finish the admin setup (first time) or login.

Data Transfer (entities and assets)
- Create a Transfer Token in Production:
  - Strapi Admin -> Settings -> Transfer Tokens -> Create (read/write).

- From local to production (full content):
  npx strapi transfer --to https://strapi.moraleja.cl \
    --to-token=<TOKEN> --to-secret=<SECRET>

- Only entities (no assets):
  npx strapi transfer --only entities --to https://strapi.moraleja.cl \
    --to-token=<TOKEN> --to-secret=<SECRET>

Notes
- If local uses filesystem uploads and prod uses R2, including assets will upload your local files to R2 during transfer.
- Prefer making content type changes locally and committing schema files; production should not allow Content-Type Builder.
- Keep .env out of Git. Use Railway variables for production secrets.

## Bootstrap maintenance tasks
- El arranque ya no ejecuta migraciones pesadas por defecto. Habilítalas puntualmente agregando la variable correspondiente (`BOOTSTRAP_MIGRATE_ESTADOS`, `BOOTSTRAP_BACKFILL_TELEFONO`, etc.) en Railway antes de reiniciar, o ejecuta `npm run maintenance:<tarea>` para correrlas on-demand.
- Para ver la lista completa ejecuta `npm run maintenance:run` sin argumentos o revisa `scripts/run-maintenance-tasks.cjs`.

## Data migrations útiles
- `npm run migrate:product:sales-channels` genera el nuevo componente de canales de venta a partir de los campos históricos (`price_editorial`, `price_libreria`, `tienda_url`, etc.). Ejecutar antes de limpiar columnas.
- `npm run migrate:product:book-meta` lleva `genre`, `subgenre`, `edad/curso`, `idioma`, `editorial` (marca) y `isbn` desde los campos legacy hacia `specs.book-specs`.
- `npm run migrate:product:authors-component` copia la relación de autores a la sección Libro (componentes `contributors`) para que solo los productos tipo "book" la gestionen.
- `npm run migrate:product:clean-legacy` elimina las columnas antiguas (`publish_*`, `price_*`, `*_url`) una vez que toda la información está en componentes y `sales_channels`.
