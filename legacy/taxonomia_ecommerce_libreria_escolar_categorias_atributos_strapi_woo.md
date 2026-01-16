# Taxonomía Ecommerce — Librería Escolar (categorías, atributos, Strapi/Woo)

> Objetivo: definir una **clasificación práctica** para una librería escolar (B2C y B2B colegios) y dejar lista su **implementación en Strapi** (y mapeable a WooCommerce). Incluye categorías → subcategorías → atributos/etiquetas, slugs, CSV de semillas y notas de filtros/SEO.

---

## 1) Estructura jerárquica (Departamentos → Categorías → Subcategorías)

> Reglas: máximo **3 niveles** para menú y SEO limpio. Slugs en minúsculas, con guiones. Campo `order` en múltiplos de 10.

### DEPARTAMENTO 1: **Libros** (`libros`)
- **Curriculares** (`curriculares`)
  - Educación Parvularia (`parvularia`)
  - 1º Básico a 8º Básico (`1-basico` … `8-basico`)
  - I° Medio a IV° Medio (`1-medio` … `4-medio`)
  - Asignaturas: Lenguaje (`lenguaje`), Matemática (`matematica`), Ciencias Naturales (`ciencias`), Historia (`historia`), Inglés (`ingles`), Filosofía (`filosofia`) *(como etiqueta o 3er nivel si hace falta)*
- **Plan Lector** (`plan-lector`)
  - Infantil (`infantil`)
  - Juvenil (`juvenil`)
  - Clásicos (`clasicos`)
  - Contemporáneos (`contemporaneos`)
- **PAES / SIMCE** (`paes-simce`)
  - PAES Lenguaje (`paes-lenguaje`)
  - PAES Matemática M1/M2 (`paes-matematica-m1`, `paes-matematica-m2`)
  - PAES Ciencias (Bio/Fis/Quim) (`paes-ciencias`)
  - SIMCE Lenguaje (`simce-lenguaje`)
  - SIMCE Matemática (`simce-matematica`)
- **Idiomas** (`idiomas`)
  - Español como L2 (`ele`)
  - Inglés (`english`)
  - Francés (`frances`)
- **Diccionarios** (`diccionarios`)
  - Español (`dicc-espanol`)
  - Bilingües (ES–EN, ES–FR, etc.) (`dicc-bilingues`)
- **Referencia y Apoyo** (`referencia-apoyo`)
  - Guías / Resúmenes (`guias-resumenes`)
  - Atlas / Mapas (`atlas-mapas`)
  - Ortografía / Gramática (`ortografia-gramatica`)

### DEPARTAMENTO 2: **Material Escolar** (`material-escolar`)
- **Cuadernos** (`cuadernos`)
  - Universitario (`universitario`)
  - Colegio (`colegio`)
  - Profesional (`profesional`)
- **Blocks y Papeles** (`blocks-papeles`)
  - Block de dibujo (`block-dibujo`)
  - Block universitario (`block-universitario`)
  - Papel lustre / Cartulina (`papel-lustre-cartulina`)
- **Escritura** (`escritura`)
  - Lápices grafito (`lapiz-grafito`)
  - Lápices pasta / gel (`lapiz-pasta-gel`)
  - Marcadores / Plumones (`marcadores`)
- **Organización** (`organizacion`)
  - Archivadores / Carpetas (`archivadores-carpetas`)
  - Fundas / Separadores (`fundas-separadores`)
  - Estuches (`estuches`)
- **Adhesivos y Corrección** (`adhesivos-correccion`)
  - Stickers / Notas (`stickers-notas`)
  - Gomas / Correctores (`gomas-correctores`)
- **Mochilas y Estuches** (`mochilas-estuches`)
  - Mochilas escolares (`mochilas-escolares`)
  - Loncheras / Bolsos (`loncheras-bolsos`)

### DEPARTAMENTO 3: **Arte y Manualidades** (`arte-manualidades`)
- **Pinturas y Color** (`pinturas-color`)
  - Tempera / Acrílico (`tempera-acrilico`)
  - Lápices de color (`lapices-color`)
  - Acuarela (`acuarela`)
