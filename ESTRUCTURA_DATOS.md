# Inventario de Modelos de Datos (Schemas)

Este documento contiene la estructura completa de todos los Content Types del proyecto, tanto los nativos de MIRA.APP como los heredados de la Intranet/WooCommerce.

**Última actualización:** 2026-01-02

---

## 1. Núcleo MIRA.APP

### 1.1. MIRA · Estudiante (`api::persona-mira.persona-mira`)

```json
{
  "kind": "collectionType",
  "collectionName": "personas_mira",
  "info": {
    "singularName": "persona-mira",
    "pluralName": "personas-mira",
    "displayName": "MIRA · Estudiante",
    "description": "Estudiantes registrados en MIRA.APP"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "persona": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::persona.persona",
      "required": true
    },
    "email": {
      "type": "email",
      "required": true,
      "unique": true,
      "description": "Email único para inicio de sesión en MIRA"
    },
    "password": {
      "type": "password",
      "required": true,
      "private": true,
      "searchable": false,
      "description": "Contraseña encriptada para autenticación"
    },
    "fecha_registro": {
      "type": "datetime"
    },
    "activo": {
      "type": "boolean",
      "default": true
    },
    "ultimo_acceso": {
      "type": "datetime"
    },
    "licencias_activadas": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::licencia-estudiante.licencia-estudiante",
      "mappedBy": "estudiante"
    }
  }
}
```

### 1.2. MIRA · Libro (`api::libro-mira.libro-mira`)

```json
{
  "kind": "collectionType",
  "collectionName": "libros_mira",
  "info": {
    "singularName": "libro-mira",
    "pluralName": "libros-mira",
    "displayName": "MIRA · Libro",
    "description": "Libros configurados para MIRA.APP con códigos de activación y recursos"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "libro": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::libro.libro",
      "required": true,
      "unique": true
    },
    "codigo_activacion_base": {
      "type": "string",
      "required": true,
      "unique": true,
      "description": "Código base de activación único para este libro"
    },
    "url_qr_redireccion": {
      "type": "string",
      "description": "URL a la que redirige el QR del libro (ej: /qr?libro=ISBN)"
    },
    "google_drive_folder_id": {
      "type": "string",
      "description": "ID de la carpeta en Google Drive con los recursos del libro"
    },
    "tiene_omr": {
      "type": "boolean",
      "default": false,
      "description": "Si el libro tiene funcionalidad OMR habilitada"
    },
    "activo": {
      "type": "boolean",
      "default": true,
      "description": "Si el libro está activo en MIRA.APP"
    },
    "licencias": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::licencia-estudiante.licencia-estudiante",
      "mappedBy": "libro_mira"
    }
  }
}
```

### 1.3. MIRA · Licencia Estudiante (`api::licencia-estudiante.licencia-estudiante`)

```json
{
  "kind": "collectionType",
  "collectionName": "licencias_estudiantes",
  "info": {
    "singularName": "licencia-estudiante",
    "pluralName": "licencias-estudiantes",
    "displayName": "MIRA · Licencia Estudiante",
    "description": "Licencias activadas de estudiantes para libros en MIRA.APP"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "estudiante": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::persona-mira.persona-mira",
      "required": true,
      "inversedBy": "licencias_activadas"
    },
    "libro_mira": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::libro-mira.libro-mira",
      "required": true,
      "inversedBy": "licencias"
    },
    "codigo_activacion": {
      "type": "string",
      "required": true,
      "unique": true,
      "description": "Código único de activación ingresado por el estudiante"
    },
    "fecha_activacion": {
      "type": "datetime"
    },
    "activa": {
      "type": "boolean",
      "default": true,
      "description": "Si la licencia está activa"
    },
    "google_drive_folder_id": {
      "type": "string",
      "description": "ID de carpeta en Google Drive (puede ser personalizada o la del libro)"
    },
    "fecha_vencimiento": {
      "type": "date",
      "description": "Fecha de vencimiento de la licencia (opcional)"
    }
  }
}
```

### 1.4. MIRA · OMR Evaluación (`api::omr-evaluacion.omr-evaluacion`)

