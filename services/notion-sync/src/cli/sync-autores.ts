#!/usr/bin/env node

/**
 * CLI para sincronizar autores desde Notion a Strapi
 * 
 * Uso:
 *   npm run sync:autores
 *   tsx src/cli/sync-autores.ts
 */

import 'dotenv/config';
import { syncAutores } from '../sync/sync-autores';

async function main() {
  try {
    await syncAutores();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

