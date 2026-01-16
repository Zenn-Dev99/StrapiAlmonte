# Demo listas utiles - Datos de ejemplo

Los siguientes fragmentos muestran como lucen las relaciones principales de las nuevas colecciones. Puedes usarlos como referencia rapida o como base para construir fixtures propios.

## Colegio List (`api::colegio-list.colegio-list`)

```json
{
  "slug": "demo-lista-utiles-2025",
  "anio": 2025,
  "descripcion_interna": "Lista de utiles de ejemplo para el ano 2025.",
  "estado_global": "en_proceso",
  "colegio": {
    "connect": ["<colegio-id>"]
  }
}
```

## Colegio List Version (`api::colegio-list-version.colegio-list-version`)

```json
{
  "version_number": 1,
  "etiqueta": "Version 2025.1",
  "estado": "in_review",
  "colegio_list": {
    "connect": ["<colegio-list-id>"]
  },
  "quality_flags": [
    {
      "code": "nombre_inexacto",
      "label": "Nombre detectado difiere del catalogo oficial",
      "severity": "warning",
      "resolved": false
    }
  ],
  "change_summary": [
    {
      "scope": "item",
      "diff_type": "agregado",
      "reference": "Cuaderno de Matematicas 7B",
      "new_value": {
        "nombre": "Cuaderno universitario cuadro grande 100 hojas",
        "cantidad": 2
      },
      "impact": "medio"
    }
  ],
  "estimated_value": 45990,
  "match_score": 68.5,
  "error_rate": 12.5,
  "url_fuente": "https://intranet.demo.moraleja.cl/listas/demo-2025.pdf",
  "mensaje_apoderados": "<p>Recuerda marcar cada util con el nombre del estudiante y curso.</p>"
}
```

## Colegio List Document (`api::colegio-list-document.colegio-list-document`)

```json
{
  "nombre_archivo": "lista-7-basico.pdf",
  "curso_detectado": "7 Basico B",
  "curso_normalizado": "7-basico-b",
  "pagina_inicio": 1,
  "pagina_fin": 3,
  "estado_procesamiento": "completado",
  "procesamiento_log": {
    "steps": [
      "Archivo subido por Indexar",
      "OCR completado en 2.3s",
      "7 items detectados, 1 nota general"
    ]
  },
  "orden": 1,
  "version": {
    "connect": ["<colegio-list-version-id>"]
  }
}
```

## Colegio List Item (`api::colegio-list-item.colegio-list-item`)

```json
{
  "nombre_detectado": "Lapiz grafito N2 (marca sugerida Staedtler)",
  "nombre_normalizado": "Lapiz grafito HB Staedtler",
  "cantidad": 12,
  "unidad": "unidad",
  "instrucciones": "Marcar con nombre y mantener repuesto en estuche.",
  "asignatura": "Lenguaje",
  "categoria_texto": "Utiles generales",
  "omit_purchase": false,
  "prioridad_revision": "normal",
  "validacion_estado": "en_revision",
  "validation_errors": [
    {
      "code": "otros",
      "message": "Considerar caja con 12 unidades para estimacion.",
      "severity": "info",
      "resolved": true
    }
  ],
  "bounding_boxes": [
    {
      "page": 1,
      "x": 0.08,
      "y": 0.32,
      "width": 0.82,
      "height": 0.04
    }
  ],
  "precio_unitario_referencia": 890,
  "documento": {
    "connect": ["<colegio-list-document-id>"]
  },
  "version": {
    "connect": ["<colegio-list-version-id>"]
  },
  "orden": 1
}
```

## Colegio List Note (`api::colegio-list-note.colegio-list-note`)

```json
{
  "tipo": "general",
  "contenido": "Todos los cuadernos deben tener forro azul y etiqueta legible.",
  "pagina": 2,
  "bounding_box": {
    "page": 2,
    "x": 0.05,
    "y": 0.18,
    "width": 0.9,
    "height": 0.06
  },
  "version": {
    "connect": ["<colegio-list-version-id>"]
  },
  "documento": {
    "connect": ["<colegio-list-document-id>"]
  },
  "orden": 1
}
```

## Colegio List Item Audit (`api::colegio-list-item-audit.colegio-list-item-audit`)

```json
{
  "item": {
    "connect": ["<colegio-list-item-id>"]
  },
  "accion": "update",
  "descripcion": "Se actualiza nombre normalizado segun catalogo oficial.",
  "datos_previos": {
    "nombre_normalizado": "Lapiz grafito (generico)"
  },
  "datos_nuevos": {
    "nombre_normalizado": "Lapiz grafito HB Staedtler"
  },
  "realizado_por": {
    "connect": ["<admin-user-id>"]
  },
  "realizado_en": "2025-01-28T12:30:00.000Z",
  "estado_version": "in_review"
}
```

> **Tip:** Ejecuta `npm run seed:demo:listas-utiles` para generar este mismo conjunto de datos dentro de tu ambiente local, siempre que ya exista un usuario administrador disponible.