```json
{
  "kind": "collectionType",
  "collectionName": "omr_evaluaciones",
  "info": {
    "singularName": "omr-evaluacion",
    "pluralName": "omr-evaluaciones",
    "displayName": "MIRA · OMR Evaluación",
    "description": "Resultados de procesamiento OMR de hojas de respuestas"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "estudiante": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::persona-mira.persona-mira",
      "required": true
    },
    "libro_mira": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::libro-mira.libro-mira",
      "description": "Libro relacionado (opcional)"
    },
    "imagen_hoja": {
      "type": "media",
      "multiple": false,
      "required": true,
      "description": "Imagen de la hoja de respuestas escaneada"
    },
    "fecha_procesamiento": {
      "type": "datetime"
    },
    "estado": {
      "type": "enumeration",
      "enum": [
        "pendiente",
        "procesado",
        "error"
      ],
      "default": "pendiente"
    },
    "resultados": {
      "type": "json",
      "description": "Resultados del procesamiento OMR (respuestas detectadas, puntaje, etc.)"
    },
    "notas": {
      "type": "text",
      "description": "Notas adicionales sobre la evaluación"
    }
  }
}
```

### 1.5. MIRA · Recurso Freemium (`api::recurso-freemium.recurso-freemium`)

```json
{
  "kind": "collectionType",
  "collectionName": "recursos_freemium",
  "info": {
    "singularName": "recurso-freemium",
    "pluralName": "recursos-freemium",
    "displayName": "MIRA · Recurso Freemium",
    "description": "Contenido gratuito disponible para todos los estudiantes en MIRA.APP"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "titulo": {
      "type": "string",
      "required": true
    },
    "descripcion": {
      "type": "text",
      "description": "Descripción del recurso"
    },
    "tipo_contenido": {
      "type": "enumeration",
      "enum": [
        "video",
        "documento",
        "imagen",
        "enlace",
        "otro"
      ],
      "default": "documento"
    },
    "url_recurso": {
      "type": "string",
      "description": "URL del recurso (puede ser externa o de Google Drive)"
    },
    "google_drive_file_id": {
      "type": "string",
      "description": "ID del archivo en Google Drive"
    },
    "imagen_preview": {
      "type": "media",
      "multiple": false,
      "description": "Imagen de vista previa del recurso"
    },
    "activo": {
      "type": "boolean",
      "default": true
    },
    "orden": {
      "type": "integer",
      "default": 0,
      "description": "Orden de visualización (menor número = primero)"
    },
    "fecha_publicacion": {
      "type": "datetime",
      "description": "Fecha de publicación del recurso"
    }
  }
}
```

---

## 2. Catálogo de Productos (Heredados de Intranet/WooCommerce)

### 2.1. Product · Libro · Edición (`api::libro.libro`)

