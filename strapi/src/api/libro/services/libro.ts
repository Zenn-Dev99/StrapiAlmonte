import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::libro.libro', ({ strapi }) => ({
  /**
   * Sincroniza un libro de Strapi a WooCommerce
   */
  async syncToWooCommerce(libro: any) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 [LIBRO - syncToWooCommerce] Iniciando sincronización');
    console.log(`Libro ID: ${libro.id || libro.documentId || 'sin ID'}`);
    console.log(`Nombre: ${libro.nombre_libro || libro.attributes?.nombre_libro || 'sin nombre'}`);
    console.log('═══════════════════════════════════════════════════════');
    
    strapi.log.info(`[libro] Iniciando sincronización para libro ${libro.id}`);
    
    const wooService = strapi.service('api::woo-sync.woo-sync');
    if (!wooService) {
      console.error('❌ [libro] Servicio woo-sync NO DISPONIBLE');
      strapi.log.warn('[libro] Servicio woo-sync no disponible');
      return null;
    }
    
    console.log('✅ [libro] Servicio woo-sync encontrado');
    strapi.log.info('[libro] Servicio woo-sync encontrado');

    // Obtener canales del libro
    // Intentar obtener el ID correcto (puede ser id numérico o documentId)
    const libroId = libro.id || libro.documentId || libro;
    
    console.log(`[libro] Buscando libro con ID: ${libroId}, tipo: ${typeof libroId}`);
    strapi.log.info(`[libro] Buscando libro con ID: ${libroId}, tipo: ${typeof libroId}`);
    
    // Intentar diferentes métodos de populate para obtener canales
    let libroConCanales: any;
    try {
      // Método 1: populate simple
      libroConCanales = await strapi.entityService.findOne('api::libro.libro', libroId, {
        populate: ['canales', 'portada_libro'],
      }) as any;
      
      // Si no tiene canales, intentar populate profundo
      if (!libroConCanales?.canales || libroConCanales.canales.length === 0) {
        strapi.log.info(`[libro] No se encontraron canales con populate simple, intentando populate profundo...`);
        libroConCanales = await strapi.entityService.findOne('api::libro.libro', libroId, {
          populate: {
            canales: true,
            portada_libro: true,
          },
        }) as any;
      }
    } catch (error: any) {
      strapi.log.error(`[libro] Error al obtener libro con canales:`, error);
      libroConCanales = libro; // Usar el libro original como fallback
    }

    console.log('');
    console.log('📊 [libro] Información del libro encontrado:');
    console.log(`   - ID: ${libroConCanales?.id}`);
    console.log(`   - documentId: ${libroConCanales?.documentId}`);
    console.log(`   - Tiene canales: ${!!libroConCanales?.canales}`);
    console.log(`   - Cantidad de canales: ${libroConCanales?.canales?.length || 0}`);
    
    strapi.log.info(`[libro] Libro encontrado: ${JSON.stringify({ 
      id: libroConCanales?.id, 
      documentId: libroConCanales?.documentId,
      hasCanales: !!libroConCanales?.canales,
      canalesCount: libroConCanales?.canales?.length || 0
    })}`);
    
    const canales = libroConCanales?.canales || [];
    
    console.log('');
    console.log('🔍 [libro] Analizando canales:');
    console.log(`   - Total de canales: ${canales.length}`);
    
    if (canales.length > 0) {
      console.log(`   - Estructura de canales:`, JSON.stringify(canales, null, 2));
      canales.forEach((c: any, idx: number) => {
        console.log(`   Canal ${idx + 1}:`, {
          id: c.id || c.documentId || 'sin id',
          key: c.key || 'sin key',
          nombre: c.nombre || c.name || 'sin nombre',
          tipo: typeof c
        });
      });
    } else {
      console.log(`   ❌ NO hay canales asignados`);
    }
    
    const canalesKeys = canales.map((c: any) => c.key || c.id || c).join(', ');
    console.log(`   - Keys de canales: "${canalesKeys || 'ninguno'}"`);
    
    strapi.log.info(`[libro] Libro ${libroId} tiene ${canales.length} canal(es): ${canalesKeys || 'ninguno'}`);
    
    if (!canales || canales.length === 0) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ [LIBRO - SYNC FALLIDO] ❌');
      console.error(`Libro ID: ${libroId}`);
      console.error(`Nombre: ${libroConCanales?.nombre_libro || 'sin nombre'}`);
      console.error(`Estado: ${libroConCanales?.estado_publicacion || 'no definido'}`);
      console.error('MOTIVO: NO tiene canales asignados');
      console.error('');
      console.error('⚠️ Para sincronizar con WordPress, el libro DEBE tener:');
      console.error('   - Al menos UN canal asignado (moraleja o escolar)');
      console.error('   - Estado de publicación: "Publicado"');
      console.error('');
      console.error('🔧 SOLUCIÓN:');
      console.error('   1. Abre el libro en Strapi Admin');
      console.error('   2. Ve a la sección "Canales"');
      console.error('   3. Asigna al menos un canal (moraleja o escolar)');
      console.error('   4. Guarda y publica el libro');
      console.error('═══════════════════════════════════════════════════════');
      strapi.log.warn(`[libro] ⚠️ Sincronización omitida por falta de canales`);
      return null;
    }

    const results = [];

    // Sincronizar a cada canal (WooCommerce) donde esté el libro
    for (const canal of canales) {
      const canalKey = canal.key;
      
      // Solo sincronizar si es un canal de WooCommerce
      if (canalKey === 'moraleja' || canalKey === 'escolar') {
        const platform = canalKey === 'moraleja' ? 'woo_moraleja' : 'woo_escolar';
        
        try {
          const result = await wooService.syncProduct(libroConCanales, platform);
          results.push({ platform, success: true, result });
        } catch (error) {
          strapi.log.error(`[libro] Error sincronizando a ${platform}:`, error);
          results.push({ platform, success: false, error: (error as Error).message });
        }
      }
    }

    return results;
  },
}));
