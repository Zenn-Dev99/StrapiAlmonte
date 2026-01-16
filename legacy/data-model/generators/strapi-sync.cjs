const fs = require('node:fs');
const path = require('node:path');

function countFiles(dir, extension) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((file) => file.endsWith(extension)).length;
}

async function syncFromRegistry(strapi, rootDir) {
  const baseDir = rootDir || path.join(process.cwd(), 'data-model');
  const entitiesDir = path.join(baseDir, 'registry', 'entities');
  const enumsDir = path.join(baseDir, 'registry', 'enums');
  const relationsDir = path.join(baseDir, 'registry', 'relations');

  const entities = countFiles(entitiesDir, '.yaml');
  const enums = countFiles(enumsDir, '.yaml');
  const relations = countFiles(relationsDir, '.yaml');

  strapi.log.info(
    `[data-model] registry disponible en ${baseDir} (entidades=${entities}, enums=${enums}, relaciones=${relations})`
  );
}

module.exports = { syncFromRegistry };