```json
{
  "kind": "collectionType",
  "collectionName": "libros",
  "info": {
    "singularName": "libro",
    "pluralName": "libros",
    "displayName": "Product · Libro · Edición",
    "description": "Libros con los campos mínimos para catalogar"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "isbn_libro": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "nombre_libro": {
      "type": "string",
      "required": true
    },
    "subtitulo_libro": {
      "type": "string"
    },
    "descripcion": {
      "type": "blocks"
    },
    "portada_libro": {
      "type": "media",
      "multiple": false
    },
    "imagenes_interior": {
      "type": "media",
      "multiple": true
    },
    "obra": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::obra.obra",
      "inversedBy": "ediciones"
    },
    "autor_relacion": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::autor.autor",
      "inversedBy": "libros"
    },
    "editorial": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::editorial.editorial",
      "inversedBy": "libros"
    },
    "sello": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::sello.sello",
      "inversedBy": "libros"
    },
    "coleccion": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::coleccion.coleccion",
      "inversedBy": "libros"
    },
    "precio": {
      "type": "decimal",
      "min": 0,
      "description": "Precio principal del producto (se modifica desde la intranet)"
    },
    "precio_regular": {
      "type": "decimal",
      "min": 0,
      "description": "Precio regular en WooCommerce"
    },
    "precio_oferta": {
      "type": "decimal",
      "min": 0,
      "description": "Precio de oferta en WooCommerce"
    },
    "stock_quantity": {
      "type": "integer",
      "default": 0,
      "min": 0,
      "description": "Cantidad en stock (se modifica desde la intranet)"
    },
    "manage_stock": {
      "type": "boolean",
      "default": true,
      "description": "Si se gestiona el stock del producto"
    },
    "stock_status": {
      "type": "enumeration",
      "default": "instock",
      "enum": [
        "instock",
        "outofstock",
        "onbackorder"
      ],
      "description": "Estado del stock en WooCommerce"
    },
    "canales": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::canal.canal"
    },
    "marcas": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::marca.marca",
      "description": "Marcas (Brands) del producto en WooCommerce"
    },
    "etiquetas": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::etiqueta.etiqueta",
      "description": "Etiquetas (Tags) del producto en WooCommerce"
    },
    "categorias_producto": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::categoria-producto.categoria-producto",
      "description": "Categorías del producto en WooCommerce"
    },
    "libros_relacionados": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::libro.libro",
      "description": "Libros relacionados, series, o ediciones relacionadas"
    },
    "ofertas": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::oferta-producto.oferta-producto",
      "mappedBy": "libro"
    },
    "numero_edicion": {
      "type": "integer"
    },
    "agno_edicion": {
      "type": "integer"
    },
    "idioma": {
      "type": "enumeration",
      "enum": [
        "Español",
        "Inglés",
        "Francés",
        "Alemán",
        "Otro"
      ]
    },
    "tipo_libro": {
      "type": "enumeration",
      "enum": [
        "Plan Lector",
        "Texto Curricular",
        "Texto PAES",
        "Texto Complementario",
        "Otro"
      ]
    },
    "estado_edicion": {
      "type": "enumeration",
      "default": "Vigente",
      "enum": [
        "Vigente",
        "Stock Limitado",
        "Descatalogado"
      ]
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "rawWooData": {
      "type": "json",
      "description": "Datos completos del producto en formato WooCommerce (enviado desde Intranet)"
    },
    "weight": {
      "type": "decimal",
      "min": 0,
      "description": "Peso del producto en WooCommerce"
    },
    "length": {
      "type": "decimal",
      "min": 0,
      "description": "Largo del producto en WooCommerce"
    },
    "width": {
      "type": "decimal",
      "min": 0,
      "description": "Ancho del producto en WooCommerce"
    },
    "height": {
      "type": "decimal",
      "min": 0,
      "description": "Alto del producto en WooCommerce"
    },
    "featured": {
      "type": "boolean",
      "default": false,
      "description": "Producto destacado en WooCommerce"
    },
    "catalog_visibility": {
      "type": "enumeration",
      "default": "visible",
      "enum": [
        "visible",
        "catalog",
        "search",
        "hidden"
      ],
      "description": "Visibilidad del producto en el catálogo de WooCommerce"
    },
    "virtual": {
      "type": "boolean",
      "default": false,
      "description": "Si el producto es virtual en WooCommerce"
    },
    "downloadable": {
      "type": "boolean",
      "default": false,
      "description": "Si el producto es descargable en WooCommerce"
    },
    "tax_status": {
      "type": "enumeration",
      "default": "taxable",
      "enum": [
        "taxable",
        "shipping",
        "none"
      ],
      "description": "Estado de impuestos del producto en WooCommerce"
    },
    "tax_class": {
      "type": "string",
      "description": "Clase de impuesto del producto en WooCommerce"
    },
    "completitud_basica": {
      "type": "json"
    },
    "completo": {
      "type": "boolean",
      "default": false
    },
    "faltantes": {
      "type": "json"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "Pendiente",
      "enum": [
        "Publicado",
        "Pendiente",
        "Borrador"
      ],
      "description": "Estado de publicación del producto para aprobación"
    }
  }
}
```

### 2.2. Product · Libro · Autor (`api::autor.autor`)

