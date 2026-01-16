#!/usr/bin/env node

/**
 * Mapeo de nombres de hojas de Google Sheets a collection types de Strapi
 * 
 * Este archivo centraliza el mapeo para que todos los scripts lo usen
 */

// Mapeo: nombre de hoja -> { collectionType, pluralName }
export const MAPEO_HOJA_A_COLLECTION_TYPE = {
  // Productos y Catálogo
  'Editoriales': { collectionType: 'api::editorial.editorial', pluralName: 'editoriales' },
  'Libros': { collectionType: 'api::libro.libro', pluralName: 'libros' },
  'Autores': { collectionType: 'api::autor.autor', pluralName: 'autores' },
  'Obras': { collectionType: 'api::obra.obra', pluralName: 'obras' },
  'Colecciones': { collectionType: 'api::coleccion.coleccion', pluralName: 'colecciones' },
  'Sellos': { collectionType: 'api::sello.sello', pluralName: 'sellos' },
  
  // Colegios y Académico
  'Colegios': { collectionType: 'api::colegio.colegio', pluralName: 'colegios' },
  'Niveles': { collectionType: 'api::nivel.nivel', pluralName: 'niveles' },
  'Cursos': { collectionType: 'api::curso.curso', pluralName: 'cursos' },
  'Asignaturas': { collectionType: 'api::asignatura.asignatura', pluralName: 'asignaturas' },
  'Curso-Asignaturas': { collectionType: 'api::curso-asignatura.curso-asignatura', pluralName: 'curso-asignaturas' },
  
  // Personas y Contactos
  'Personas': { collectionType: 'api::persona.persona', pluralName: 'personas' },
  'Persona-Tags': { collectionType: 'api::persona-tag.persona-tag', pluralName: 'persona-tags' },
  'Persona-Trayectorias': { collectionType: 'api::persona-trayectoria.persona-trayectoria', pluralName: 'persona-trayectorias' },
  'Clientes': { collectionType: 'api::customer.customer', pluralName: 'customers' },
  
  // Comercial
  'Cotizaciones': { collectionType: 'api::cotizacion.cotizacion', pluralName: 'cotizaciones' },
  'Listas-Escolares': { collectionType: 'api::lista-escolar.lista-escolar', pluralName: 'lista-escolars' },
  'Ofertas-Producto': { collectionType: 'api::oferta-producto.oferta-producto', pluralName: 'oferta-productos' },
  'Listas-Descuento': { collectionType: 'api::lista-descuento.lista-descuento', pluralName: 'lista-descuentos' },
  
  // Intranet
  'Colaboradores': { collectionType: 'api::colaborador.colaborador', pluralName: 'colaboradores' },
  'Cartera-Asignaciones': { collectionType: 'api::cartera-asignacion.cartera-asignacion', pluralName: 'cartera-asignacions' },
  'Cartera-Periodos': { collectionType: 'api::cartera-periodo.cartera-periodo', pluralName: 'cartera-periodos' },
  'Empresas': { collectionType: 'api::empresa.empresa', pluralName: 'empresas' },
  
  // Media y Contenido
  'Media-Assets': { collectionType: 'api::media-asset.media-asset', pluralName: 'media-assets' },
  'Media-Tags': { collectionType: 'api::media-tag.media-tag', pluralName: 'media-tags' },
  'Media-Categories': { collectionType: 'api::media-category.media-category', pluralName: 'media-categories' },
  
  // Noticias y Contenido
  'News-Articles': { collectionType: 'api::news-article.news-article', pluralName: 'news-articles' },
  'News-Authors': { collectionType: 'api::news-author.news-author', pluralName: 'news-authors' },
  'News-Categories': { collectionType: 'api::news-category.news-category', pluralName: 'news-categories' },
  'News-Tags': { collectionType: 'api::news-tag.news-tag', pluralName: 'news-tags' },
  
  // Ubicación
  'Regiones': { collectionType: 'api::region.region', pluralName: 'regiones' },
  'Provincias': { collectionType: 'api::provincia.provincia', pluralName: 'provincias' },
  'Comunas': { collectionType: 'api::comuna.comuna', pluralName: 'comunas' },
  'Zonas': { collectionType: 'api::zona.zona', pluralName: 'zonas' },
  
  // Otros
  'Canales': { collectionType: 'api::canal.canal', pluralName: 'canals' },
  'Materiales': { collectionType: 'api::material.material', pluralName: 'materials' },
  'Datos-Facturacion': { collectionType: 'api::datos-facturacion.datos-facturacion', pluralName: 'datos-facturacions' },
  'Turnos': { collectionType: 'api::turno.turno', pluralName: 'turnos' },
  'Configuracion-Turnos': { collectionType: 'api::configuracion-turnos.configuracion-turnos', pluralName: 'configuracion-turnos' },
};

/**
 * Obtiene el collection type desde el nombre de la hoja
 */
export function getCollectionTypeFromSheetName(sheetName) {
  const mapeo = MAPEO_HOJA_A_COLLECTION_TYPE[sheetName];
  return mapeo ? mapeo.collectionType : null;
}

/**
 * Obtiene el pluralName desde el nombre de la hoja
 */
export function getPluralNameFromSheetName(sheetName) {
  const mapeo = MAPEO_HOJA_A_COLLECTION_TYPE[sheetName];
  return mapeo ? mapeo.pluralName : null;
}

/**
 * Obtiene el nombre de la hoja desde el collection type
 */
export function getSheetNameFromCollectionType(collectionType) {
  const entries = Object.entries(MAPEO_HOJA_A_COLLECTION_TYPE);
  const found = entries.find(([_, mapeo]) => mapeo.collectionType === collectionType);
  return found ? found[0] : null;
}

/**
 * Lista todos los nombres de hojas disponibles
 */
export function getAllSheetNames() {
  return Object.keys(MAPEO_HOJA_A_COLLECTION_TYPE);
}

/**
 * Lista todos los collection types disponibles
 */
export function getAllCollectionTypes() {
  return Object.values(MAPEO_HOJA_A_COLLECTION_TYPE).map(m => m.collectionType);
}

