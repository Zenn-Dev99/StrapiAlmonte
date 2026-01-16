# 📊 Sistema de Sincronización Google Sheets ↔ Strapi

Sistema de 3 documentos para gestionar la sincronización entre Google Sheets y Strapi.

## 📋 Estructura

### Documento 1: **📖 LECTURA - Estado Actual**
- **Propósito**: Solo lectura de todos los collection types
- **Hojas**: Una por cada collection type (Editoriales, Libros, Personas, etc.)
- **Permisos**: Solo lectura
- **Funcionalidad**: Botón "🔄 Actualizar desde Strapi" en cada hoja

### Documento 2: **➕ CREAR - Nuevos Registros**
- **Propósito**: Crear nuevos registros
- **Hojas**: Una por cada collection type
- **Permisos**: Edición
- **Funcionalidad**: Botón "📤 Cargar a Strapi" en cada hoja

### Documento 3: **✏️ EDITAR - Actualizar Registros**
- **Propósito**: Editar registros existentes
- **Hojas**: Una por cada collection type
- **Permisos**: Edición
- **Funcionalidad**: Botón "💾 Actualizar en Strapi" en cada hoja

## 🚀 Configuración Inicial

### 1. Crear los 3 documentos de Google Sheets

1. Crea 3 documentos nuevos en Google Sheets:
   - `📖 LECTURA - Estado Actual`
   - `➕ CREAR - Nuevos Registros`
   - `✏️ EDITAR - Actualizar Registros`

2. Obtén los IDs de cada documento (de la URL):
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 2. Configurar variables de entorno

Agrega a tu `.env`:

```env
# Google Sheets - Documentos
GOOGLE_SHEETS_SPREADSHEET_ID_LECTURA=tu_id_documento_lectura
GOOGLE_SHEETS_SPREADSHEET_ID_CREAR=tu_id_documento_crear
GOOGLE_SHEETS_SPREADSHEET_ID_EDITAR=tu_id_documento_editar

# Google Sheets - Credenciales
GOOGLE_SHEETS_CREDENTIALS_PATH=./data/gsheets/credentials.json

# Strapi
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=tu_token_aqui
```

### 3. Configurar Apps Script en cada documento

1. Abre cada documento de Google Sheets
2. Ve a **Extensiones > Apps Script**
3. Pega el código de `scripts/gsheet-apps-script-template.js`
4. Configura las variables:
   - `STRAPI_URL`: Tu URL de Strapi
   - `STRAPI_TOKEN`: Tu token de Strapi
5. Guarda el proyecto

### 4. Agregar botones en las hojas

#### Para documento de LECTURA:
1. En cada hoja, inserta un botón
2. Asigna la función: `actualizarDesdeStrapi`
3. El botón actualizará solo esa hoja desde Strapi

#### Para documento de CREACIÓN:
1. En cada hoja, inserta un botón
2. Asigna la función: `cargarNuevosRegistros`
3. El botón procesará solo las filas sin `documentId`

#### Para documento de EDICIÓN:
1. En cada hoja, inserta un botón
2. Asigna la función: `actualizarRegistros`
3. El botón procesará solo las filas con `documentId`

## 📝 Uso

### Exportar datos desde Strapi (LECTURA)

```bash
# Exportar una hoja específica
node scripts/gsheet-export-generic.mjs Editoriales

# O especificar collection type explícitamente
node scripts/gsheet-export-generic.mjs Editoriales api::editorial.editorial
```

### Crear nuevos registros (CREACIÓN)

1. Abre el documento "➕ CREAR - Nuevos Registros"
2. Ve a la hoja correspondiente (ej: "Editoriales")
3. Agrega nuevas filas (sin `documentId`)
4. Haz clic en el botón "📤 Cargar a Strapi"
5. Los registros se crearán en Strapi y se actualizará el `documentId`

### Actualizar registros (EDICIÓN)

1. Abre el documento "✏️ EDITAR - Actualizar Registros"
2. Ve a la hoja correspondiente
3. Edita las filas existentes (con `documentId`)
4. Haz clic en el botón "💾 Actualizar en Strapi"
5. Los cambios se aplicarán en Strapi

## 🔧 Scripts Disponibles

### `gsheet-export-generic.mjs`
Exporta cualquier collection type desde Strapi a Google Sheets.

**Uso:**
```bash
node scripts/gsheet-export-generic.mjs <nombre-hoja>
```

**Ejemplo:**
```bash
node scripts/gsheet-export-generic.mjs Editoriales
```

### `gsheet-mapeo-collection-types.mjs`
Mapeo centralizado de nombres de hojas a collection types.

**Agregar nuevo mapeo:**
Edita el archivo y agrega:
```javascript
'Nombre-Hoja': 'api::collection-type.collection-type',
```

## 📋 Mapeo de Hojas

El mapeo se encuentra en `scripts/gsheet-mapeo-collection-types.mjs`.

Para agregar un nuevo collection type:

1. Agrega el mapeo en el archivo:
   ```javascript
   'Nombre-Hoja': 'api::collection-type.collection-type',
   ```

2. Crea la hoja correspondiente en los 3 documentos

3. Agrega el botón correspondiente en cada hoja

## 🔐 Permisos y Delegación

### Documento de LECTURA
- **Permisos**: Solo lectura
- **Delegar a**: Personas que solo necesitan consultar

### Documento de CREACIÓN
- **Permisos**: Edición
- **Delegar a**: Personas que solo crean nuevos registros

### Documento de EDICIÓN
- **Permisos**: Edición
- **Delegar a**: Personas que editan registros existentes

## ⚠️ Notas Importantes

1. **documentId**: No editar manualmente. Se genera automáticamente por Strapi.

2. **Columnas de solo lectura**: 
   - `documentId`
   - `url`
   - `fecha_creacion`
   - `fecha_edicion`

3. **Validación**: Los scripts validan los datos antes de enviar a Strapi.

4. **Errores**: Si hay errores, se mostrarán en el mensaje de alerta.

## 🐛 Troubleshooting

### Error: "Hoja no reconocida"
- Verifica que el nombre de la hoja esté en el mapeo
- Agrega el mapeo en `gsheet-mapeo-collection-types.mjs`

### Error: "No se encontró credentials.json"
- Verifica la ruta en `GOOGLE_SHEETS_CREDENTIALS_PATH`
- Asegúrate de tener las credenciales de Google API

### Error: "Falta STRAPI_TOKEN"
- Verifica que el token esté configurado en `.env`
- O exporta la variable: `export STRAPI_TOKEN=tu_token`

## 📚 Próximos Pasos

1. Crear endpoints en el backend para que Apps Script pueda llamarlos
2. Implementar scripts de creación y actualización genéricos
3. Agregar validación de datos más robusta
4. Implementar logging de cambios

