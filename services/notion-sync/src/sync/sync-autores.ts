/**
 * Sincroniza autores desde Notion a Strapi
 */
import { queryDatabase } from '../clients/notion';
import { upsert } from '../clients/strapi';

const NOTION_DB_AUTORES = process.env.NOTION_DB_AUTORES;

if (!NOTION_DB_AUTORES) {
  throw new Error('NOTION_DB_AUTORES no está configurado en las variables de entorno');
}

/**
 * Convierte una página de Notion (autor) a formato Strapi
 */
function mapNotionPageToStrapi(page: any) {
  const properties = page.properties || {};
  
  // Mapear propiedades comunes
  const idAutor = properties.id_autor?.rich_text?.[0]?.plain_text ||
                  properties.id_autor?.number ||
                  properties.id_autor?.title?.[0]?.plain_text ||
                  '';
  
  const nombreCompleto = properties.nombre_completo_autor?.title?.[0]?.plain_text ||
                         properties.nombre?.title?.[0]?.plain_text ||
                         '';
  
  const tipoAutor = properties.tipo_autor?.select?.name ||
                    properties.tipo_autor?.rich_text?.[0]?.plain_text ||
                    'Persona';
  
  // Extraer biografía/reseña
  let resegna = null;
  if (properties.resegna?.rich_text) {
    const blocks = properties.resegna.rich_text.map((block: any) => ({
      type: 'paragraph',
      children: [{ type: 'text', text: block.plain_text || '' }],
    }));
    resegna = blocks;
  }
  
  // Extraer website
  const website = properties.website?.url || properties.website?.rich_text?.[0]?.plain_text || '';
  
  // Extraer foto (URL)
  const fotoUrl = properties.foto?.files?.[0]?.file?.url ||
                  properties.foto?.url ||
                  properties.foto?.rich_text?.[0]?.plain_text ||
                  '';

  return {
    id_autor: String(idAutor).trim(),
    nombre_completo_autor: nombreCompleto.trim(),
    tipo_autor: tipoAutor === 'Persona' || tipoAutor === 'Empresa' ? tipoAutor : 'Persona',
    resegna: resegna || null,
    website: website || null,
    foto_url: fotoUrl || null, // Guardar URL, luego procesar si es necesario
  };
}

/**
 * Sincroniza todos los autores desde Notion a Strapi
 */
export async function syncAutores() {
  console.log('🔄 Sincronizando autores desde Notion...');
  console.log(`📊 Base de datos: ${NOTION_DB_AUTORES}`);
  
  try {
    // Obtener todas las páginas de la base de datos
    const pages = await queryDatabase(NOTION_DB_AUTORES);
    
    console.log(`📄 Encontradas ${pages.length} páginas en Notion`);
    
    let created = 0;
    let updated = 0;
    let errors = 0;
    
    for (const page of pages) {
      try {
        const strapiData = mapNotionPageToStrapi(page);
        
        if (!strapiData.id_autor) {
          console.warn(`⚠️  Página ${page.id} sin id_autor, omitiendo...`);
          continue;
        }
        
        // Buscar si existe antes para saber si creamos o actualizamos
        const { findOne } = await import('../clients/strapi');
        const existing = await findOne('autores', { id_autor: strapiData.id_autor });
        
        // Upsert en Strapi
        const result = await upsert(
          'autores',
          'id_autor',
          strapiData.id_autor,
          strapiData
        );
        
        if (existing) {
          updated++;
          console.log(`   ✅ Actualizado: ${strapiData.nombre_completo_autor || strapiData.id_autor}`);
        } else {
          created++;
          console.log(`   ➕ Creado: ${strapiData.nombre_completo_autor || strapiData.id_autor}`);
        }
        
      } catch (error: any) {
        errors++;
        console.error(`   ❌ Error procesando página ${page.id}: ${error.message}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen de sincronización:');
    console.log(`   ➕ Creados: ${created}`);
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📦 Total procesados: ${pages.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return { created, updated, errors, total: pages.length };
    
  } catch (error: any) {
    console.error('❌ Error sincronizando autores:', error.message);
    throw error;
  }
}