- **Dibujo Técnico** (`dibujo-tecnico`)
  - Reglas / Escuadras / Compás (`reglas-escuadras-compas`)
- **Modelado y Pegamentos** (`modelado-pegamentos`)
  - Plasticina / Arcilla (`plasticina-arcilla`)
  - Pegamentos escolares (`pegamentos`)

### DEPARTAMENTO 4: **Tecnología y Calculadoras** (`tecnologia-calculadoras`)
- **Calculadoras** (`calculadoras`)
  - Escolar / Científica (`escolar-cientifica`)
  - Gráfica (`grafica`)
- **Periféricos escolares** (`perifericos`)
  - Mouse / Teclado (`mouse-teclado`)
  - Audífonos (`audifonos`)

### DEPARTAMENTO 5: **Didácticos y Juegos Educativos** (`didacticos`)
- **Preescolar** (`preescolar`)
- **Lenguaje** (`did-lenguaje`)
- **Matemática** (`did-matematica`)
- **Ciencias** (`did-ciencias`)

### DEPARTAMENTO 6: **Oficina y Servicios** (`oficina-servicios`)
- **Suministros de oficina** (`suministros-oficina`)
- **Impresión y Encuadernación** (`impresion-encuadernacion`)
- **Packs y Listas Escolares** (`packs-listas`)
  - Pack por curso (1°B, 2°B, …) (`pack-curso`)
  - Pack por colegio (`pack-colegio`)

---

## 2) Atributos por tipo de producto (para filtros)

> Se gestionan como **componentes** o **Content‑Type por tipo**. Recomendado: un `Product` con **componentes por tipo** (dynamic zone) y **atributos comunes**.

### Atributos comunes `Product`
- `brand` (Marca)
- `barcode` (EAN/UPC) — opcional
- `sku` / `isbn` (si libro)
- `price`, `listPrice`, `stock`
- `ageRange` (Rango edad) — ej. `6-8`, `9-12`, `13+`
- `gradeRange` (Curso) — ej. `1B`, `6B`, `I M`
- `language` (Idioma) — `es`, `en`, `fr`

### **Libro** (componente `bookSpecs`)
- `isbn`, `author`, `editorial`, `editionYear`, `editionNumber`
- `level` (Parvularia/1°B…IV°M), `subject` (Lenguaje, Matemática…)
- `binding` (Rústica, Tapa dura), `pages`, `format` (14x21, A4…)
- `collection` (Plan lector, Serie, etc.)

### **Cuaderno** (componente `notebookSpecs`)
- `size` (Carta, Oficio, A4, 1/8, 1/4)
- `ruling` (Cuadro chileno, Universitario, Caligrafía)
- `sheets` (48, 60, 100)
- `gsm` (gramaje: 70, 75, 90)
- `cover` (Tapa dura/blanda), `binding` (Anillado/Corchete)

### **Block/Papel** (componente `paperSpecs`)
- `size` (A4, A3, Oficio)
- `type` (Dibujo, Universitario, Lustre, Cartulina)
- `gsm` (90, 120, 180)

### **Mochila** (componente `bagSpecs`)
- `capacityLiters`, `size` (S/M/L), `material`, `compartments`

### **Calculadora** (componente `calcSpecs`)
- `type` (Escolar, Científica, Gráfica), `power` (Solar/Pilas), `functionsCount`

---

## 3) Implementación en Strapi (modelos)

**Entidades**
- `Category` (jerárquica 3 niveles) — **colección**
- `Product` — **colección**
- `Tag` — **colección** (para señales de marketing: *nuevo*, *oferta*, *recomendado*, *bilingüe*, *MEJOR PRECIO*, etc.)

**Category (schema sugerido)**
- `name` (unique), `slug` (uid), `description` (text), `isActive` (bool), `order` (int)
- `parent` (relación self manyToOne)
- `children` (self oneToMany `mappedBy: parent`)
- `icon` (media, opcional)

**Product (extensión)**
- `categories` (manyToMany → `Category`)
- `tags` (manyToMany → `Tag`)
- `type` (enum: `book`, `notebook`, `paper`, `bag`, `calc`, `generic`)
- `specs` (Dynamic Zone con componentes por tipo: `bookSpecs`, `notebookSpecs`, …)

