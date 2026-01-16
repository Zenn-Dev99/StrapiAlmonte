# Promoción · Mailbox Helper Endpoint

## Ruta

- `GET /promocion/mailboxes/by-colegio/:colegioId`
  - `colegioId` puede ser el `id` numérico o el `documentId` del colegio.
  - Requiere autenticación (mismo token que usa la intranet).

## Respuesta

```json
{
  "data": {
    "colegio": {
      "id": 111729,
      "documentId": "m5odht6atjp1i0rl8h4mb5ir",
      "colegio_nombre": "Colegio Moraleja",
      "rbd": 987654321
    },
    "assignment": {
      "id": 5530,
      "documentId": "v0frd5wramldtmbsyuge84uw",
      "estado": "activa",
      "rol": "comercial",
      "fecha_inicio": "2025-03-01",
      "fecha_fin": null,
      "is_current": true
    },
    "ejecutivo": {
      "persona": {
        "id": 11268,
        "documentId": "r826dzgdceh9tuetxbbkn63n",
        "nombres": "Hola",
        "primer_apellido": "Andres",
        "segundo_apellido": "Borrar",
        "nombre_completo": "Hola Andres Borrar",
        "emails": [
          {
            "id": 19518,
            "email": "aomardon@gmail.com",
            "principal": true
          }
        ],
        "telefonos": []
      },
      "colaborador": {
        "id": 123,
        "documentId": "nbf8...",
        "email_login": "ejecutivo@moraleja.cl",
        "rol_operativo": "sales_exec",
        "rol_principal": "comercial",
        "metadata": {
          "smtpAccountKey": "ejecutivo01"
        },
        "smtpAccountKey": "ejecutivo01"
      }
    }
  }
}
```

### Campos clave

- `assignment` entrega la cartera vigente (estado `activa`/`en_revision`, `is_current: true`).
- `ejecutivo.persona` corresponde al contacto (persona) asignado.
- `ejecutivo.colaborador.smtpAccountKey` expone la cuenta SMTP asociada al colaborador.
  - Se lee desde `metadata.smtpAccountKey` (también acepta variantes `smtp_account_key`, etc.).
  - Este valor debe coincidir con los prefijos configurados en variables de entorno (`SMTP_<KEY>_*`).

## Flujo recomendado en la intranet

1. Al preparar el envío, consulta el endpoint con el `colegioId`.
2. Si existe `smtpAccountKey`, usa ese valor para poblar el campo `smtpAccount` cuando llames a `POST /api/emails/send`.
   - El payload actual del envío soporta `smtpAccount` (ya utilizado por Strapi para seleccionar la cuenta).
   - Si el endpoint no entrega `smtpAccountKey`, vuelve al fallback genérico (`default`) y muestra un aviso.
3. Mantén trazabilidad guardando el `assignment.documentId` y el `smtpAccountKey` utilizado.

## Configuración requerida

- El colaborador asociado al ejecutivo debe tener `metadata.smtpAccountKey` (o cualquiera de las variantes anteriores) con el identificador de la cuenta SMTP.
- Las credenciales de cada cuenta deben estar configuradas en el ambiente:
  - `SMTP_<KEY>_HOST`, `SMTP_<KEY>_PORT`, `SMTP_<KEY>_SECURE`, `SMTP_<KEY>_USERNAME`, `SMTP_<KEY>_PASSWORD`, etc.
- `SMTP_ACCOUNTS` debe listar todos los keys disponibles para que Strapi inicialice los proveedores.

Con esta ruta la intranet puede resolver qué casilla debe usar antes de solicitar el envío real, manteniendo el endpoint de correos sin cambios.

