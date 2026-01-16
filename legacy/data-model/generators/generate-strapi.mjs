import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const REGISTRY_DIR = path.join(ROOT, 'registry');
const ENTITIES_DIR = path.join(REGISTRY_DIR, 'entities');
const ENUMS_DIR = path.join(REGISTRY_DIR, 'enums');
const STRAPI_API_DIR = path.join(ROOT, '..', 'src', 'api');

const TYPE_MAP = {
  string: 'string',
  text: 'text',
  integer: 'integer',
  number: 'float',
  boolean: 'boolean',
  date: 'date',
  datetime: 'datetime',
};

function readYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw);
}

function loadEnumValues(enumRef) {
  const enumPath = path.join(ENUMS_DIR, `${enumRef}.yaml`);
  if (!fs.existsSync(enumPath)) {
    throw new Error(`Enum "${enumRef}" no encontrado en ${enumPath}`);
  }
  const data = readYaml(enumPath);
  return data.values ?? [];
}

function toStrapiScalar(field) {
  const isEnum = field.type === 'enum';
  const baseType = TYPE_MAP[field.type];

  if (!isEnum && !baseType) {
    throw new Error(`Tipo "${field.type}" no soportado en campo scalar`);
  }

  const attr = isEnum
    ? { type: 'enumeration', enum: loadEnumValues(field.enumRef) }
    : { type: baseType };

  if (field.required) attr.required = true;
  if (field.unique) attr.unique = true;
  if (field.maxLength) attr.maxLength = field.maxLength;
  if (field.default !== undefined) attr.default = field.default;
  if (field.private) attr.private = true;

  if (isEnum && field.enumRef) {
    attr.enum = loadEnumValues(field.enumRef);
  }

  return attr;
}

function toStrapiRelation(field) {
  const relation = field.kind || 'manyToOne';
  const target = field.target;
  if (!target) {
    throw new Error(`Campo relacional sin target definido`);
  }

  const attr = {
    type: 'relation',
    relation,
    target: `api::${target}.${target}`,
  };

  if (field.inversedBy) attr.inversedBy = field.inversedBy;
  if (field.mappedBy) attr.mappedBy = field.mappedBy;

  return attr;
}

function buildAttributes(entity, uniqueFields = new Set()) {
  const attributes = {};

  for (const [name, field] of Object.entries(entity.fields || {})) {
    if (field.type === 'relation') continue;
    const attr = field.type === 'enum' ? toStrapiScalar(field) : toStrapiScalar(field);
    if (uniqueFields.has(name)) attr.unique = true;
    attributes[name] = attr;
  }

  for (const [name, field] of Object.entries(entity.fields || {})) {
    if (field.type !== 'relation') continue;
    attributes[name] = toStrapiRelation(field);
  }

  return attributes;
}

function extractUniqueSet(entity) {
  const unique = new Set();
  const entries = entity.unique || [];
  for (const item of entries) {
    if (typeof item === 'string') unique.add(item);
  }
  return unique;
}

function buildSchema(entity) {
  const uniqueFields = extractUniqueSet(entity);
  const plural = entity.plural || `${entity.entity}s`;

  return {
    kind: entity.kind || 'collectionType',
    collectionName: entity.table || `${entity.entity}s`,
    info: {
      singularName: entity.entity,
      pluralName: plural,
      displayName: entity.displayName || entity.entity,
      description: entity.description || undefined,
    },
    options: {
      draftAndPublish: entity.draftAndPublish ?? true,
    },
    pluginOptions: entity.pluginOptions || undefined,
    attributes: buildAttributes(entity, uniqueFields),
  };
}

function writeSchema(entity) {
  const schema = buildSchema(entity);
  const apiName = entity.uid || entity.entity;
  const entityDir = path.join(STRAPI_API_DIR, apiName, 'content-types', apiName);
  fs.mkdirSync(entityDir, { recursive: true });
  fs.writeFileSync(path.join(entityDir, 'schema.json'), JSON.stringify(schema, null, 2));
  console.log(`✔︎ schema generado para ${entity.entity}`);
}

function main() {
  if (!fs.existsSync(ENTITIES_DIR)) {
    console.error('No se encontró registry/entities. Nada que hacer.');
    process.exit(0);
  }
  const files = fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.yaml'));
  files.sort();
  files.forEach((file) => {
    const entity = readYaml(path.join(ENTITIES_DIR, file));
    writeSchema(entity);
  });
}

main();