> Ventaja: un producto puede estar en **múltiples categorías** (p.ej., “Plan lector” y “Infantil”), sin duplicarlo.

---

## 4) Semillas de categorías (CSV)

> Puedes importar con plugin de importación; columnas: `name,slug,description,isActive,order,parent.slug`

```csv
name,slug,description,isActive,order,parent.slug
Libros,libros,Libros y textos escolares,TRUE,10,
Curriculares,curriculares,Libros curriculares por nivel,TRUE,10,libros
Educación Parvularia,parvularia,Etapa inicial,TRUE,10,curriculares
1º Básico,1-basico,Nivel básico,TRUE,20,curriculares
2º Básico,2-basico,Nivel básico,TRUE,30,curriculares
3º Básico,3-basico,Nivel básico,TRUE,40,curriculares
4º Básico,4-basico,Nivel básico,TRUE,50,curriculares
5º Básico,5-basico,Nivel básico,TRUE,60,curriculares
6º Básico,6-basico,Nivel básico,TRUE,70,curriculares
7º Básico,7-basico,Nivel básico,TRUE,80,curriculares
8º Básico,8-basico,Nivel básico,TRUE,90,curriculares
I° Medio,1-medio,Enseñanza media,TRUE,100,curriculares
II° Medio,2-medio,Enseñanza media,TRUE,110,curriculares
III° Medio,3-medio,Enseñanza media,TRUE,120,curriculares
IV° Medio,4-medio,Enseñanza media,TRUE,130,curriculares
Plan Lector,plan-lector,Lecturas por edad o colección,TRUE,20,libros
Infantil,infantil,Plan lector infantil,TRUE,10,plan-lector
Juvenil,juvenil,Plan lector juvenil,TRUE,20,plan-lector
Clásicos,clasicos,Obras clásicas,TRUE,30,plan-lector
Contemporáneos,contemporaneos,Autores actuales,TRUE,40,plan-lector
PAES / SIMCE,paes-simce,Preparación evaluaciones,TRUE,30,libros
PAES Lenguaje,paes-lenguaje,,TRUE,10,paes-simce
PAES Matemática M1,paes-matematica-m1,,TRUE,20,paes-simce
PAES Matemática M2,paes-matematica-m2,,TRUE,30,paes-simce
PAES Ciencias,paes-ciencias,,TRUE,40,paes-simce
SIMCE Lenguaje,simce-lenguaje,,TRUE,50,paes-simce
SIMCE Matemática,simce-matematica,,TRUE,60,paes-simce
Idiomas,idiomas,Aprendizaje de idiomas,TRUE,40,libros
ELE (Español L2),ele,,TRUE,10,idiomas
Inglés,english,,TRUE,20,idiomas
Francés,frances,,TRUE,30,idiomas
Diccionarios,diccionarios,,TRUE,50,libros
Español,dicc-espanol,,TRUE,10,diccionarios
Bilingües, dicc-bilingues,,TRUE,20,diccionarios
Referencia y Apoyo,referencia-apoyo,,TRUE,60,libros
Guías/Resúmenes,guias-resumenes,,TRUE,10,referencia-apoyo
Atlas/Mapas,atlas-mapas,,TRUE,20,referencia-apoyo
Ortografía/Gramática,ortografia-gramatica,,TRUE,30,referencia-apoyo
Material Escolar,material-escolar,Suministros escolares,TRUE,20,
Cuadernos,cuadernos,Cuadernos por formato/rayado,TRUE,10,material-escolar
Universitario,universitario,,TRUE,10,cuadernos
Colegio,colegio,,TRUE,20,cuadernos
Profesional,profesional,,TRUE,30,cuadernos
Blocks y Papeles,blocks-papeles,,TRUE,20,material-escolar
Block de dibujo,block-dibujo,,TRUE,10,blocks-papeles
Block universitario,block-universitario,,TRUE,20,blocks-papeles
Papel lustre/Cartulina,papel-lustre-cartulina,,TRUE,30,blocks-papeles
Escritura,escritura,,TRUE,30,material-escolar
Lápiz grafito,lapiz-grafito,,TRUE,10,escritura
Lápiz pasta/gel,lapiz-pasta-gel,,TRUE,20,escritura
Marcadores/plumones,marcadores,,TRUE,30,escritura
Organización,organizacion,,TRUE,40,material-escolar
Archivadores/carpetas,archivadores-carpetas,,TRUE,10,organizacion
Fundas/separadores,fundas-separadores,,TRUE,20,organizacion
Estuches,estuches,,TRUE,30,organizacion
Adhesivos y Corrección,adhesivos-correccion,,TRUE,50,material-escolar
Stickers/notas,stickers-notas,,TRUE,10,adhesivos-correccion
Gomas/correctores,gomas-correctores,,TRUE,20,adhesivos-correccion
Mochilas y estuches,mochilas-estuches,,TRUE,60,material-escolar
Mochilas escolares,mochilas-escolares,,TRUE,10,mochilas-estuches
Loncheras/bolsos,loncheras-bolsos,,TRUE,20,mochilas-estuches
Arte y Manualidades,arte-manualidades,,TRUE,30,
Pinturas y color,pinturas-color,,TRUE,10,arte-manualidades
Tempera/Acrílico,tempera-acrilico,,TRUE,10,pinturas-color
Lápices de color,lapices-color,,TRUE,20,pinturas-color
Acuarela,acuarela,,TRUE,30,pinturas-color
Dibujo técnico,dibujo-tecnico,,TRUE,20,arte-manualidades
Reglas/Escuadras/Compás,reglas-escuadras-compas,,TRUE,10,dibujo-tecnico
Modelado y Pegamentos,modelado-pegamentos,,TRUE,30,arte-manualidades
Plasticina/Arcilla,plasticina-arcilla,,TRUE,10,modelado-pegamentos
Pegamentos escolares,pegamentos,,TRUE,20,modelado-pegamentos
Tecnología y Calculadoras,tecnologia-calculadoras,,TRUE,40,
Calculadoras,calculadoras,,TRUE,10,tecnologia-calculadoras
Escolar/Científica,escolar-cientifica,,TRUE,10,calculadoras
Gráfica,grafica,,TRUE,20,calculadoras
Periféricos escolares,perifericos,,TRUE,20,tecnologia-calculadoras
Mouse/Teclado,mouse-teclado,,TRUE,10,perifericos
Audífonos,audifonos,,TRUE,20,perifericos
Didácticos y Juegos,didacticos,,TRUE,50,
Preescolar,preescolar,,TRUE,10,didacticos
Lenguaje,did-lenguaje,,TRUE,20,didacticos
Matemática,did-matematica,,TRUE,30,didacticos
Ciencias,did-ciencias,,TRUE,40,didacticos
Oficina y Servicios,oficina-servicios,,TRUE,60,
Suministros de oficina,suministros-oficina,,TRUE,10,oficina-servicios
Impresión y Encuadernación,impresion-encuadernacion,,TRUE,20,oficina-servicios
Packs y Listas,packs-listas,,TRUE,30,oficina-servicios
Pack por curso,pack-curso,,TRUE,10,packs-listas
Pack por colegio,pack-colegio,,TRUE,20,packs-listas
```

