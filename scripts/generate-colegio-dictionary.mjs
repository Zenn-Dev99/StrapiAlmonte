import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const EXPORT_PATH = path.join('data','csv','export','colegios_export.csv');
const OUT_PATH = path.join('docs','diccionario-colegio-content-type.csv');
const CT_UID = 'api::colegio.colegio';
const CT_API_NAME = 'colegio';
const schema = JSON.parse(fs.readFileSync(path.join('src','api','colegio','content-types','colegio','schema.json'),'utf8'));
const DISPLAY_NAME = schema.info?.displayName || 'Colegio';
const COLLECTION_NAME = schema.collectionName || 'colegios';
const SECTION = schema.kind === 'singleType' ? 'Single Type' : 'Collection Type';

const csvRaw = fs.readFileSync(EXPORT_PATH,'utf8');
const rows = parse(csvRaw,{ columns:true });
const headers = Object.keys(rows[0] || {});

function firstExample(field) {
  for (const row of rows) {
    const value = row[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function startCase(str) {
  return str
    .replace(/_/g,' ')
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/(^|\s)([a-z])/g,(_,a,b)=>a + b.toUpperCase());
}

function loadComponentSchema(componentUid) {
  const [category, name] = componentUid.split('.');
  const schemaPath = path.join('src','components',category,name,'schema.json');
  if (fs.existsSync(schemaPath)) {
    return JSON.parse(fs.readFileSync(schemaPath,'utf8'));
  }
  const legacyPath = path.join('src','components',category,`${name}.json`);
  if (fs.existsSync(legacyPath)) {
    return JSON.parse(fs.readFileSync(legacyPath,'utf8'));
  }
  throw new Error(`No se encontró el schema del componente ${componentUid}`);
}

function loadApiSchema(apiUid) {
  const [scope, rest] = apiUid.split('::');
  const [apiName, ctName] = rest.split('.');
  const filePath = path.join('src','api',apiName,'content-types',ctName,'schema.json');
  return JSON.parse(fs.readFileSync(filePath,'utf8'));
}

const relationSchemas = new Map();
function getRelationSchema(targetUid) {
  if (!relationSchemas.has(targetUid)) {
    relationSchemas.set(targetUid, loadApiSchema(targetUid));
  }
  return relationSchemas.get(targetUid);
}

function describeEnumeration(values) {
  return `Valores: ${values.join(', ')}`;
}

function attributeMeta(attr) {
  if (!attr) return { tipo: 'string', detalles: '' };
  if (attr.type === 'enumeration') {
    return { tipo: 'enumeration', detalles: describeEnumeration(attr.enum) };
  }
  if (attr.type === 'relation') {
    const dir = attr.relation;
    const target = attr.target;
    const rel = `${dir} → ${target}`;
    return { tipo: 'relation', detalles: rel };
  }
  if (attr.type === 'component') {
    return { tipo: attr.repeatable ? 'component lista' : 'component', detalles: attr.component };
  }
  if (attr.type === 'media') {
    return { tipo: attr.multiple ? 'media (multiple)' : 'media (single)', detalles: '' };
  }
  return { tipo: attr.type, detalles: '' };
}

const definitions = new Map();
function addDefinition(key, meta = {}) {
  if (definitions.has(key)) {
    throw new Error(`Definición duplicada para ${key}`);
  }
  definitions.set(key, {
    check: meta.check === false ? 'FALSE' : 'TRUE',
    notas: meta.notas || '',
    nombreDisplay: meta.nombreDisplay || DISPLAY_NAME,
    campo: meta.campo || key,
    nombreVariable: meta.nombreVariable || startCase(key),
    fieldUid: meta.fieldUid || `${CT_UID}.${meta.campo || key}`,
    tipo: meta.tipo || 'string',
    uid: meta.uid || CT_UID,
    nombreApi: meta.nombreApi || CT_API_NAME,
    seccion: meta.seccion || SECTION,
    coleccion: meta.coleccion || COLLECTION_NAME,
    detalles: meta.detalles || '',
    obligatorio: meta.obligatorio ? 'Sí' : '',
    unico: meta.unico ? 'Sí' : '',
  });
}

function addSystemFields() {
  addDefinition('colegio_documentId', {
    campo: 'documentId',
    nombreVariable: 'Document ID',
    tipo: 'string',
    detalles: 'Document ID autogenerado por Strapi (UID de contenido).'
  });
  addDefinition('colegio_id', {
    campo: 'id',
    nombreVariable: 'ID interno',
    tipo: 'integer',
    detalles: 'ID incremental interno de la tabla.',
  });
  for (const field of ['created_at','updated_at','published_at']) {
    const name = field.replace('_at','');
    addDefinition(field, {
      campo: name === 'published' ? 'publishedAt' : `${name}At`,
      nombreVariable: startCase(name === 'published' ? 'published at' : `${name} at`),
      tipo: 'datetime',
      detalles: 'Metadato gestionado por Strapi.',
    });
  }
}

function addSimpleAttribute(key, label) {
  const attr = schema.attributes[key];
  if (!attr) throw new Error(`Atributo ${key} no encontrado`);
  const { tipo, detalles } = attributeMeta(attr);
  addDefinition(key, {
    campo: key,
    nombreVariable: label || startCase(key),
    tipo,
    detalles: attr.type === 'enumeration' ? describeEnumeration(attr.enum) : '',
    obligatorio: attr.required,
    unico: attr.unique,
  });
}

function addRelationField(options) {
  const { column, relationName, targetUid, targetField, nombreVariable, descripcion } = options;
  const attr = schema.attributes[relationName];
  const relDetails = attr ? `${attr.relation} → ${attr.target}` : '';
  const fieldUid = attr ? `${CT_UID}.${relationName} -> ${targetUid}.${targetField || 'id'}` : `${CT_UID}.${relationName}`;
  addDefinition(column, {
    campo: relationName,
    nombreVariable,
    tipo: 'relation',
    detalles: descripcion || `Campo derivado de la relación (${relDetails}).`,
    fieldUid,
  });
}

function addComponentFields({
  attrName,
  componentUid,
  label,
  count,
  fields,
  prefix,
}) {
  const comp = loadComponentSchema(componentUid);
  for (let i = 1; i <= count; i++) {
    for (const fieldName of fields) {
      const compAttr = comp.attributes[fieldName];
      const { tipo, detalles } = attributeMeta(compAttr);
      addDefinition(`${prefix || attrName}_${i}_${fieldName}`, {
        campo: attrName,
        nombreVariable: `${comp.info.displayName} ${i} · ${startCase(fieldName)}`,
        tipo,
        detalles: compAttr?.type === 'enumeration' ? `${comp.info.displayName}: ${describeEnumeration(compAttr.enum)}` : `Componente ${comp.info.displayName}${count > 1 ? ' (índice ' + i + ')' : ''}.`,
        fieldUid: `${CT_UID}.${attrName} -> ${componentUid}.${fieldName}`,
      });
    }
  }
}

function addComponentSimpleFields({ attrName, componentUid, fields }) {
  const comp = loadComponentSchema(componentUid);
  for (const fieldName of fields) {
    const compAttr = comp.attributes[fieldName];
    const { tipo } = attributeMeta(compAttr);
    let detalles = `Componente ${comp.info.displayName}.`;
    if (compAttr?.type === 'enumeration') detalles = `${comp.info.displayName}: ${describeEnumeration(compAttr.enum)}`;
    addDefinition(`${attrName}_${fieldName}`, {
      campo: attrName,
      nombreVariable: `${comp.info.displayName} · ${startCase(fieldName)}`,
      tipo,
      detalles,
      fieldUid: `${CT_UID}.${attrName} -> ${componentUid}.${fieldName}`,
    });
  }
}

function addCorreoTelefonoDireccion() {
  addComponentFields({
    attrName: 'estado_nombre',
    componentUid: 'contacto.nombre',
    label: 'Verificación Nombre',
    count: 2,
    fields: ['estado','nota','fuente','verificado_por','fecha_verificacion','aprobado_por','fecha_aprobacion','confiance_score'],
    prefix: 'estado_nombre'
  });
  addComponentFields({
    attrName: 'emails',
    componentUid: 'contacto.email',
    label: 'Email',
    count: 3,
    fields: ['email','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score'],
    prefix: 'email'
  });
  addComponentFields({
    attrName: 'telefonos',
    componentUid: 'contacto.telefono',
    label: 'Teléfono',
    count: 3,
    fields: ['telefono_raw','telefono_norm','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score'],
    prefix: 'tel'
  });
  addComponentFields({
    attrName: 'direcciones',
    componentUid: 'contacto.direccion',
    label: 'Dirección',
    count: 2,
    fields: ['direccion_principal_envio_facturacion','region_documentId','region_nombre','comuna_documentId','comuna_nombre','nombre_calle','numero_calle','complemento_direccion','tipo_direccion','verificada_por','fecha_verificacion','estado_verificacion'],
    prefix: 'dir'
  });
  addComponentFields({
    attrName: 'Website',
    componentUid: 'contacto.website',
    label: 'Website',
    count: 2,
    fields: ['website','estado','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','confiance_score','verificado_por','fecha_verificacion','aprobado_por','fecha_aprobacion'],
    prefix: 'website'
  });
}

function addDireccionesHelpers() {
  const dirComp = loadComponentSchema('contacto.direccion');
  const regionField = dirComp.attributes.region;
  const comunaField = dirComp.attributes.comuna;
  ['region','comuna'].forEach((rel) => {
    const target = rel === 'region' ? 'api::region.region' : 'api::comuna.comuna';
    const compDisplay = dirComp.info.displayName;
    ['documentId','nombre'].forEach((suffix) => {
      for (let i = 1; i <= 2; i++) {
        const column = `dir_${i}_${rel}_${suffix}`;
        if (!definitions.has(column)) continue;
        definitions.get(column).detalles = `${compDisplay} ${i}: relación ${regionField?.relation || 'oneToOne'} → ${target}. Campo ${suffix}.`;
        definitions.get(column).tipo = 'relation';
        definitions.get(column).fieldUid = `${CT_UID}.direcciones -> contacto.direccion.${rel}`;
      }
    });
  });
}

function addWebsiteHelper() {
  const comp = loadComponentSchema('contacto.website');
  for (const [key, value] of Object.entries(definitions)) {
    if (!key.startsWith('website_')) continue;
  }
}

function addLogoFields() {
  addDefinition('colegio_logo_file', {
    campo: 'colegio_logo',
    nombreVariable: 'Legacy Logo · Archivo',
    tipo: 'media (single)',
    detalles: 'Campo legacy de media simple (colegio_logo).',
    notas: 'Campo legado: se recomienda migrar a componente logo.imagen.',
    check: false,
  });
  addComponentSimpleFields({
    attrName: 'logo',
    componentUid: 'contacto.logo-o-avatar',
    fields: ['tipo','formato','estado','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confiance_score','aprobado_por','fecha_aprobacion']
  });
  addDefinition('logo_imagenes', {
    campo: 'logo',
    nombreVariable: 'Logo · Archivos',
    tipo: 'media (multiple)',
    detalles: 'Nombres de archivos asociados al componente Logo o Avatar.',
    fieldUid: `${CT_UID}.logo -> contacto.logo-o-avatar.imagen`,
  });
}

function addListasUtilesFields() {
  addDefinition('listas_utiles_count', {
    campo: 'listas_utiles',
    nombreVariable: 'Listas de útiles · Cantidad',
    tipo: 'integer',
    detalles: 'Cantidad total de registros relacionados en api::colegio-list.colegio-list.',
  });
  addDefinition('listas_utiles_anios', {
    campo: 'listas_utiles',
    nombreVariable: 'Listas de útiles · Años',
    tipo: 'string',
    detalles: 'Años (campo anio) concatenados por | de la relación api::colegio-list.colegio-list.',
  });
  addDefinition('listas_utiles_slugs', {
    campo: 'listas_utiles',
    nombreVariable: 'Listas de útiles · Slugs',
    tipo: 'string',
    detalles: 'Slugs concatenados de api::colegio-list.colegio-list.',
  });
  addDefinition('listas_utiles_estados', {
    campo: 'listas_utiles',
    nombreVariable: 'Listas de útiles · Estado global',
    tipo: 'string',
    detalles: 'Estados globales concatenados de api::colegio-list.colegio-list.',
  });
}

function addCarteraFields() {
  const carteraSchema = loadApiSchema('api::cartera-asignacion.cartera-asignacion');
  const attrMetaMap = carteraSchema.attributes;
  const campos = ['documentId','estado','prioridad','is_current','fecha_inicio','fecha_fin','meta_ingresos','notas','orden','periodo_nombre','periodo_estado','ejecutivo_documentId','ejecutivo_nombre','ejecutivo_rut'];
  const campoInfo = {
    documentId: { tipo: 'string', detalles: 'Document ID de la asignación (UID).' },
    periodo_nombre: { tipo: 'string', detalles: 'Nombre del periodo comercial relacionado.' },
    periodo_estado: { tipo: 'string', detalles: 'Estado del periodo comercial relacionado.' },
    ejecutivo_documentId: { tipo: 'string', detalles: 'Document ID del ejecutivo asignado.' },
    ejecutivo_nombre: { tipo: 'string', detalles: 'Nombre del ejecutivo asignado.' },
    ejecutivo_rut: { tipo: 'string', detalles: 'RUT del ejecutivo asignado.' },
  };
  for (const role of ['comercial','soporte1','soporte2']) {
    for (const campo of campos) {
      let tipo = (campoInfo[campo]?.tipo) || attributeMeta(attrMetaMap[campo] || {}).tipo || 'string';
      let detalles = campoInfo[campo]?.detalles || '';
      if (!detalles) {
        const attr = attrMetaMap[campo];
        if (attr?.type === 'enumeration') detalles = describeEnumeration(attr.enum);
        if (attr?.type === 'boolean') detalles = 'Booleano.';
      }
      addDefinition(`cartera_${role}_${campo}`, {
        campo: 'cartera_asignaciones',
        nombreVariable: `Cartera ${startCase(role)} · ${startCase(campo.replace('_',' '))}`,
        tipo,
        detalles: `${detalles ? detalles + ' ' : ''}Derivado de api::cartera-asignacion.cartera-asignacion (rol=${role}).`,
        fieldUid: `${CT_UID}.cartera_asignaciones -> api::cartera-asignacion.cartera-asignacion.${campo}`,
      });
    }
  }
}

function addSostenedorBetter() {
  const targetUid = 'api::colegio-sostenedor.colegio-sostenedor';
  const attrs = loadApiSchema(targetUid).attributes;
  const fieldConfigs = [
    { column: 'sostenedor_documentId', field: 'documentId', label: 'Document ID', tipo: 'string' },
    { column: 'sostenedor_rut', field: 'rut_sostenedor', label: 'RUT numérico', tipo: 'biginteger' },
    { column: 'sostenedor_dv', field: 'dv_rut', label: 'DV', tipo: 'string' },
    { column: 'sostenedor_rut_completo', field: 'rut_completo', label: 'RUT completo', tipo: 'string' },
    { column: 'sostenedor_razon_social', field: 'razon_social', label: 'Razón social', tipo: 'string' },
    { column: 'sostenedor_nombre_fantasia', field: 'nombre_fantasia', label: 'Nombre fantasía', tipo: 'string' },
    { column: 'sostenedor_giro', field: 'giro', label: 'Giro', tipo: 'string' },
    { column: 'sostenedor_tipo', field: 'tipo_sostenedor', label: 'Tipo', tipo: 'enumeration', detalles: describeEnumeration(attrs.tipo_sostenedor.enum) },
    { column: 'sostenedor_contacto_documentId', field: 'contacto', label: 'Contacto · Document ID', tipo: 'relation', detalles: 'Document ID de la persona contacto.' },
    { column: 'sostenedor_contacto_nombre', field: 'contacto', label: 'Contacto · Nombre', tipo: 'relation', detalles: 'Nombre completo de la persona contacto.' },
  ];
  for (const cfg of fieldConfigs) {
    addDefinition(cfg.column, {
      campo: 'sostenedor',
      nombreVariable: `Sostenedor · ${cfg.label}`,
      tipo: cfg.tipo,
      detalles: cfg.detalles || 'Derivado de api::colegio-sostenedor.colegio-sostenedor.',
      fieldUid: `${CT_UID}.sostenedor -> ${targetUid}.${cfg.field}`,
    });
  }
}

function addOrganizacionLegacy() {
  addDefinition('organizacion_documentId', {
    campo: 'organizacion',
    nombreVariable: 'Organización · Document ID',
    tipo: 'relation',
    detalles: 'Campo legado: relación no presente en el schema actual.',
    notas: 'Campo legacy (no disponible en el schema local).',
    check: false,
    fieldUid: `${CT_UID}.organizacion (legacy)`
  });
  addDefinition('organizacion_nombre', {
    campo: 'organizacion',
    nombreVariable: 'Organización · Nombre',
    tipo: 'string',
    detalles: 'Campo legado: nombre de la organización relacionada.',
    notas: 'Campo legacy (no disponible en el schema local).',
    check: false,
    fieldUid: `${CT_UID}.organizacion (legacy)`
  });
}

function addLocationRelations() {
  const map = [
    { prefix: 'comuna', target: 'api::comuna.comuna', nameField: 'comuna_nombre' },
    { prefix: 'provincia', target: 'api::provincia.provincia', nameField: 'provincia_nombre' },
    { prefix: 'region', target: 'api::region.region', nameField: 'region_nombre' },
    { prefix: 'zona', target: 'api::zona.zona', nameField: 'zona_nombre' },
  ];
  for (const rel of map) {
    addRelationField({
      column: `${rel.prefix}_documentId`,
      relationName: rel.prefix,
      targetUid: rel.target,
      nombreVariable: `${startCase(rel.prefix)} · Document ID`,
      descripcion: `Document ID del registro relacionado (${rel.target}).`,
    });
    addDefinition(`${rel.prefix}_nombre`, {
      campo: rel.prefix,
      nombreVariable: `${startCase(rel.prefix)} · Nombre`,
      tipo: 'string',
      detalles: `Campo ${rel.nameField} del registro relacionado (${rel.target}).`,
      fieldUid: `${CT_UID}.${rel.prefix} -> ${rel.target}.${rel.nameField}`,
    });
  }
}

function addWebsiteFields() {
  addComponentFields({
    attrName: 'Website',
    componentUid: 'contacto.website',
    label: 'Website',
    count: 2,
    fields: ['website','estado','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','confiance_score','verificado_por','fecha_verificacion','aprobado_por','fecha_aprobacion'],
    prefix: 'website'
  });
}

function addDireccionRelationsMeta() {
  const dirComp = loadComponentSchema('contacto.direccion');
  const regionRel = dirComp.attributes.region;
  const comunaRel = dirComp.attributes.comuna;
  for (let i = 1; i <= 2; i++) {
    ['region','comuna'].forEach((rel) => {
      ['documentId','nombre'].forEach((suffix) => {
        const column = `dir_${i}_${rel}_${suffix}`;
        if (!definitions.has(column)) return;
        const target = rel === 'region' ? 'api::region.region' : 'api::comuna.comuna';
        definitions.get(column).detalles = `Dirección ${i}: ${rel} (${regionRel?.relation || 'oneToOne'} → ${target}). Campo ${suffix}.`;
        definitions.get(column).tipo = 'relation';
        definitions.get(column).fieldUid = `${CT_UID}.direcciones -> contacto.direccion.${rel}`;
      });
    });
  }
}

function addWebsiteMeta() {
  // already handled by addComponentFields
}

function addLogoMeta() {
  const comp = loadComponentSchema('contacto.logo-o-avatar');
  for (const key of definitions.keys()) {
    if (!key.startsWith('logo_')) continue;
    const sub = key.replace('logo_','');
    const attr = comp.attributes[sub];
    if (!attr) continue;
    definitions.get(key).tipo = attributeMeta(attr).tipo;
    if (attr.type === 'enumeration') {
      definitions.get(key).detalles = `${comp.info.displayName}: ${describeEnumeration(attr.enum)}`;
    }
  }
}

function addListasUtilesMeta() {}

function addDocumentFieldsFromSchema() {
  addSimpleAttribute('rbd','RBD');
  addSimpleAttribute('colegio_nombre','Nombre del Colegio');
  addSimpleAttribute('rbd_digito_verificador','Dígito Verificador RBD');
  addSimpleAttribute('dependencia','Dependencia');
  addSimpleAttribute('ruralidad','Ruralidad');
  addSimpleAttribute('estado_estab','Estado del Establecimiento');
}

function addMisc() {
  addDefinition('estado_nombre_1_estado', definitions.get('estado_nombre_1_estado'));
}

function generateDictionary() {
  addSystemFields();
  addDocumentFieldsFromSchema();
  addLocationRelations();
  addOrganizacionLegacy();
  addComponentFields({
    attrName: 'estado_nombre',
    componentUid: 'contacto.nombre',
    label: 'Verificación Nombre',
    count: 2,
    fields: ['estado','nota','fuente','verificado_por','fecha_verificacion','aprobado_por','fecha_aprobacion','confiance_score'],
    prefix: 'estado_nombre'
  });
  addComponentFields({
    attrName: 'emails',
    componentUid: 'contacto.email',
    label: 'Email',
    count: 3,
    fields: ['email','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score'],
    prefix: 'email'
  });
  addComponentFields({
    attrName: 'telefonos',
    componentUid: 'contacto.telefono',
    label: 'Teléfono',
    count: 3,
    fields: ['telefono_raw','telefono_norm','tipo','estado','principal','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','verificado_por','fecha_verificacion','confidence_score'],
    prefix: 'tel'
  });
  addComponentFields({
    attrName: 'direcciones',
    componentUid: 'contacto.direccion',
    label: 'Dirección',
    count: 2,
    fields: ['direccion_principal_envio_facturacion','region_documentId','region_nombre','comuna_documentId','comuna_nombre','nombre_calle','numero_calle','complemento_direccion','tipo_direccion','verificada_por','fecha_verificacion','estado_verificacion'],
    prefix: 'dir'
  });
  addComponentFields({
    attrName: 'Website',
    componentUid: 'contacto.website',
    label: 'Website',
    count: 2,
    fields: ['website','estado','vigente_desde','vigente_hasta','eliminado_en','nota','fuente','confiance_score','verificado_por','fecha_verificacion','aprobado_por','fecha_aprobacion'],
    prefix: 'website'
  });
  addLogoFields();
  addListasUtilesFields();
  addCarteraFields();
  addSostenedorBetter();
  addDireccionRelationsMeta();
}

function finalize() {
  const headerRow = ['Check','Notas','Nombre Display','Campo','Nombre Variable','Field UID','Tipo','UID','Nombre API','Sección','Colección / Categoría','Detalles','Obligatorio','Único','Ejemplo'];
  const lines = [headerRow.join(',')];
  for (const column of headers) {
    const def = definitions.get(column);
    if (!def) {
      throw new Error(`Falta metadata para ${column}`);
    }
    const row = [
      def.check,
      def.notas,
      def.nombreDisplay,
      def.campo,
      def.nombreVariable,
      def.fieldUid,
      def.tipo,
      def.uid,
      def.nombreApi,
      def.seccion,
      def.coleccion,
      def.detalles,
      def.obligatorio,
      def.unico,
      firstExample(column),
    ];
    lines.push(row.map((value)=>{
      const v = value ?? '';
      const str = String(v);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g,'""') + '"';
      }
      return str;
    }).join(','));
  }
  fs.writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`Diccionario creado en ${OUT_PATH}`);
}

function main() {
  generateDictionary();
  finalize();
}

main();
