# Biblioteca de componentes para intranet

## 1. Ficha Colegio + Profesor (`Colegio · Profesores`)

Endpoint pensado como bloque reutilizable para componer vistas o correos que requieren información cruzada entre los content-types `persona`, `persona-trayectoria` (Colegio · Profesores), `colegio`, `cartera-asignacion` y `colegio-event`.

- **Ruta**: `GET /api/biblioteca/colegio-profesor/:id`
- **Autenticación**: misma política que el resto de la intranet (`global::is-authenticated-or-api-token`).
- **Parámetro**: `:id` corresponde al registro de `Colegio · Profesores` (`persona-trayectoria`) que actúa como pivote.

### Campos entregados

| Bloque | Campos principales |
| --- | --- |
| `persona` / `profesor` | `nombre`, `primerApellido`, `emails[]`, `telefonos[]`, `estadoVerificacion` |
| `relacion` | `cargo`, `area`, `rol`, `departamento`, `asignaturas[]`, `niveles[]`, `anio`, `esActual` |
| `colegio` | `nombre`, `dependencia`, `comuna`, `region`, `estadoEstablecimiento`, `estadoVerificacion`, `emails[]`, `telefonos[]`, `websites[]`, `direcciones[]`, `prioridad`, `orden` |
| `colegio.ejecutivoComercial` | `rol`, `prioridad`, `orden`, `persona{...}` |
| `colegio.ejecutivosSoporte[]` | listado con los soportes 1 y 2 vigentes |
| `colegio.accionesRecientes[]` | últimas 10 acciones del bitácora (`colegio-event`) con `accion`, `campo`, `valor`, `actor`, `fecha` |
| `meta.generatedAt` | timestamp ISO del momento en que se armó la ficha |

Todos los arrays se encuentran normalizados (ej. emails y teléfonos traen `value`, `tipo`, `estado`, `principal`). Si algún dato no existe se entrega `null` para mantener un contrato estable.

### Ejemplo de respuesta

```json
{
  "data": {
    "personaTrayectoriaId": 42,
    "persona": {
      "id": 12,
      "nombreCompleto": "María Pérez",
      "primerApellido": "Pérez",
      "emails": [{ "value": "maria@colegio.cl", "tipo": "Laboral" }]
    },
    "relacion": {
      "cargo": "Jefa UTP",
      "area": "Lenguaje",
      "asignaturas": [{ "id": 7, "nombre": "Lenguaje y Comunicación" }],
      "niveles": [{ "id": 3, "nombre": "2° Básico" }]
    },
    "colegio": {
      "nombre": "Colegio Ejemplo",
      "dependencia": "Particular Subvencionado",
      "comuna": "Ñuñoa",
      "telefonos": [{ "value": "+56912345678", "tipo": "Institucional" }],
      "direcciones": [
        {
          "etiqueta": "Principal",
          "calle": "Av. Siempre Viva 742",
          "comuna": "Ñuñoa",
          "region": "Metropolitana"
        }
      ],
      "ejecutivoComercial": {
        "rol": "comercial",
        "persona": {
          "nombreCompleto": "Andrés Comercial",
          "emails": [{ "value": "acomercial@moraleja.cl" }]
        }
      },
      "accionesRecientes": [
        { "accion": "note", "campo": "seguimiento", "fecha": "2025-10-20T12:00:00.000Z" }
      ]
    },
    "meta": { "generatedAt": "2025-10-23T10:00:00.000Z" }
  }
}
```

### Cómo consumirlo desde la intranet

```bash
curl -X GET \
  -H "Authorization: Bearer $STRAPI_API_TOKEN" \
  "https://strapi.moraleja.cl/api/biblioteca/colegio-profesor/42"
```

Este bloque se pensó como el primer componente de la “biblioteca”. Nuevos bloques (por ejemplo `ficha-colegio`, `resumen-ejecutivo`, etc.) deberían seguir la misma convención: `GET /api/biblioteca/<slug-del-bloque>/:id` devolviendo un JSON autocontenido, listo para renderizar en la intranet o en plantillas de correo.
