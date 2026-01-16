/**
 * Script simple para generar IDs usando entityService
 * Ejecutar con: echo "await require('./scripts/generar-ids-simple.js')({ strapi })" | npm run strapi console
 */

module.exports = async ({ strapi }) => {
  console.log('=== Generar id_coleccion para Colecciones ===\n');
  
  try {
    const todas = await strapi.entityService.findMany('api::coleccion.coleccion', {
      limit: -1,
      sort: { id: 'asc' },
    });
    
    console.log(`📚 Total: ${todas.length}`);
    
    const conId = todas.filter(c => c.id_coleccion !== null && c.id_coleccion !== undefined);
    const sinId = todas.filter(c => c.id_coleccion === null || c.id_coleccion === undefined);
    
    console.log(`   Con id_coleccion: ${conId.length}`);
    console.log(`   Sin id_coleccion: ${sinId.length}\n`);
    
    if (sinId.length === 0) {
      console.log('✅ Todas tienen id_coleccion');
      return;
    }
    
    const idsExistentes = new Set(conId.map(c => c.id_coleccion).filter(id => id !== null && id !== undefined));
    const maxId = idsExistentes.size > 0 ? Math.max(...Array.from(idsExistentes)) : 0;
    
    console.log(`🔢 ID máximo: ${maxId}`);
    console.log(`📝 Generando desde: ${maxId + 1}\n`);
    
    let siguienteId = maxId + 1;
    let actualizadas = 0;
    let errores = 0;
    
    for (const coleccion of sinId) {
      try {
        while (idsExistentes.has(siguienteId)) {
          siguienteId++;
        }
        
        await strapi.entityService.update('api::coleccion.coleccion', coleccion.id, {
          data: { id_coleccion: siguienteId },
        });
        
        idsExistentes.add(siguienteId);
        siguienteId++;
        actualizadas++;
        
        if (actualizadas % 50 === 0) {
          console.log(`   ✅ ${actualizadas}/${sinId.length}...`);
        }
      } catch (error) {
        errores++;
        console.error(`   ❌ ${coleccion.id}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 ✅ ${actualizadas} | ❌ ${errores}`);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
};
