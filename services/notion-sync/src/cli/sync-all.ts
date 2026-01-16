#!/usr/bin/env node

/**
 * CLI para sincronizar todas las colecciones desde Notion a Strapi
 * 
 * Uso:
 *   npm run sync
 *   tsx src/cli/sync-all.ts
 */

import 'dotenv/config';

async function main() {
  try {
    console.log('🔄 Iniciando sincronización completa Notion → Strapi\n');
    
    // Sincronizar autores
    if (process.env.NOTION_DB_AUTORES) {
      console.log('📚 Sincronizando autores...');
      const { syncAutores } = await import('../sync/sync-autores');
      await syncAutores();
    } else {
      console.log('⏭️  NOTION_DB_AUTORES no configurado, omitiendo autores...');
    }
    
    // TODO: Agregar más colecciones (libros, editoriales, sellos) cuando estén listas
    
    console.log('✅ Sincronización completa finalizada');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