```json
{
  "kind": "collectionType",
  "collectionName": "autores",
  "info": {
    "singularName": "autor",
    "pluralName": "autores",
    "displayName": "Product · Libro · Autor",
    "description": "Autores registrados"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "nombre_completo_autor": {
      "type": "string",
      "required": true
    },
    "id_autor": {
      "type": "integer",
      "unique": true,
      "default": null
    },
    "nombres": {
      "type": "string"
    },
    "primer_apellido": {
      "type": "string"
    },
    "segundo_apellido": {
      "type": "string"
    },
    "foto": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files",
        "videos",
        "audios"
      ]
    },
    "website": {
      "type": "string"
    },
    "resegna": {
      "type": "blocks"
    },
    "pais": {
      "type": "enumeration",
      "enum": [
        "Afganistán",
        "Albania",
        "Alemania",
        "Andorra",
        "Angola",
        "Antigua y Barbuda",
        "Arabia Saudí",
        "Argelia",
        "Argentina",
        "Armenia",
        "Australia",
        "Austria",
        "Azerbaiyán",
        "Bahamas",
        "Bangladés",
        "Barbados",
        "Baréin",
        "Bélgica",
        "Belice",
        "Benín",
        "Bielorrusia",
        "Birmania",
        "Bolivia",
        "Bosnia y Herzegovina",
        "Botsuana",
        "Brasil",
        "Brunéi",
        "Bulgaria",
        "Burkina Faso",
        "Burundi",
        "Bután",
        "Cabo Verde",
        "Camboya",
        "Camerún",
        "Canadá",
        "Catar",
        "Chad",
        "Chile",
        "China",
        "Chipre",
        "Colombia",
        "Comoras",
        "Corea del Norte",
        "Corea del Sur",
        "Costa de Marfil",
        "Costa Rica",
        "Croacia",
        "Cuba",
        "Dinamarca",
        "Dominica",
        "Ecuador",
        "Egipto",
        "El Salvador",
        "Emiratos Árabes Unidos",
        "Eritrea",
        "Eslovaquia",
        "Eslovenia",
        "España",
        "Estados Unidos",
        "Estonia",
        "Esuatini",
        "Etiopía",
        "Filipinas",
        "Finlandia",
        "Fiyi",
        "Francia",
        "Gabón",
        "Gambia",
        "Georgia",
        "Ghana",
        "Granada",
        "Grecia",
        "Guatemala",
        "Guinea",
        "Guinea-Bisáu",
        "Guinea Ecuatorial",
        "Guyana",
        "Haití",
        "Honduras",
        "Hungría",
        "India",
        "Indonesia",
        "Irak",
        "Irán",
        "Irlanda",
        "Islandia",
        "Islas Marshall",
        "Islas Salomón",
        "Israel",
        "Italia",
        "Jamaica",
        "Japón",
        "Jordania",
        "Kazajistán",
        "Kenia",
        "Kirguistán",
        "Kiribati",
        "Kuwait",
        "Laos",
        "Lesoto",
        "Letonia",
        "Líbano",
        "Liberia",
        "Libia",
        "Liechtenstein",
        "Lituania",
        "Luxemburgo",
        "Madagascar",
        "Malasia",
        "Malaui",
        "Maldivas",
        "Malí",
        "Malta",
        "Marruecos",
        "Mauricio",
        "Mauritania",
        "México",
        "Micronesia",
        "Moldavia",
        "Mónaco",
        "Mongolia",
        "Montenegro",
        "Mozambique",
        "Namibia",
        "Nauru",
        "Nepal",
        "Nicaragua",
        "Níger",
        "Nigeria",
        "Noruega",
        "Nueva Zelanda",
        "Omán",
        "Países Bajos",
        "Pakistán",
        "Palaos",
        "Palestina",
        "Panamá",
        "Papúa Nueva Guinea",
        "Paraguay",
        "Perú",
        "Polonia",
        "Portugal",
        "Reino Unido",
        "República Centroafricana",
        "República Checa",
        "República del Congo",
        "República Democrática del Congo",
        "República Dominicana",
        "Ruanda",
        "Rumania",
        "Rusia",
        "Samoa",
        "San Cristóbal y Nieves",
        "San Marino",
        "San Vicente y las Granadinas",
        "Santa Lucía",
        "Santo Tomé y Príncipe",
        "Senegal",
        "Serbia",
        "Seychelles",
        "Sierra Leona",
        "Singapur",
        "Siria",
        "Somalia",
        "Sri Lanka",
        "Sudáfrica",
        "Sudán",
        "Sudán del Sur",
        "Suecia",
        "Suiza",
        "Surinam",
        "Tailandia",
        "Tanzania",
        "Tayikistán",
        "Timor Oriental",
        "Togo",
        "Tonga",
        "Trinidad y Tobago",
        "Túnez",
        "Turkmenistán",
        "Turquía",
        "Tuvalu",
        "Ucrania",
        "Uganda",
        "Uruguay",
        "Uzbekistán",
        "Vanuatu",
        "Vaticano",
        "Venezuela",
        "Vietnam",
        "Yemen",
        "Yibuti",
        "Zambia",
        "Zimbabue"
      ]
    },
    "fecha_nacimiento": {
      "type": "date"
    },
    "fecha_muerte": {
      "type": "date"
    },
    "vivo_muerto": {
      "type": "boolean",
      "default": true
    },
    "obras": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::obra.obra",
      "mappedBy": "autores"
    },
    "libros": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::libro.libro",
      "mappedBy": "autor_relacion"
    },
    "tipo_autor": {
      "type": "enumeration",
      "enum": [
        "Persona",
        "Empresa"
      ]
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "pendiente",
      "enum": [
        "pendiente",
        "publicado"
      ]
    }
  }
}
```

