# ✅ Documento de LECTURA - Configurado

## 📊 Estado Actual

El documento de **📖 LECTURA - Estado Actual** está configurado y funcionando.

**ID del Documento**: `12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM`  
**URL**: https://docs.google.com/spreadsheets/d/12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM/edit

## ✅ Hojas Creadas

Se crearon **39 hojas** (una por cada collection type):
- Editoriales ✅ (750 registros exportados)
- Libros ✅ (en proceso - 7157 registros)
- Autores
- Obras
- Colecciones
- Sellos
- Colegios
- Niveles
- Cursos
- Asignaturas
- Curso-Asignaturas
- Personas
- Persona-Tags
- Persona-Trayectorias
- Clientes
- Cotizaciones
- Listas-Escolares
- Ofertas-Producto
- Listas-Descuento
- Colaboradores
- Cartera-Asignaciones
- Cartera-Periodos
- Empresas
- Media-Assets
- Media-Tags
- Media-Categories
- News-Articles
- News-Authors
- News-Categories
- News-Tags
- Regiones
- Provincias
- Comunas
- Zonas
- Canales
- Materiales
- Datos-Facturacion
- Turnos
- Configuracion-Turnos

## 🔄 Exportar Datos

Para exportar datos a cualquier hoja:

```bash
export GOOGLE_SHEETS_SPREADSHEET_ID="12VMmiH0UG5IELGe3aYVr1jL9y8LsVBDBw9hJZ2HgEAM"
node scripts/gsheet-export-generic.mjs <nombre-hoja>
```

**Ejemplos:**
```bash
# Exportar Editoriales
node scripts/gsheet-export-generic.mjs Editoriales

# Exportar Libros
node scripts/gsheet-export-generic.mjs Libros

# Exportar Personas
node scripts/gsheet-export-generic.mjs Personas
```

## 📝 Notas

- Solo se exportan registros **publicados** en Strapi
- Si una hoja muestra "0 registros", verifica que haya registros publicados en Strapi
- El script sobrescribe la hoja completa cada vez que se ejecuta
- Los datos se ordenan por fecha de edición (más recientes primero)

## 🎯 Próximos Pasos

1. ✅ Configurar Apps Script en el documento
2. ✅ Agregar botones en cada hoja con función `actualizarDesdeStrapi`
3. ✅ Probar exportación desde el botón