---

## 5) Tags sugeridos (marketing y búsqueda)

- **Novedad**, **Oferta**, **Top Ventas**, **Recomendado docente**, **Bilingüe**, **Edición 2026**, **Ecológico**, **Formato digital**, **Con licencia**
- **Plan Lector 1°B**, **Plan Lector 6°B**, **Plan Lector I°M** (atajos por curso)

CSV rápido:
```csv
name,slug,description,isActive,order
Novedad,novedad,,TRUE,10
Oferta,oferta,,TRUE,20
Top Ventas,top-ventas,,TRUE,30
Recomendado docente,recomendado-docente,,TRUE,40
Bilingüe,bilingue,,TRUE,50
Edición 2026,edicion-2026,,TRUE,60
Ecológico,ecologico,,TRUE,70
Formato digital,formato-digital,,TRUE,80
Con licencia,con-licencia,,TRUE,90
```

---

## 6) UX de filtros (facetas por categoría)

- **Libros**: Autor, Editorial, Asignatura, Curso, Idioma, Formato, Encuadernación, Año edición, Páginas, ISBN.
- **Cuadernos**: Tamaño, Rayado, Nº Hojas, Gramaje, Tapa, Anillado, Marca.
- **Blocks/Papel**: Tamaño, Tipo, Gramaje, Marca.
- **Mochilas**: Capacidad (L), Tamaño, Material, Marca.
- **Calculadoras**: Tipo, Alimentación, Funciones, Marca.