### 2.3. Product · Libro · Editorial (`api::editorial.editorial`)

```json
{
  "kind": "collectionType",
  "collectionName": "editoriales",
  "info": {
    "singularName": "editorial",
    "pluralName": "editoriales",
    "displayName": "Product · Libro · Editorial",
    "description": "Catálogo de editoriales disponibles"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "id_editorial": {
      "type": "integer",
      "required": true,
      "unique": true
    },
    "nombre_editorial": {
      "type": "string",
      "required": true
    },
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files",
        "videos",
        "audios"
      ]
    },
    "acronimo": {
      "type": "string"
    },
    "website": {
      "type": "string"
    },
    "sellos": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::sello.sello",
      "mappedBy": "editorial"
    },
    "colecciones": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::coleccion.coleccion",
      "mappedBy": "editorial"
    },
    "libros": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::libro.libro",
      "mappedBy": "editorial"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    }
  }
}
```

### 2.4. Product · Libro · Obra (`api::obra.obra`)

```json
{
  "kind": "collectionType",
  "collectionName": "obras",
  "info": {
    "singularName": "obra",
    "pluralName": "obras",
    "displayName": "Product · Libro · Obra",
    "description": "Contenido abstracto independiente de la edición"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "codigo_obra": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "nombre_obra": {
      "type": "string",
      "required": true
    },
    "descripcion": {
      "type": "text",
      "required": false
    },
    "autores": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::autor.autor",
      "inversedBy": "obras"
    },
    "etiquetas": {
      "type": "json",
      "description": "Lista libre para clasificar la obra (géneros, temas, etc.)"
    },
    "ediciones": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::libro.libro",
      "mappedBy": "obra"
    },
    "materiales": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::material.material",
      "mappedBy": "obra"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "pendiente",
      "enum": [
        "pendiente",
        "publicado",
        "borrador"
      ]
    }
  }
}
```

### 2.5. Product · Libro · Sello (`api::sello.sello`)

