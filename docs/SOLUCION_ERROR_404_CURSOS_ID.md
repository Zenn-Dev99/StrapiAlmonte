# 🔍 Solución: Error 404 al Obtener Curso Individual por ID

**Fecha:** 10 de Enero 2026  
**Problema:** Error 404 "Not Found" al intentar obtener un curso individual por ID desde el frontend.

---

## 🐛 Problema Identificado

El content type `cursos` tiene `draftAndPublish: true` configurado, lo que en Strapi v4 cambia cómo se manejan los IDs y el estado de publicación.

### Causas Posibles:

1. **El curso está en estado "Draft" (no publicado)**
   - La API REST de Strapi v4 por defecto solo devuelve contenido **publicado**
   - Si el curso está en "Draft", no se encuentra con la petición normal

2. **Formato de ID incorrecto**
   - Con `draftAndPublish: true`, Strapi usa dos tipos de IDs:
     - `id` (numérico): Para documentos publicados
     - `documentId` (string UUID): Identificador único del documento (draft o publicado)

3. **Falta el parámetro `publicationState`**
   - Para obtener contenido en draft, necesitas `?publicationState=preview`

---

## ✅ Solución

### Opción 1: Usar `documentId` en lugar de `id` (RECOMENDADO)

Strapi v4 con `draftAndPublish: true` acepta ambos formatos, pero `documentId` es más confiable:

```typescript
// ❌ Actual (puede fallar)
GET /api/cursos/2

// ✅ Correcto (usando documentId)
GET /api/cursos/{documentId}
```

### Opción 2: Agregar `publicationState=preview` para incluir drafts

```typescript
// Para obtener solo publicados (por defecto)
GET /api/cursos/{id}?populate=deep

// Para obtener también drafts
GET /api/cursos/{id}?populate=deep&publicationState=preview
```

### Opción 3: Asegurar que los cursos estén publicados

Si no necesitas draft/publish, considera deshabilitarlo:

```json
// strapi/src/api/curso/content-types/curso/schema.json
{
  "options": {
    "draftAndPublish": false  // Cambiar a false
  }
}
```

---

## 📋 Estructura de Respuesta en Strapi v4

Cuando obtienes un curso individual, la respuesta es:

```json
{
  "data": {
    "id": 2,                    // ID numérico (solo para publicados)
    "documentId": "abc123...",  // UUID único (draft o publicado)
    "attributes": {
      "nombre_curso": "...",
      "nivel": "...",
      // ... otros campos
    },
    "meta": {
      // metadata adicional
    }
  }
}
```

**Importante:**
- `id` está en el nivel raíz de `data` (no dentro de `attributes`)
- `documentId` también está en el nivel raíz de `data`
- Para filtros, puedes usar `filters[id][$eq]=2` o `filters[documentId][$eq]="abc123"`

---

## 🔧 Corrección Recomendada para el Frontend

Actualizar `frontend-ubold/src/app/api/crm/cursos/[id]/route.ts`:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cursoId = params.id

    // Opción A: Intentar con publicationState=preview para incluir drafts
    const response = await fetch(
      `${STRAPI_URL}/api/cursos/${cursoId}?populate=deep&publicationState=preview`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    // Opción B: Si falla, intentar sin publicationState (solo publicados)
    if (!response.ok) {
      const responsePublicado = await fetch(
        `${STRAPI_URL}/api/cursos/${cursoId}?populate=deep`,
        {
          headers: {
            'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      )
      
      if (!responsePublicado.ok) {
        const errorData = await responsePublicado.json().catch(() => ({}))
        return NextResponse.json(
          { success: false, error: errorData.error?.message || 'Curso no encontrado' },
          { status: responsePublicado.status }
        )
      }
      
      const data = await responsePublicado.json()
      return NextResponse.json({
        success: true,
        data: data.data,
      })
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data.data,
    })
  } catch (error: any) {
    console.error('[API /cursos/[id] GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener curso' },
      { status: 500 }
    )
  }
}
```

---

## 🔍 Verificación

### 1. Verificar estado de publicación del curso

En Strapi Admin:
1. Ir a Content Manager → Cursos
2. Abrir el curso con ID `2`
3. Verificar el estado en la esquina superior derecha:
   - ✅ **"Published"** = El curso está publicado (debería funcionar)
   - ❌ **"Draft"** = El curso está en borrador (necesita `publicationState=preview`)

### 2. Verificar formato de ID

Cuando listas cursos (`GET /api/cursos`), verifica qué campo de ID devuelve:

```json
{
  "data": [
    {
      "id": 2,                    // ¿Existe?
      "documentId": "abc123...",  // ¿Existe?
      "attributes": { ... }
    }
  ]
}
```

### 3. Probar petición directa

```bash
# Prueba 1: Solo publicados (por defecto)
curl -H "Authorization: Bearer ${TOKEN}" \
  "${STRAPI_URL}/api/cursos/2?populate=deep"

# Prueba 2: Incluyendo drafts
curl -H "Authorization: Bearer ${TOKEN}" \
  "${STRAPI_URL}/api/cursos/2?populate=deep&publicationState=preview"

# Prueba 3: Con documentId (si tienes el UUID)
curl -H "Authorization: Bearer ${TOKEN}" \
  "${STRAPI_URL}/api/cursos/{documentId}?populate=deep&publicationState=preview"
```

---

## 📝 Notas Adicionales

1. **Mismo problema en `listas-utiles`**: También tiene `draftAndPublish: true`, así que aplica la misma solución

2. **Populate `deep`**: En Strapi v4, `populate=deep` puede tener limitaciones. Es mejor usar populate específico:
   ```typescript
   populate[0]=materiales&populate[1]=colegio&populate[2]=lista_utiles
   ```

3. **Permisos**: Asegúrate de que el API token tenga permisos de lectura para el content type `cursos`

4. **Consistencia**: Considera usar siempre `documentId` para content types con `draftAndPublish: true` para evitar problemas

---

**Última actualización:** 10 de Enero 2026
