# Codex — Implementar taxonomía literaria en Strapi (automatizado)

> **Propósito**: Que **Codex** ejecute, sin preguntas, la creación de **Género → Subgénero → Etiquetas** en Strapi v4, los conecte con **Product**, despliegue en Railway y cargue semillas mínimas.
>
> **Ambiente**: Producción (Railway) con repo conectado. Se asume `STRAPI_API_TOKEN` activo (Full Access) y `NEXT_PUBLIC_STRAPI_URL` configurado.

---

## 0) Variables de entorno requeridas (Codex, exportar ahora)

> **Codex**: exporta estas variables en la sesión actual.

```bash
# === Ruta del monorepo ===
export REPO_DIR="$HOME/Proyectos/Strapi/intranet"     # ⚠️ Ajusta si corresponde

# === Strapi ===
export STRAPI_URL="https://strapi.moraleja.cl"        # URL pública de Strapi
export STRAPI_API_TOKEN="$STRAPI_API_TOKEN"           # Ya existente en el ambiente del usuario

# === Git ===
export GIT_BRANCH="feature/taxonomia-literaria"
```

---

## 1) Crear branch y estructura de archivos

```bash
cd "$REPO_DIR"

# Crea rama de trabajo
 git checkout -b "$GIT_BRANCH" || git checkout "$GIT_BRANCH"

# Asegurar carpetas API
 mkdir -p src/api/genre/content-types/genre \
          src/api/subgenre/content-types/subgenre \
          src/api/tag/content-types/tag \
          src/api/genre/content-types/genre \
          src/api/subgenre/content-types/subgenre \
          src/api/tag/content-types/tag \
          src/api/_shared/utils
```

---

## 2) Utilidad slugify compartida

```bash
cat > src/api/_shared/utils/slugify.js <<'JS'
module.exports = (str = "") =>
  str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
JS
```

---

## 3) Content-Types: `genre`, `subgenre`, `tag`

### 3.1 `src/api/genre/content-types/genre/schema.json`
```bash
cat > src/api/genre/content-types/genre/schema.json <<'JSON'
{
  "kind": "collectionType",
  "collectionName": "genres",
  "info": {
    "singularName": "genre",
    "pluralName": "genres",
    "displayName": "Genre",
    "description": "Género principal literario"
  },
  "options": { "draftAndPublish": true },
  "pluginOptions": { "i18n": { "localized": false } },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "slug": { "type": "uid", "targetField": "name", "required": true, "unique": true },
    "description": { "type": "richtext" },
    "isActive": { "type": "boolean", "default": true },
    "order": { "type": "integer", "default": 0 },
    "subgenres": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::subgenre.subgenre",
      "mappedBy": "genre"
    }
  }
}
JSON
```

### 3.2 `src/api/subgenre/content-types/subgenre/schema.json`
```bash
cat > src/api/subgenre/content-types/subgenre/schema.json <<'JSON'
{
  "kind": "collectionType",
  "collectionName": "subgenres",
  "info": {
    "singularName": "subgenre",
    "pluralName": "subgenres",
    "displayName": "Subgenre",
    "description": "Subgénero literario"
  },
  "options": { "draftAndPublish": true },
  "pluginOptions": { "i18n": { "localized": false } },
  "attributes": {
    "name": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "name", "required": true, "unique": true },
    "description": { "type": "text" },
    "isActive": { "type": "boolean", "default": true },
    "order": { "type": "integer", "default": 0 },
    "genre": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::genre.genre",
      "inversedBy": "subgenres",
      "required": true
    }
  }
}
JSON
```

### 3.3 `src/api/tag/content-types/tag/schema.json`
```bash
cat > src/api/tag/content-types/tag/schema.json <<'JSON'
{
  "kind": "collectionType",
  "collectionName": "tags",
  "info": {
    "singularName": "tag",
    "pluralName": "tags",
    "displayName": "Tag",
    "description": "Etiqueta libre para productos"
  },
  "options": { "draftAndPublish": true },
  "pluginOptions": { "i18n": { "localized": false } },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "slug": { "type": "uid", "targetField": "name", "required": true, "unique": true },
    "description": { "type": "text" },
    "isActive": { "type": "boolean", "default": true },
    "order": { "type": "integer", "default": 0 }
  }
}
JSON
```

---

## 4) Lifecycles: slugs automáticos (opcional pero recomendado)

```bash
mkdir -p src/api/genre/content-types/genre \
         src/api/subgenre/content-types/subgenre \
         src/api/tag/content-types/tag

cat > src/api/genre/content-types/genre/lifecycles.js <<'JS'
const slugify = require("../../../_shared/utils/slugify");
module.exports = {
  beforeCreate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  },
  beforeUpdate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  }
};
JS

cat > src/api/subgenre/content-types/subgenre/lifecycles.js <<'JS'
const slugify = require("../../../_shared/utils/slugify");
module.exports = {
  beforeCreate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  },
  beforeUpdate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  }
};
JS

cat > src/api/tag/content-types/tag/lifecycles.js <<'JS'
const slugify = require("../../../_shared/utils/slugify");
module.exports = {
  beforeCreate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  },
  beforeUpdate: async (event) => {
    const { data } = event.params;
    if (data.name && !data.slug) data.slug = slugify(data.name);
  }
};
JS
```

