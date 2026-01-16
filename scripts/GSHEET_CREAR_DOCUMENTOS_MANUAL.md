# 📄 Crear Documentos de Google Sheets Manualmente

Si el script automático no funciona por permisos, puedes crear los documentos manualmente:

## 📋 Pasos

### 1. Crear los 3 documentos

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea 3 documentos nuevos con estos nombres:
   - `📖 LECTURA - Estado Actual`
   - `➕ CREAR - Nuevos Registros`
   - `✏️ EDITAR - Actualizar Registros`

### 2. Obtener los IDs

Para cada documento:
1. Abre el documento
2. Copia el ID de la URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 3. Agregar hojas a cada documento

Para cada documento, necesitas agregar hojas. Puedes usar este script para agregar las hojas automáticamente:

```bash
# Primero, agrega el ID del documento a tu .env
export GOOGLE_SHEETS_SPREADSHEET_ID="tu_id_aqui"

# Luego ejecuta el script para agregar hojas
node scripts/gsheet-agregar-hojas.mjs
```

O manualmente:
1. En cada documento, haz clic en el botón "+" para agregar hojas
2. Agrega una hoja por cada collection type:
   - Editoriales
   - Libros
   - Autores
   - Obras
   - Colecciones
   - Sellos
   - Colegios
   - Niveles
   - Cursos
   - Asignaturas
   - Personas
   - Clientes
   - (etc.)

### 4. Configurar variables de entorno

Agrega a tu `.env`:

```env
GOOGLE_SHEETS_SPREADSHEET_ID_LECTURA=id_del_documento_lectura
GOOGLE_SHEETS_SPREADSHEET_ID_CREAR=id_del_documento_crear
GOOGLE_SHEETS_SPREADSHEET_ID_EDITAR=id_del_documento_editar
```

### 5. Configurar Apps Script

Para cada documento:
1. Abre el documento
2. Ve a **Extensiones > Apps Script**
3. Pega el código de `scripts/gsheet-apps-script-template.js`
4. Configura:
   - `STRAPI_URL`: Tu URL de Strapi
   - `STRAPI_TOKEN`: Tu token de Strapi
5. Guarda el proyecto

### 6. Agregar botones

Para cada hoja en cada documento:

#### Documento LECTURA:
1. Inserta > Dibujo > Crea un botón
2. Asigna la función: `actualizarDesdeStrapi`

#### Documento CREAR:
1. Inserta > Dibujo > Crea un botón
2. Asigna la función: `cargarNuevosRegistros`

#### Documento EDITAR:
1. Inserta > Dibujo > Crea un botón
2. Asigna la función: `actualizarRegistros`

## ✅ Listo

Una vez completados estos pasos, tendrás los 3 documentos configurados y listos para usar.

