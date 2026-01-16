// scripts/generate-ct-docs.mjs
// Genera documentación de Content Types y Componentes a partir de los schema.json
// Salidas:
//   - data/docs/content-types.json (resumen técnico)
//   - docs/diccionario-contenido-strapi.md (Markdown)
//   - docs/diccionario-contenido-strapi.csv (CSV)
//   - docs/diccionario-contenido-strapi.html (HTML simple)

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'src', 'api');
const CMP_DIR = path.join(ROOT, 'src', 'components');
const DATA_OUT_DIR = path.join(ROOT, 'data', 'docs');
const JSON_OUT_PATH = path.join(DATA_OUT_DIR, 'content-types.json');
const DOC_MD_PATH = path.join(ROOT, 'docs', 'diccionario-contenido-strapi.md');
const DOC_CSV_PATH = path.join(ROOT, 'docs', 'diccionario-contenido-strapi.csv');
const DOC_HTML_PATH = path.join(ROOT, 'docs', 'diccionario-contenido-strapi.html');

const INTRO_LINES = [
  '# Diccionario de contenido Strapi',
  '',
  'Este documento resume los content-types y componentes disponibles, con ejemplos de valores y restricciones clave.',
];

function listFiles(dir, matcher) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p, matcher));
    else if (matcher(p)) out.push(p);
  }
  return out;
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function relativeToRoot(absPath) {
  return path.relative(ROOT, absPath);
}

function toUidFromApiPath(absPath) {
  const parts = absPath.split(path.sep);
  const apiIndex = parts.indexOf('api');
  const name = parts[apiIndex + 1];
  const ct = parts[apiIndex + 3];
  return `api::${name}.${ct}`;
}

function toComponentUid(absPath, json) {
  const parts = absPath.split(path.sep);
  const cmpIndex = parts.indexOf('components');
  const category = parts[cmpIndex + 1];
  let name = parts[cmpIndex + 2];
  const fileName = parts[parts.length - 1];
  if (fileName.endsWith('.json') && fileName !== 'schema.json') {
    name = path.basename(fileName, '.json');
  }
  if (json?.info?.displayName) {
    // Prefer schema folder naming; uid canonical form category.name
    return `${category}.${name}`;
  }
  return `${category}.${name}`;
}

function summarizeAttribute(attr) {
  if (!attr || typeof attr !== 'object') return {};
  const baseKeys = [
    'type',
    'required',
    'unique',
    'default',
    'private',
    'configurable',
    'repeatable',
    'multiple',
    'targetField',
    'min',
    'max',
    'minLength',
    'maxLength',
  ];
  const out = {};
  for (const key of baseKeys) {
    if (attr[key] !== undefined) out[key] = attr[key];
  }
  if (attr.type === 'relation') {
    out.relation = attr.relation;
    out.target = attr.target;
    if (attr.mappedBy) out.mappedBy = attr.mappedBy;
    if (attr.inversedBy) out.inversedBy = attr.inversedBy;
  }
  if (attr.type === 'component') {
    out.component = attr.component;
    out.repeatable = !!attr.repeatable;
  }
  if (attr.type === 'dynamiczone') {
    if (Array.isArray(attr.components)) out.components = attr.components.slice();
  }
  if (attr.type === 'enumeration' && Array.isArray(attr.enum)) {
    out.enum = attr.enum.slice();
  }
  if (attr.type === 'media') {
    if (Array.isArray(attr.allowedTypes)) out.allowedTypes = attr.allowedTypes.slice();
    if (attr.multiple !== undefined) out.multiple = attr.multiple;
  }
  return out;
}

function summarizeAttributes(attrs = {}) {
  const out = {};
  for (const [name, attr] of Object.entries(attrs)) {
    out[name] = summarizeAttribute(attr);
  }
  return out;
}