> Performance: limitar facetas visibles a las relevantes por categoría; lazy‑load de facetas al seleccionar.

---

## 7) URL y breadcrumbs

- `/c/libros/plan-lector/juvenil/titulo-ejemplo`
- `/c/material-escolar/cuadernos/universitario/cuaderno-100h`
- Breadcrumb: Inicio › Libros › Plan lector › Juvenil.

---

## 8) Strapi — schemas (Category & Product extracto)

`src/api/category/content-types/category/schema.json`
```json
{
  "kind": "collectionType",
  "collectionName": "categories",
  "info": {"singularName":"category","pluralName":"categories","displayName":"Category"},
  "options": {"draftAndPublish": true},
  "attributes": {
    "name": {"type":"string", "required": true, "unique": true},
    "slug": {"type":"uid", "targetField":"name", "required": true, "unique": true},
    "description": {"type":"text"},
    "isActive": {"type":"boolean", "default": true},
    "order": {"type":"integer", "default": 0},
    "parent": {"type":"relation","relation":"manyToOne","target":"api::category.category","inversedBy":"children"},
    "children": {"type":"relation","relation":"oneToMany","target":"api::category.category","mappedBy":"parent"}
  }
}
```

`src/components/specs/book-specs.json` (componente)
```json
{
  "collectionName": "components_specs_book",
  "info": {"displayName": "bookSpecs"},
  "attributes": {
    "isbn": {"type":"string"},
    "author": {"type":"string"},
    "editorial": {"type":"string"},
    "editionYear": {"type":"integer"},
    "editionNumber": {"type":"integer"},
    "level": {"type":"string"},
    "subject": {"type":"string"},
    "binding": {"type":"string"},
    "pages": {"type":"integer"},
    "format": {"type":"string"},
    "collection": {"type":"string"}
  }
}
```

`src/api/product/content-types/product/schema.json` (extracto)
```json
{
  "attributes": {
    "categories": {"type":"relation","relation":"manyToMany","target":"api::category.category"},
    "tags": {"type":"relation","relation":"manyToMany","target":"api::tag.tag"},
    "type": {"type":"enumeration","enum":["book","notebook","paper","bag","calc","generic"],"default":"generic"},
    "specs": {"type":"dynamiczone","components":["specs.book-specs","specs.notebook-specs","specs.paper-specs","specs.bag-specs","specs.calc-specs"]}
  }
}
```

---

## 9) WooCommerce — mapeo

- **Categorías**: export/import usando `slug` idéntico a Strapi para sincronía.
- **Atributos**: crear `pa_autor`, `pa_editorial`, `pa_curso`, `pa_idioma`, etc.; mismas opciones que en Strapi.
- **Tags**: igual que Strapi para campañas.
- **Sincronización**: clave por `sku`/`isbn` y `slug` de categorías.

---

## 10) Checklist de implementación

- [ ] `Category` creado (self‑relation parent/children).
- [ ] `Product` con `categories`, `type`, `specs` (dynamic zone), `tags`.
- [ ] Componentes `bookSpecs`, `notebookSpecs`, `paperSpecs`, `bagSpecs`, `calcSpecs`.
- [ ] Semillas CSV de categorías cargadas y ordenadas.
- [ ] Filtros por facetas activados por categoría.
- [ ] URLs y breadcrumbs funcionando.
- [ ] Mapeo con WooCommerce validado (slugs y atributos).

---

## 11) Extensiones futuras

- **Packs dinámicos**: generar `pack-curso` desde listas escolares (JSON por colegio/curso).
- **SEO**: componente `seo` por categoría.
- **Recomendador**: “Clientes que compraron *X* también miraron *Y*” por categoría y curso.
- **B2B**: precios por colegio/municipio según categoría (role-based pricing).

