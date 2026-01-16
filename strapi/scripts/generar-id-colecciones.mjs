/**
 * Script para generar id_coleccion usando entityService de Strapi
 * Ejecutar desde la consola de Strapi:
 *   npm run strapi console
 *   Luego: await require('./scripts/generar-id-colecciones.mjs').default({ strapi })
 */

export default async ({ strapi }) => {
  console.log('=== Generar id_coleccion para Colecciones ===\n');
  
  try {
    // Obtener todas las colecciones
    const todas = await strapi.entityService.findMany('api::coleccion.coleccion', {
      limit: -1,
      sort: { id: 'asc' },
    });
    
    console.log(`📚 Total de colecciones: ${todas.length}`);
    
    // Separar con y sin id_coleccion
    const conId = todas.filter(c => c.id_coleccion !== null && c.id_coleccion !== undefined);
    const sinId = todas.filter(c => c.id_coleccion === null || c.id_coleccion === undefined);
    
    console.log(`   Con id_coleccion: ${conId.length}`);
    console.log(`   Sin id_coleccion: ${sinId.length}\n`);
    
    if (sinId.length === 0) {
      console.log('✅ Todas las colecciones ya tienen id_coleccion');
      return;
    }
    
    // Obtener máximo ID existente
    const idsExistentes = new Set(conId.map(c => c.id_coleccion).filter(id => id !== null && id !== undefined));
    const maxId = idsExistentes.size > 0 ? Math.max(...Array.from(idsExistentes)) : 0;
    
    console.log(`🔢 ID máximo existente: ${maxId}`);
    console.log(`📝 Generando IDs a partir de: ${maxId + 1}\n`);
    
    // Generar y actualizar
    let siguienteId = maxId + 1;
    let actualizadas = 0;
    let errores = 0;
    
    for (const coleccion of sinId) {
      try {
        // Asegurar que el ID no esté en uso
        while (idsExistentes.has(siguienteId)) {
          siguienteId++;
        }
        
        await strapi.entityService.update('api::coleccion.coleccion', coleccion.id, {
          data: {
            id_coleccion: siguienteId,
          },
        });
        
        idsExistentes.add(siguienteId);
        siguienteId++;
        actualizadas++;
        
        if (actualizadas % 50 === 0) {
          console.log(`   ✅ ${actualizadas}/${sinId.length} actualizadas...`);
        }
      } catch (error) {
        errores++;
        console.error(`   ❌ Error en ${coleccion.id} (${coleccion.nombre_coleccion}): ${error.message}`);
      }
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Actualizadas: ${actualizadas}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
  }
};