```json
{
  "kind": "collectionType",
  "collectionName": "sellos",
  "info": {
    "singularName": "sello",
    "pluralName": "sellos",
    "displayName": "Product · Libro · Sello",
    "description": "Sellos editoriales asociados a una editorial"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "id_sello": {
      "type": "integer",
      "required": true,
      "unique": true,
      "default": null
    },
    "nombre_sello": {
      "type": "string",
      "required": true
    },
    "acronimo": {
      "type": "string"
    },
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": [
        "images",
        "files",
        "videos",
        "audios"
      ]
    },
    "website": {
      "type": "string"
    },
    "editorial": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::editorial.editorial",
      "inversedBy": "sellos"
    },
    "colecciones": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::coleccion.coleccion",
      "mappedBy": "sello"
    },
    "libros": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::libro.libro",
      "mappedBy": "sello"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "pendiente",
      "enum": [
        "pendiente",
        "publicado",
        "borrador"
      ]
    }
  }
}
```

### 2.6. Product · Libro · Serie / Colección (`api::coleccion.coleccion`)

```json
{
  "kind": "collectionType",
  "collectionName": "colecciones",
  "info": {
    "singularName": "coleccion",
    "pluralName": "colecciones",
    "displayName": "Product · Libro · Serie / Colección",
    "description": "Series o colecciones de libros. Pueden estar asociadas a una editorial/sello o ser independientes"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "id_coleccion": {
      "type": "integer",
      "required": false,
      "unique": true
    },
    "nombre_coleccion": {
      "type": "string",
      "required": false
    },
    "editorial": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::editorial.editorial",
      "description": "Opcional: Editorial asociada (si aplica)",
      "inversedBy": "colecciones"
    },
    "sello": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::sello.sello",
      "inversedBy": "colecciones"
    },
    "libros": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::libro.libro",
      "mappedBy": "coleccion"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "enum": [
        "pendiente",
        "publicado",
        "borrador"
      ],
      "default": "pendiente",
      "required": false
    }
  }
}
```

### 2.7. Categoría de Producto (`api::categoria-producto.categoria-producto`)

```json
{
  "kind": "collectionType",
  "collectionName": "categorias_producto",
  "info": {
    "singularName": "categoria-producto",
    "pluralName": "categorias-producto",
    "displayName": "Categoría de Producto",
    "description": "Categorías de productos para WooCommerce (Product Categories)"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "descripcion": {
      "type": "text"
    },
    "tipo_visualizacion": {
      "type": "enumeration",
      "enum": [
        "default",
        "products",
        "subcategories",
        "both"
      ],
      "default": "default"
    },
    "imagen": {
      "type": "media",
      "multiple": false
    },
    "categoria_padre": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::categoria-producto.categoria-producto",
      "inversedBy": "categorias_hijas"
    },
    "categorias_hijas": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::categoria-producto.categoria-producto",
      "mappedBy": "categoria_padre"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "pendiente",
      "enum": [
        "pendiente",
        "publicado",
        "borrador"
      ]
    }
  }
}
```

### 2.8. Etiqueta (Tag) (`api::etiqueta.etiqueta`)

```json
{
  "kind": "collectionType",
  "collectionName": "etiquetas",
  "info": {
    "singularName": "etiqueta",
    "pluralName": "etiquetas",
    "displayName": "Etiqueta (Tag)",
    "description": "Etiquetas de productos para WooCommerce (Product Tags)"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "descripcion": {
      "type": "text"
    },
    "externalIds": {
      "type": "json",
      "description": "IDs externos de WooCommerce: { woo_moraleja: 123, woo_escolar: 456 }"
    },
    "estado_publicacion": {
      "type": "enumeration",
      "default": "pendiente",
      "enum": [
        "pendiente",
        "publicado",
        "borrador"
      ]
    }
  }
}
```

---

## 3. Base de Datos de Personas

### 3.1. Persona (`api::persona.persona`)

