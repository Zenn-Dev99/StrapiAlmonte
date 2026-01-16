# Módulo de Noticias · Requerimientos para Strapi

Guía completa para que el proyecto Strapi implemente el blog/noticias de Moraleja con soporte editorial, SEO, mailing y automatizaciones.

---

## 1. Content types y componentes

### 1.1 Collection Type: `news-articles`
- `title` (string, requerido, máx. 160) – título público.
- `slug` (UID basado en `title`, requerido, único por idioma).
- `excerpt` (text, máx. ~300 caracteres) – resumen para cards/SEO.
- `body` (RichText/JSON/Markdown) – contenido completo.
- `hero_image` (media single) – imagen principal.
- `gallery` (media multiple) – opcional para galerías.
- `category` (many-to-one → `news-categories`, requerido).
- `tags` (many-to-many → `news-tags`).
- `author` (many-to-one → `news-authors`, requerido).
- `read_time` (integer) – minutos estimados.
- `is_featured` (boolean) – destacado portada.
- `pin_until` (datetime) – fecha límite para mantenerlo como destacado.
- `related_articles` (many-to-many self) – crosslink manual.
- `cta` (component `cta_block`, opcional) – CTA al final del artículo.
- `seo` (component `seo_meta`).
- `canonical_url` (string, opcional).
- `newsletter_sent` (boolean) – tracking de mailing.
- `publishedAt` (datetime) – gestionado por Strapi (mantener draft/publish habilitado).
- Localización activada si habrá multilenguaje.

### 1.2 Collection Type: `news-categories`
- `name` (string, requerido)
- `slug` (UID, requerido, único)
- `description` (text, opcional)
- `color` (string hex, opcional, para chips)
- `icon` (media, opcional)
- `is_public` (boolean, default true)

### 1.3 Collection Type: `news-tags`
- `name`, `slug`
- `description` (opcional)

### 1.4 Collection Type: `news-authors`
- `name` (string, requerido)
- `slug` (UID)
- `bio` (text)
- `avatar` (media)
- `position` / `team` (string)
- `social_links` (component repeatable: `platform` enum, `url`)
- `email` (string, opcional)
- `is_active` (boolean)

### 1.5 Component: `seo_meta`
- `metaTitle` (string)
- `metaDescription` (text)
- `metaImage` (media single)
- `metaRobots` (enum: `index_follow`, `noindex_follow`, etc.)
- `structuredData` (JSON)
- `canonicalURL` (string)
- `ogTitle`, `ogDescription` (opcional)

### 1.6 Component: `cta_block`
- `label` (string)
- `subtitle` (text corto)
- `button_text` (string)
- `button_url` (string)
- `style` (enum: `primary`, `secondary`, `outline`, etc.)

---

## 2. Roles, permisos y workflow

### 2.1 Roles recomendados
- **Autor**: crea y edita borradores propios.
- **Editor**: revisa y publica; gestiona categorías/tags/autores.
- **Marketing** (opcional): lectura + control de `newsletter_sent`.
- **Super Admin**: configuración general.

### 2.2 Permisos API (Rol Public)
Permitir `find` y `findOne` en `news-articles`, `news-categories`, `news-tags`, `news-authors` (sólo publicados). Bloquear `create/update/delete`.

### 2.3 Review workflow
- Etapas sugeridas: **Borrador → En revisión → Aprobado → Publicado** (mínimo 3 pasos).
- Validar `seo_meta`, hero y categoría en etapa de “En revisión”.

### 2.4 Releases / programación
- Activar plugin Content Releases para programar artículos embargados.
- Confirmar que `publishedAt` respeta la hora programada.

---

## 3. Integraciones y automatizaciones

### 3.1 Previsualización
- Configurar `Preview URL` en `news-articles`:  
  `https://moraleja.cl/noticias/preview?slug={slug}&secret=<TOKEN>`
- Generar token secreto para la integración con Next.js.

### 3.2 Webhooks
- **On publish/unpublish** de `news-articles`:
  - `POST` hacia endpoint en Next/Vercel para revalidar `/noticias` y `/noticias/[slug]`.
  - Opcional: `POST` a función que actualice índice Algolia o RSS.
- **On update** de categorías/tags: invalidar caché de menús/buscador.

### 3.3 Mailing / CRM
- Campo `newsletter_sent` para marcar si se envió boletín.
- Opcional: webhook a SendGrid/Hubspot al publicar (para crear campaña).

### 3.4 SEO
- `seo_meta` mapeará a metatags en frontend.
- `structuredData` permitirá inyectar JSON-LD (Article schema).
- Considere plugin `strapi-plugin-seo` si desean UI preconstruida.

---

## 4. Endpoints y populates sugeridos

### 4.1 Listado general
```
GET /api/news-articles
  ?populate[hero_image]=*
  &populate[category]=*
  &populate[tags]=*
  &populate[author][populate]=avatar
  &filters[status][$ne]=archived
  &sort[0]=publishedAt:desc
  &pagination[pageSize]=10
```

### 4.2 Destacado portada
```
GET /api/news-articles
  ?filters[is_featured][$eq]=true
  &filters[pin_until][$gte]=<ISO_NOW>
  &populate[hero_image]=*
  &sort[0]=publishedAt:desc
  &pagination[pageSize]=1
```

### 4.3 Categorías / autores
```
GET /api/news-categories?sort=name:asc
GET /api/news-authors?populate[avatar]=*
```

---

## 5. Buenas prácticas adicionales

1. **Visibilidad en Content Manager**  
   - Renombrar display names en Content-Type Builder:  
     `Product` → “Producto”, etc. (ya en marcha).  
   - Asegurarse que News aparece en la barra lateral.

2. **Help Texts**  
   - Añadir descripciones a campos sensibles (`publish_editorial`, precios, `manage_stock`) para orientar a editores.

3. **Contenido dummy**  
   - Mantener al menos 1 artículo publicado y 1 por categoría para validar integraciones y SEO.

4. **Fallback JSON**  
   - Opcional: generar un `news-navigation.json` para cachear chips/categorías y usarlo en Next cuando Strapi no responda.

5. **Testing / QA**  
   - Estrategia: pipeline QA → enviar webhook a entorno staging antes de producción.
   - Tests de contrato en frontend (MockServiceWorker o fixtures) basados en estructura real entregada por Strapi.

6. **Documentación interna**  
   - Crear tutorial en intranet: flujo editorial, checklist SEO, cómo marcar `newsletter_sent`, uso de preview.

7. **Logs / monitoreo**  
   - Activar logging de webhooks (monitorizar fallos de revalidate).
   - Si se usa Algolia, registrar errores en sync.

8. **Analítica**  
   - Añadir campos de tracking (ej. `utm_campaign`) si el equipo de marketing lo requiere para newsletters.

Con estos requisitos el equipo de Strapi tendrá la base robusta para gestionar el blog/newsroom de Moraleja, asegurando consistencia editorial, SEO y ready-to-scale para futuras integraciones (Algolia, mailing, releases programadas, etc.).
