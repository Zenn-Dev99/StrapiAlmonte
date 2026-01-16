# 📋 Instrucciones de Configuración - Google Sheets Sync

## ✅ Paso 1: Compartir Documentos con la Cuenta de Servicio

**IMPORTANTE**: Comparte los 3 documentos con este email con permisos de **Editor**:

```
strapi-gsheets@strapi-gsheets-edicion.iam.gserviceaccount.com
```

### Documentos a compartir:
1. **📖 LECTURA**: https://docs.google.com/spreadsheets/d/12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM/edit
2. **➕ CREAR**: https://docs.google.com/spreadsheets/d/1AiaPOSTQliMzLuseiDbM9Q_RIp5R0Ws38BOI2Iv0tCc/edit
3. **✏️ EDITAR**: https://docs.google.com/spreadsheets/d/1tISN2VnxTBHs0XkYV2YBPkoRB4km4pmkuZlM9qoMCGw/edit

**Cómo compartir:**
1. Abre cada documento
2. Haz clic en el botón "Compartir" (arriba a la derecha)
3. Agrega el email: `strapi-gsheets@strapi-gsheets-edicion.iam.gserviceaccount.com`
4. Selecciona permisos: **Editor**
5. Haz clic en "Enviar"

## ✅ Paso 2: Agregar Hojas a los Documentos

Una vez compartidos los documentos, ejecuta estos comandos para agregar todas las hojas necesarias:

```bash
# Documento de LECTURA
export GOOGLE_SHEETS_SPREADSHEET_ID="12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM"
node scripts/gsheet-agregar-hojas.mjs

# Documento de CREAR
export GOOGLE_SHEETS_SPREADSHEET_ID="1AiaPOSTQliMzLuseiDbM9Q_RIp5R0Ws38BOI2Iv0tCc"
node scripts/gsheet-agregar-hojas.mjs

# Documento de EDITAR
export GOOGLE_SHEETS_SPREADSHEET_ID="1tISN2VnxTBHs0XkYV2YBPkoRB4km4pmkuZlM9qoMCGw"
node scripts/gsheet-agregar-hojas.mjs
```

## ✅ Paso 3: Configurar Apps Script en cada Documento

Para cada uno de los 3 documentos:

1. Abre el documento
2. Ve a **Extensiones > Apps Script**
3. Elimina el código por defecto
4. Pega el código de `scripts/gsheet-apps-script-template.js`
5. Configura las variables:
   ```javascript
   const STRAPI_URL = 'http://localhost:1337'; // O tu URL de producción
   const STRAPI_TOKEN = 'tu_token_aqui'; // Tu token de Strapi
   ```
6. Guarda el proyecto (Ctrl+S o Cmd+S)
7. Da un nombre al proyecto (ej: "Strapi Sync - LECTURA")

## ✅ Paso 4: Agregar Botones en cada Hoja

### Para Documento de LECTURA:
En cada hoja:
1. Ve a **Insertar > Dibujo**
2. Crea un botón con el texto: "🔄 Actualizar desde Strapi"
3. Haz clic en "Guardar y cerrar"
4. Haz clic derecho en el botón > **Asignar script**
5. Escribe: `actualizarDesdeStrapi`
6. Haz clic en "Aceptar"

### Para Documento de CREAR:
En cada hoja:
1. Ve a **Insertar > Dibujo**
2. Crea un botón con el texto: "📤 Cargar a Strapi"
3. Haz clic en "Guardar y cerrar"
4. Haz clic derecho en el botón > **Asignar script**
5. Escribe: `cargarNuevosRegistros`
6. Haz clic en "Aceptar"

### Para Documento de EDITAR:
En cada hoja:
1. Ve a **Insertar > Dibujo**
2. Crea un botón con el texto: "💾 Actualizar en Strapi"
3. Haz clic en "Guardar y cerrar"
4. Haz clic derecho en el botón > **Asignar script**
5. Escribe: `actualizarRegistros`
6. Haz clic en "Aceptar"

## ✅ Paso 5: Probar la Exportación

Prueba exportar datos desde Strapi:

```bash
# Exportar Editoriales al documento de LECTURA
export GOOGLE_SHEETS_SPREADSHEET_ID="12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM"
node scripts/gsheet-export-generic.mjs Editoriales
```

## 📝 Variables de Entorno Configuradas

Los siguientes IDs ya están en tu `.env`:

```env
GOOGLE_SHEETS_SPREADSHEET_ID_LECTURA=12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM
GOOGLE_SHEETS_SPREADSHEET_ID_CREAR=1AiaPOSTQliMzLuseiDbM9Q_RIp5R0Ws38BOI2Iv0tCc
GOOGLE_SHEETS_SPREADSHEET_ID_EDITAR=1tISN2VnxTBHs0XkYV2YBPkoRB4km4pmkuZlM9qoMCGw
```

## 🎉 Listo

Una vez completados estos pasos, tendrás:
- ✅ 3 documentos configurados
- ✅ Todas las hojas creadas
- ✅ Apps Script configurado
- ✅ Botones en cada hoja
- ✅ Sistema listo para usar