function loadContentTypes() {
  const files = listFiles(API_DIR, (p) => /\/content-types\/[^/]+\/schema\.json$/.test(p));
  const map = {};
  const meta = [];
  for (const absPath of files) {
    const json = safeReadJson(absPath);
    if (!json) continue;
    const uid = toUidFromApiPath(absPath);
    const relativePath = relativeToRoot(absPath);
    map[uid] = {
      kind: json.kind,
      collectionName: json.collectionName,
      info: json.info,
      options: json.options,
      attributes: summarizeAttributes(json.attributes),
      path: relativePath,
    };
    meta.push({
      uid,
      schema: json,
      path: relativePath,
    });
  }
  return { map, meta };
}

function loadComponents() {
  const files = listFiles(
    CMP_DIR,
    (p) =>
      (p.endsWith('schema.json') || (p.endsWith('.json') && !p.endsWith('/index.json'))) &&
      !p.endsWith('/index.json')
  );

  const selected = new Map();
  for (const absPath of files) {
    const json = safeReadJson(absPath);
    if (!json) continue;
    const uid = toComponentUid(absPath, json);
    const isSchema = path.basename(absPath) === 'schema.json';
    const current = selected.get(uid);
    if (current) {
      if (current.isSchema && !isSchema) continue;
      if (isSchema && !current.isSchema) {
        selected.set(uid, { uid, json, path: absPath, isSchema });
        continue;
      }
      if (!current.isSchema && !isSchema) {
        selected.set(uid, { uid, json, path: absPath, isSchema });
      }
      continue;
    }
    selected.set(uid, { uid, json, path: absPath, isSchema });
  }

  const map = {};
  const meta = [];

  for (const entry of selected.values()) {
    const relativePath = relativeToRoot(entry.path);
    map[entry.uid] = {
      collectionName: entry.json.collectionName,
      info: entry.json.info,
      attributes: summarizeAttributes(entry.json.attributes),
      path: relativePath,
    };
    meta.push({
      uid: entry.uid,
      schema: entry.json,
      path: relativePath,
    });
  }

  return { map, meta };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function boolToSi(value) {
  return value ? 'Sí' : 'No';
}

function compareDisplay(a, b) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

function escapeMarkdownCell(text) {
  const str = String(text ?? '');
  return str.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function csvEscape(text) {
  const str = String(text ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getDisplayNameFromInfo(info, fallback) {
  if (!info) return fallback;
  return info.displayName || info.name || fallback;
}

function buildLookups(contentTypeMeta, componentMeta) {
  const ctDisplay = new Map();
  for (const entry of contentTypeMeta) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    ctDisplay.set(entry.uid, display);
  }

  const cmpDisplay = new Map();
  for (const entry of componentMeta) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    cmpDisplay.set(entry.uid, display);
  }

  return { ctDisplay, cmpDisplay };
}

function relationExample(relation, targetDisplay) {
  const multiRelations = new Set(['oneToMany', 'manyToMany', 'manyWay', 'morphToMany', 'oneToManyMorph']);
  if (multiRelations.has(relation)) {
    return `Relacionar varios ${targetDisplay}`;
  }
  return `Relacionar ${targetDisplay}`;
}

function stringExample(name) {
  if (!name) return 'Texto de ejemplo';
  const lower = name.toLowerCase();
  if (lower.includes('email') || lower.includes('correo')) return 'contacto@ejemplo.cl';
  if (lower.includes('nombre')) return 'Nombre de Ejemplo';
  if (lower.includes('slug')) return 'slug-unica';
  if (lower.includes('subject') || lower.includes('asunto')) return 'Asunto de ejemplo';
  return 'Texto de ejemplo';
}

function formatDefault(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatAttributeRow({
  ownerUid,
  ownerDisplay,
  attrName,
  attr,
  lookups,
  sectionType,
  ownerCollection,
}) {
  const type = attr.type || 'string';
  const details = [];
  let typeLabel = type;
  let example = '';
  let fieldUid = `${ownerUid}.${attrName}`;

  switch (type) {
    case 'relation': {
      const relation = attr.relation || 'relation';
      const targetUid = attr.target || '';
      const targetDisplay =
        lookups.ctDisplay.get(targetUid) || lookups.cmpDisplay.get(targetUid) || targetUid || '—';
      typeLabel = `relation (${relation} → ${targetDisplay})`;
      details.push(`Target: ${targetDisplay}`);
      details.push(`Relación ${relation}`);
      if (attr.mappedBy) details.push(`mappedBy: ${attr.mappedBy}`);
      if (attr.inversedBy) details.push(`inversedBy: ${attr.inversedBy}`);
      example = relationExample(relation, targetDisplay);
      if (targetUid) fieldUid = `${ownerUid}.${attrName} -> ${targetUid}`;
      break;
    }
    case 'component': {
      const componentUid = attr.component || '';
      const componentDisplay = lookups.cmpDisplay.get(componentUid) || componentUid || '—';
      typeLabel = `component (${attr.repeatable ? 'lista · ' : ''}${componentDisplay})`;
      details.push(`Componente: ${componentDisplay}`);
      if (attr.repeatable) details.push('Repetible');
      example = `Completar ${componentDisplay}`;
      if (componentUid) fieldUid = `${ownerUid}.${attrName} -> ${componentUid}`;
      break;
    }
    case 'dynamiczone': {
      const components = Array.isArray(attr.components) ? attr.components : [];
      const list = components.join(', ');
      typeLabel = components.length ? `dynamiczone (${list})` : 'dynamiczone';
      if (components.length) details.push(`Componentes permitidos: ${list}`);
      example = 'Seleccionar bloques válidos';
      break;
    }
    case 'media': {
      const variant = attr.multiple ? 'multi' : 'simple';
      typeLabel = `media (${variant})`;
      details.push(attr.multiple ? 'Puede tener varios archivos' : 'Un solo archivo');
      if (Array.isArray(attr.allowedTypes) && attr.allowedTypes.length) {
        details.push(`Tipos permitidos: ${attr.allowedTypes.join(', ')}`);
      }
      example = 'Archivo multimedia (imagen/pdf)';
      break;
    }
    case 'enumeration': {
      typeLabel = 'enumeration';
      if (Array.isArray(attr.enum) && attr.enum.length) {
        details.push(`Valores: ${attr.enum.join(', ')}`);
        example = attr.enum[0];
      } else {
        example = 'Valor de ejemplo';
      }
      break;
    }
    case 'json': {
      example = '{ "clave": "valor" }';
      break;
    }
    case 'text': {
      example = 'Descripción larga de ejemplo.';
      break;
    }
    case 'richtext': {
      example = 'Contenido enriquecido';
      break;
    }
    case 'uid': {
      example = 'slug-unica';
      break;
    }
    case 'integer':
    case 'biginteger': {
      example = '123';
      break;
    }
    case 'float':
    case 'decimal': {
      example = '123.45';
      break;
    }
    case 'date': {
      example = '2024-03-15';
      break;
    }
    case 'datetime': {
      example = '2024-03-15T10:30:00.000Z';
      break;
    }
    case 'time': {
      example = '10:30:00';
      break;
    }
    case 'boolean': {
      example = attr.default !== undefined ? String(attr.default) : 'true';
      break;
    }
    case 'email': {
      example = 'contacto@ejemplo.cl';
      break;
    }
    case 'password': {
      example = '********';
      break;
    }
    default: {
      example = stringExample(attrName);
      break;
    }
  }

  if (type === 'string') {
    example = stringExample(attrName);
  }

  if (attr.default !== undefined) {
    details.push(`Default: ${formatDefault(attr.default)}`);
  }
  if (attr.private) {
    details.push('Privado');
  }
  if (attr.configurable === false) {
    details.push('No configurable');
  }
  if (attr.maxLength !== undefined) {
    details.push(`maxLength: ${attr.maxLength}`);
  }
  if (attr.minLength !== undefined) {
    details.push(`minLength: ${attr.minLength}`);
  }
  if (attr.max !== undefined) {
    details.push(`max: ${attr.max}`);
  }
  if (attr.min !== undefined) {
    details.push(`min: ${attr.min}`);
  }

  return {
    ownerDisplay,
    ownerUid,
    ownerCollection,
    sectionType,
    name: attrName,
    type: typeLabel,
    required: attr.required ? 'Sí' : '',
    unique: attr.unique ? 'Sí' : '',
    details: details,
    example,
    fieldUid,
  };
}

function gatherRows(contentTypeMeta, componentMeta, lookups) {
  const contentTypeRows = [];
  const componentRows = [];

  for (const entry of contentTypeMeta) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    const attributes = entry.schema.attributes || {};
    for (const [attrName, attr] of Object.entries(attributes)) {
      const row = formatAttributeRow({
        ownerUid: entry.uid,
        ownerDisplay: display,
        ownerCollection: entry.schema.collectionName || '',
        attrName,
        attr,
        lookups,
        sectionType: entry.schema.kind === 'singleType' ? 'Single Type' : 'Collection Type',
      });
      contentTypeRows.push(row);
    }
  }

  for (const entry of componentMeta) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    const category = entry.uid.split('.')[0] || '';
    const attributes = entry.schema.attributes || {};
    for (const [attrName, attr] of Object.entries(attributes)) {
      const row = formatAttributeRow({
        ownerUid: entry.uid,
        ownerDisplay: display,
        ownerCollection: category,
        attrName,
        attr,
        lookups,
        sectionType: 'Componente',
      });
      componentRows.push(row);
    }
  }

  return { contentTypeRows, componentRows };
}

function renderMarkdown(contentTypeMeta, componentMeta, lookups) {
  const lines = [...INTRO_LINES, '', '## Content Types', ''];

  const sortedContentTypes = [...contentTypeMeta].sort((a, b) => {
    const aDisplay = getDisplayNameFromInfo(a.schema.info, a.uid);
    const bDisplay = getDisplayNameFromInfo(b.schema.info, b.uid);
    return compareDisplay(aDisplay, bDisplay);
  });

  for (const entry of sortedContentTypes) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    lines.push(`### ${display} (\`${entry.uid}\`)`);
    lines.push(`- Tipo: ${entry.schema.kind === 'singleType' ? 'Single Type' : 'Collection Type'}`);
    if (entry.schema.collectionName) {
      lines.push(`- Tabla: ${entry.schema.collectionName}`);
    }
    const draftAndPublish = entry.schema.options?.draftAndPublish;
    lines.push(`- Draft & Publish: ${boolToSi(draftAndPublish)}`);
    if (entry.schema.info?.singularName) {
      lines.push(`- Singular API: ${entry.schema.info.singularName}`);
    }
    if (entry.schema.info?.pluralName) {
      lines.push(`- Plural API: ${entry.schema.info.pluralName}`);
    }
    if (entry.schema.info?.description) {
      lines.push(`- Descripción: ${entry.schema.info.description}`);
    }
    lines.push('');
    lines.push('| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    const attributes = entry.schema.attributes || {};
    for (const [attrName, attr] of Object.entries(attributes)) {
      const row = formatAttributeRow({
        ownerUid: entry.uid,
        ownerDisplay: display,
        ownerCollection: entry.schema.collectionName || '',
        attrName,
        attr,
        lookups,
        sectionType: entry.schema.kind === 'singleType' ? 'Single Type' : 'Collection Type',
      });
      const detailsMd = escapeMarkdownCell(row.details.join(' · '));
      lines.push(
        `| ${escapeMarkdownCell(row.name)} | ${escapeMarkdownCell(row.type)} | ${row.required || ''} | ${
          row.unique || ''
        } | ${detailsMd} | ${escapeMarkdownCell(row.example)} |`
      );
    }
    lines.push('');
  }

  lines.push('## Componentes', '');

  const sortedComponents = [...componentMeta].sort((a, b) => {
    const aDisplay = getDisplayNameFromInfo(a.schema.info, a.uid);
    const bDisplay = getDisplayNameFromInfo(b.schema.info, b.uid);
    return compareDisplay(aDisplay, bDisplay);
  });

  for (const entry of sortedComponents) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    lines.push(`### ${display} (\`${entry.uid}\`)`);
    if (entry.schema.info?.description) {
      lines.push(`- Descripción: ${entry.schema.info.description}`);
    }
    lines.push('');
    lines.push('| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    const attributes = entry.schema.attributes || {};
    for (const [attrName, attr] of Object.entries(attributes)) {
      const row = formatAttributeRow({
        ownerUid: entry.uid,
        ownerDisplay: display,
        ownerCollection: entry.uid.split('.')[0] || '',
        attrName,
        attr,
        lookups,
        sectionType: 'Componente',
      });
      const detailsMd = escapeMarkdownCell(row.details.join(' · '));
      lines.push(
        `| ${escapeMarkdownCell(row.name)} | ${escapeMarkdownCell(row.type)} | ${row.required || ''} | ${
          row.unique || ''
        } | ${detailsMd} | ${escapeMarkdownCell(row.example)} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderCsv(contentTypeRows, componentRows) {
  const header = [
    'Sección',
    'Nombre Display',
    'Nombre API',
    'UID',
    'Colección / Categoría',
    'Campo',
    'Tipo',
    'Obligatorio',
    'Único',
    'Detalles',
    'Ejemplo',
    'Field UID',
  ];
  const lines = [header.map(csvEscape).join(',')];

  const rows = [...contentTypeRows, ...componentRows];
  for (const row of rows) {
    const line = [
      row.sectionType,
      row.ownerDisplay,
      row.ownerUid.split('::')[1]?.split('.').pop() || row.ownerUid,
      row.ownerUid,
      row.ownerCollection || '',
      row.name,
      row.type,
      row.required,
      row.unique,
      row.details.join(' | '),
      row.example,
      row.fieldUid,
    ].map(csvEscape);
    lines.push(line.join(','));
  }

  return lines.join('\n');
}

function renderHtml(contentTypeMeta, componentMeta, lookups) {
  const parts = [
    '<h1 id="diccionario-de-contenido-strapi">Diccionario de contenido Strapi</h1>',
    '<p>Este documento resume los content-types y componentes disponibles, con ejemplos de valores y restricciones clave.</p>',
    '<h2 id="content-types">Content Types</h2>',
  ];

  const sortedContentTypes = [...contentTypeMeta].sort((a, b) => {
    const aDisplay = getDisplayNameFromInfo(a.schema.info, a.uid);
    const bDisplay = getDisplayNameFromInfo(b.schema.info, b.uid);
    return compareDisplay(aDisplay, bDisplay);
  });

  const renderTableRows = (entry, sectionType) => {
    const rows = [];
    const attributes = entry.schema.attributes || {};
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    for (const [attrName, attr] of Object.entries(attributes)) {
      const row = formatAttributeRow({
        ownerUid: entry.uid,
        ownerDisplay: display,
        ownerCollection: sectionType === 'Componente' ? entry.uid.split('.')[0] || '' : entry.schema.collectionName || '',
        attrName,
        attr,
        lookups,
        sectionType,
      });
      rows.push(
        `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(
          row.required
        )}</td><td>${escapeHtml(row.unique)}</td><td>${escapeHtml(row.details.join(' · '))}</td><td>${escapeHtml(
          row.example
        )}</td></tr>`
      );
    }
    return rows.join('');
  };

  for (const entry of sortedContentTypes) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    parts.push(
      `<h3 id="${escapeHtml(display.toLowerCase().replace(/\s+/g, '-'))}-${escapeHtml(
        entry.uid.replace(/[:.]/g, '')
      )}">${escapeHtml(display)} (<code>${escapeHtml(entry.uid)}</code>)</h3>`
    );
    parts.push('<ul>');
    parts.push(`<li>Tipo: ${entry.schema.kind === 'singleType' ? 'Single Type' : 'Collection Type'}</li>`);
    if (entry.schema.collectionName) {
      parts.push(`<li>Tabla: ${escapeHtml(entry.schema.collectionName)}</li>`);
    }
    const draftAndPublish = entry.schema.options?.draftAndPublish;
    parts.push(`<li>Draft &amp; Publish: ${boolToSi(draftAndPublish)}</li>`);
    if (entry.schema.info?.singularName) {
      parts.push(`<li>Singular API: ${escapeHtml(entry.schema.info.singularName)}</li>`);
    }
    if (entry.schema.info?.pluralName) {
      parts.push(`<li>Plural API: ${escapeHtml(entry.schema.info.pluralName)}</li>`);
    }
    if (entry.schema.info?.description) {
      parts.push(`<li>Descripción: ${escapeHtml(entry.schema.info.description)}</li>`);
    }
    parts.push('</ul>');
    parts.push(
      '<table><thead><tr><th>Campo</th><th>Tipo</th><th>Obligatorio</th><th>Único</th><th>Detalles</th><th>Ejemplo</th></tr></thead><tbody>'
    );
    parts.push(renderTableRows(entry, entry.schema.kind === 'singleType' ? 'Single Type' : 'Collection Type'));
    parts.push('</tbody></table>');
  }

  parts.push('<h2 id="componentes">Componentes</h2>');

  const sortedComponents = [...componentMeta].sort((a, b) => {
    const aDisplay = getDisplayNameFromInfo(a.schema.info, a.uid);
    const bDisplay = getDisplayNameFromInfo(b.schema.info, b.uid);
    return compareDisplay(aDisplay, bDisplay);
  });

  for (const entry of sortedComponents) {
    const display = getDisplayNameFromInfo(entry.schema.info, entry.uid);
    parts.push(
      `<h3 id="${escapeHtml(display.toLowerCase().replace(/\s+/g, '-'))}-${escapeHtml(
        entry.uid.replace(/[:.]/g, '')
      )}">${escapeHtml(display)} (<code>${escapeHtml(entry.uid)}</code>)</h3>`
    );
    if (entry.schema.info?.description) {
      parts.push(`<p>Descripción: ${escapeHtml(entry.schema.info.description)}</p>`);
    }
    parts.push(
      '<table><thead><tr><th>Campo</th><th>Tipo</th><th>Obligatorio</th><th>Único</th><th>Detalles</th><th>Ejemplo</th></tr></thead><tbody>'
    );
    parts.push(renderTableRows(entry, 'Componente'));
    parts.push('</tbody></table>');
  }

  return parts.join('');
}