---

## 5) Añadir relaciones en `Product`

> **Asumido**: `./src/api/product/content-types/product/schema.json` existe.

```bash
PRODUCT_SCHEMA="src/api/product/content-types/product/schema.json"
cp "$PRODUCT_SCHEMA" "$PRODUCT_SCHEMA.bak"

# Si hay jq instalado, inyecta atributos; si no, se escribe plantilla mínima.
if command -v jq >/dev/null 2>&1; then
  TMP_JSON="$(mktemp)"
  jq '.attributes.genre = {"type":"relation","relation":"manyToOne","target":"api::genre.genre","inversedBy":"products"} |
      .attributes.subgenre = {"type":"relation","relation":"manyToOne","target":"api::subgenre.subgenre","inversedBy":"products"} |
      .attributes.tags = {"type":"relation","relation":"manyToMany","target":"api::tag.tag"}' \
      "$PRODUCT_SCHEMA" > "$TMP_JSON" && mv "$TMP_JSON" "$PRODUCT_SCHEMA"
else
  cat > "$PRODUCT_SCHEMA" <<'JSON'
{
  "kind": "collectionType",
  "collectionName": "products",
  "info": { "singularName": "product", "pluralName": "products", "displayName": "Product" },
  "options": { "draftAndPublish": true },
  "attributes": {
    "title": { "type": "string" },
    "sku": { "type": "string" },
    "genre": { "type": "relation", "relation": "manyToOne", "target": "api::genre.genre", "inversedBy": "products" },
    "subgenre": { "type": "relation", "relation": "manyToOne", "target": "api::subgenre.subgenre", "inversedBy": "products" },
    "tags": { "type": "relation", "relation": "manyToMany", "target": "api::tag.tag" }
  }
}
JSON
fi
```

> **Nota**: Si tu `product` ya tiene más campos, la ruta *jq* preserva lo existente e inserta relaciones.

---

## 6) Commit y push (despliegue en Railway)

```bash
git add -A
git commit -m "feat(taxonomia): Genre/Subgenre/Tag + relaciones en Product + lifecycles"
# Push para que Railway haga deploy
git push -u origin "$GIT_BRANCH"
```

> **Railway**: el deploy debe reconstruir Strapi y aplicar los nuevos schemas.

---

## 7) Semillas mínimas (curl con API Token)

> **Codex**: ejecuta los `curl` para crear **géneros**, **subgéneros** y **tags** base.

### 7.1 Géneros
```bash
curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Narrativo","slug":"narrativo","description":"Obras de ficción en prosa","isActive":true,"order":1}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Lírico","slug":"lirico","description":"Poesía y expresión subjetiva","isActive":true,"order":2}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Dramático","slug":"dramatico","description":"Textos para representación teatral","isActive":true,"order":3}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Didáctico","slug":"didactico","description":"Ensayo y textos de reflexión","isActive":true,"order":4}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Épico","slug":"epico","description":"Poesía narrativa heroica","isActive":true,"order":5}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Infantil y Juvenil","slug":"infantil-juvenil","description":"Obras para niños y adolescentes","isActive":true,"order":6}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"No ficción literaria","slug":"no-ficcion","description":"Biografías, crónicas, memorias","isActive":true,"order":7}}'

curl -s -X POST "$STRAPI_URL/api/genres" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data": {"name":"Mixtos y Modernos","slug":"mixtos-modernos","description":"Novela gráfica, crónica literaria, guion","isActive":true,"order":8}}'
```

### 7.2 Subgéneros (mapeando por `genre` via `connect` por id)
> Primero obtenemos los IDs de los géneros para conectar.
```bash
# Obtener géneros (necesitamos IDs)
curl -s "$STRAPI_URL/api/genres?pagination[pageSize]=100&sort=order:asc" -H "Authorization: Bearer $STRAPI_API_TOKEN" | jq '.data[] | {id, name, slug}'
```

> **Codex**: reemplaza `GENRE_ID_NARRATIVO` / `GENRE_ID_LIRICO` etc. con los ids reales impresos arriba.

```bash
export GENRE_ID_NARRATIVO=1
export GENRE_ID_LIRICO=2
export GENRE_ID_DRAMATICO=3
export GENRE_ID_DIDACTICO=4
export GENRE_ID_EPICO=5
export GENRE_ID_INFANTIL=6
export GENRE_ID_NOFICCION=7
export GENRE_ID_MIXTOS=8
```