```json
{
  "kind": "collectionType",
  "collectionName": "personas",
  "info": {
    "singularName": "persona",
    "pluralName": "personas",
    "displayName": "Persona",
    "description": "Contacto académico y general",
    "mainField": "rut"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "rut": {
      "type": "string",
      "unique": true
    },
    "nombres": {
      "type": "string"
    },
    "primer_apellido": {
      "type": "string"
    },
    "segundo_apellido": {
      "type": "string"
    },
    "nombre_apellidos": {
      "type": "string"
    },
    "iniciales": {
      "type": "string"
    },
    "nombre_completo": {
      "type": "string"
    },
    "status_nombres": {
      "type": "enumeration",
      "enum": [
        "Por Verificar",
        "Verificado",
        "Aprobado",
        "Eliminado",
        "Rechazado"
      ]
    },
    "nivel_confianza": {
      "type": "enumeration",
      "default": "baja",
      "enum": [
        "baja",
        "media",
        "alta"
      ]
    },
    "origen": {
      "type": "enumeration",
      "default": "manual",
      "enum": [
        "mineduc",
        "csv",
        "manual",
        "crm",
        "web",
        "otro"
      ]
    },
    "activo": {
      "type": "boolean",
      "default": true
    },
    "notas": {
      "type": "text"
    },
    "tags": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::persona-tag.persona-tag"
    },
    "genero": {
      "type": "enumeration",
      "enum": [
        "Mujer",
        "Hombre"
      ]
    },
    "cumpleagno": {
      "type": "date"
    },
    "cartera_asignaciones": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::cartera-asignacion.cartera-asignacion",
      "mappedBy": "ejecutivo"
    },
    "identificadores_externos": {
      "type": "json"
    },
    "emails": {
      "type": "component",
      "component": "contacto.email",
      "repeatable": true
    },
    "telefonos": {
      "type": "component",
      "component": "contacto.telefono",
      "repeatable": true
    },
    "imagen": {
      "type": "component",
      "component": "contacto.logo-o-avatar",
      "repeatable": false
    },
    "portal_account": {
      "type": "component",
      "component": "portal.account",
      "repeatable": false
    },
    "portal_roles": {
      "type": "component",
      "component": "portal.access-role",
      "repeatable": true
    },
    "portal_preferences": {
      "type": "component",
      "component": "portal.preferences",
      "repeatable": false
    },
    "portal_snapshot": {
      "type": "json"
    },
    "portal_last_synced_at": {
      "type": "datetime"
    },
    "trayectorias": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::persona-trayectoria.persona-trayectoria",
      "mappedBy": "persona"
    },
    "bio": {
      "type": "text"
    },
    "job_title": {
      "type": "string"
    },
    "telefono_principal": {
      "type": "string"
    },
    "direccion": {
      "type": "json"
    },
    "redes_sociales": {
      "type": "json"
    },
    "skills": {
      "type": "json"
    }
  }
}
```

---

## Notas Técnicas

### Relaciones Clave

1. **MIRA.APP:**
   - `persona-mira` → `persona` (manyToOne)
   - `persona-mira` → `licencia-estudiante` (oneToMany)
   - `libro-mira` → `libro` (manyToOne)
   - `libro-mira` → `licencia-estudiante` (oneToMany)
   - `licencia-estudiante` → `persona-mira` (manyToOne)
   - `licencia-estudiante` → `libro-mira` (manyToOne)
   - `omr-evaluacion` → `persona-mira` (manyToOne)
   - `omr-evaluacion` → `libro-mira` (manyToOne, opcional)

2. **Catálogo de Productos:**
   - `libro` → `obra` (manyToOne)
   - `libro` → `autor` (manyToOne)
   - `libro` → `editorial` (manyToOne)
   - `libro` → `sello` (manyToOne)
   - `libro` → `coleccion` (manyToOne)
   - `libro` → `categoria-producto` (manyToMany)
   - `libro` → `etiqueta` (manyToMany)
   - `sello` → `editorial` (manyToOne)
   - `coleccion` → `editorial` (manyToOne, opcional)
   - `coleccion` → `sello` (manyToOne, opcional)

### Campos Importantes

- **`draftAndPublish`**: Todos los content types tienen esta opción habilitada, lo que significa que tienen estados de borrador y publicado.
- **`externalIds`**: Campo JSON usado para sincronización con WooCommerce (almacena IDs de `woo_moraleja` y `woo_escolar`).
- **`estado_publicacion`**: Campo de enumeración usado para controlar el flujo de publicación en algunos content types.

---

**Generado automáticamente el:** 2026-01-02  
**Proyecto:** MIRA.APP + Intranet/WooCommerce  
**Strapi Version:** 5.29.0


