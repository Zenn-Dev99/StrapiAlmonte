#!/usr/bin/env node
/**
 * Ejecuta tareas de mantenimiento reutilizando el bootstrap de Strapi.
 * Uso:
 *   node scripts/run-maintenance-tasks.cjs migrate-estados backfill-telefonos
 *
 * Opciones disponibles:
 *   content-manager
 *   migrate-estados
 *   backfill-telefonos
 *   backfill-curso-titulos
 *   backfill-curso-asignatura
 *   email-templates
 */

const path = require('node:path');
const process = require('node:process');
const { createStrapi } = require('@strapi/strapi');

const TASK_ENV_FLAGS = {
  'content-manager': 'BOOTSTRAP_CONTENT_MANAGER_SYNC',
  'migrate-estados': 'BOOTSTRAP_MIGRATE_ESTADOS',
  'backfill-telefonos': 'BOOTSTRAP_BACKFILL_TELEFONO',
  'backfill-curso-titulos': 'BOOTSTRAP_BACKFILL_CURSO_TITULOS',
  'backfill-curso-asignatura': 'BOOTSTRAP_BACKFILL_CURSO_ASIGNATURA',
  'email-templates': 'BOOTSTRAP_ENSURE_EMAIL_TEMPLATES',
};

const selected = process.argv.slice(2);

if (!selected.length) {
  console.error('Uso: node scripts/run-maintenance-tasks.cjs <tarea...>');
  console.error('Tareas disponibles:', Object.keys(TASK_ENV_FLAGS).join(', '));
  process.exit(1);
}

for (const name of selected) {
  const envVar = TASK_ENV_FLAGS[name];
  if (!envVar) {
    console.error(`Tarea desconocida "${name}". Opciones válidas: ${Object.keys(TASK_ENV_FLAGS).join(', ')}`);
    process.exit(1);
  }
  process.env[envVar] = 'true';
}

(async () => {
  const projectDir = process.cwd();
  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    console.log(`[maintenance] Ejecutadas tareas: ${selected.join(', ')}`);
  } finally {
    await strapi.destroy();
  }
})();