```bash
# Narrativo
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Novela","slug":"novela","description":"Obra extensa de ficción","isActive":true,"order":1,"genre":'$GENRE_ID_NARRATIVO'}}'

curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Cuento","slug":"cuento","description":"Relato breve de ficción","isActive":true,"order":2,"genre":'$GENRE_ID_NARRATIVO'}}'

curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Relato","slug":"relato","description":"Narración corta","isActive":true,"order":3,"genre":'$GENRE_ID_NARRATIVO'}}'

curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Fábula","slug":"fabula","description":"Relato con moraleja","isActive":true,"order":4,"genre":'$GENRE_ID_NARRATIVO'}}'

# Lírico
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Poesía","slug":"poesia","description":"Verso libre o medido","isActive":true,"order":1,"genre":'$GENRE_ID_LIRICO'}}'

# Dramático
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Tragedia","slug":"tragedia","description":"Conflicto grave y fatal","isActive":true,"order":1,"genre":'$GENRE_ID_DRAMATICO'}}'

curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Comedia","slug":"comedia","description":"Humor y crítica social","isActive":true,"order":2,"genre":'$GENRE_ID_DRAMATICO'}}'

curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Drama","slug":"drama","description":"Conflicto humano realista","isActive":true,"order":3,"genre":'$GENRE_ID_DRAMATICO'}}'

# Didáctico
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Ensayo","slug":"ensayo","description":"Reflexión y argumentación","isActive":true,"order":1,"genre":'$GENRE_ID_DIDACTICO'}}'

# Épico
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Epopeya","slug":"epopeya","description":"Poesía heroica extensa","isActive":true,"order":1,"genre":'$GENRE_ID_EPICO'}}'

# Mixtos y Modernos
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Novela gráfica","slug":"novela-grafica","description":"Texto + viñetas","isActive":true,"order":1,"genre":'$GENRE_ID_MIXTOS'}}'

# No ficción literaria
curl -s -X POST "$STRAPI_URL/api/subgenres" -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"name":"Biografía","slug":"biografia","description":"Historia de vida real","isActive":true,"order":1,"genre":'$GENRE_ID_NOFICCION'}}'
```

### 7.3 Tags
```bash
for t in ficcion historica juvenil chilena policial romantica fantasia clasicos poesia-contemporanea; do
  curl -s -X POST "$STRAPI_URL/api/tags" \
    -H "Authorization: Bearer $STRAPI_API_TOKEN" -H "Content-Type: application/json" \
    -d '{"data": {"name":"'"$t"'","slug":"'"$t"'","isActive":true}}' >/dev/null
  echo "tag creado: $t"
done
```

---

## 8) Smoke tests de API (REST)

```bash
# 8.1. Géneros con subgéneros activos (árbol de filtros)
curl -s "$STRAPI_URL/api/genres?filters[isActive][$eq]=true&populate[subgenres][filters][isActive][$eq]=true&sort=order:asc" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" | jq '.data[].attributes | {name, slug, order, subgenres: (.subgenres.data[].attributes.slug)}'

# 8.2. Productos por género/subgénero/tags (ejemplo, ajusta slugs)
curl -s "$STRAPI_URL/api/products?filters[genre][slug][$eq]=narrativo&filters[subgenre][slug][$eq]=novela&filters[tags][slug][$in]=ficcion,chilena&populate=*" \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" | jq '.data | length'
```

---

## 9) Checklist automático (validar)

```bash
[ -f src/api/genre/content-types/genre/schema.json ] && echo "OK genre schema" || echo "FALTA genre schema"
[ -f src/api/subgenre/content-types/subgenre/schema.json ] && echo "OK subgenre schema" || echo "FALTA subgenre schema"
[ -f src/api/tag/content-types/tag/schema.json ] && echo "OK tag schema" || echo "FALTA tag schema"
[ -f src/api/_shared/utils/slugify.js ] && echo "OK slugify util" || echo "FALTA slugify util"
[ -f src/api/genre/content-types/genre/lifecycles.js ] && echo "OK lifecycles genre" || echo "FALTA lifecycles genre"
[ -f src/api/subgenre/content-types/subgenre/lifecycles.js ] && echo "OK lifecycles subgenre" || echo "FALTA lifecycles subgenre"
[ -f src/api/tag/content-types/tag/lifecycles.js ] && echo "OK lifecycles tag" || echo "FALTA lifecycles tag"
```

---

## 10) Notas operativas

- Si el frontend debe consumir sin token, en **Roles & Permissions → Public** habilitar `find`/`findOne` para `genres`, `subgenres`, `tags`. (Se hace por panel; no automatizamos).
- Mantener `order` en múltiplos de 10 para insertar categorías sin reordenar todo.
- Usar `isActive=false` para ocultar sin borrar.
- Si deseas **múltiples subgéneros por producto**, cambia la relación `subgenre` a `manyToMany` (análogo al paso 5).

---

## 11) Cerrar PR / Merge

```bash
# (opcional) crear PR en GitHub desde la rama $GIT_BRANCH y hacer merge
# después de deploy estable en Railway, eliminar rama
```

**Fin.** Codex: ejecutar de arriba hacia abajo. Si un paso falla, imprimir el error y continuar con los siguientes, manteniendo backups (`.bak`).