function main() {
  const { map: contentTypes, meta: contentTypeMeta } = loadContentTypes();
  const { map: components, meta: componentMeta } = loadComponents();

  ensureDir(DATA_OUT_DIR);
  const jsonOut = {
    generatedAt: new Date().toISOString(),
    contentTypes,
    components,
  };
  fs.writeFileSync(JSON_OUT_PATH, JSON.stringify(jsonOut, null, 2));
  console.log('📄 Diccionario generado:', relativeToRoot(JSON_OUT_PATH));
  console.log('CT count:', Object.keys(contentTypes).length, 'Components:', Object.keys(components).length);

  const lookups = buildLookups(contentTypeMeta, componentMeta);
  const { contentTypeRows, componentRows } = gatherRows(contentTypeMeta, componentMeta, lookups);

  const markdown = renderMarkdown(contentTypeMeta, componentMeta, lookups);
  fs.writeFileSync(DOC_MD_PATH, `${markdown.trim()}\n`, 'utf8');
  console.log('📝 Markdown actualizado:', relativeToRoot(DOC_MD_PATH));

  const csv = renderCsv(contentTypeRows, componentRows);
  fs.writeFileSync(DOC_CSV_PATH, `${csv}\n`, 'utf8');
  console.log('📑 CSV actualizado:', relativeToRoot(DOC_CSV_PATH));

  const html = renderHtml(contentTypeMeta, componentMeta, lookups);
  fs.writeFileSync(DOC_HTML_PATH, `${html}\n`, 'utf8');
  console.log('🌐 HTML actualizado:', relativeToRoot(DOC_HTML_PATH));
}

main();
