'use strict';

/**
 * precio controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::precio.precio', ({ strapi }) => ({
  
  // Método personalizado para crear precio
  async crear(ctx) {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[Strapi Precio] 📦 Body recibido:', JSON.stringify(ctx.request.body, null, 2));
      console.log('═══════════════════════════════════════════════════════');
      
      const { precio_venta, libro, libroId, fecha_inicio, precio_costo, fecha_fin, activo } = ctx.request.body;
      
      // Aceptar tanto 'libro' como 'libroId' para compatibilidad
      const libroIdFinal = libro || libroId;
      
      // Validaciones
      if (!precio_venta || precio_venta <= 0) {
        console.error('[Strapi Precio] ❌ Validación falló: precio_venta');
        return ctx.badRequest('precio_venta es requerido y debe ser mayor a 0');
      }
      
      if (!libroIdFinal) {
        console.error('[Strapi Precio] ❌ Validación falló: libro');
        return ctx.badRequest('libro (o libroId) es requerido');
      }
      
      if (!fecha_inicio) {
        console.error('[Strapi Precio] ❌ Validación falló: fecha_inicio');
        return ctx.badRequest('fecha_inicio es requerida');
      }
      
      console.log('[Strapi Precio] ✅ Validaciones pasadas');
      console.log('[Strapi Precio] 📝 Creando precio en la base de datos...');
      
      // Crear el precio usando el servicio de Strapi
      const nuevoPrecio = await strapi.entityService.create('api::precio.precio', {
        data: {
          precio_venta: parseFloat(precio_venta),
          libro: parseInt(libroIdFinal),
          fecha_inicio: new Date(fecha_inicio),
          precio_costo: precio_costo ? parseFloat(precio_costo) : null,
          fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
          activo: activo !== undefined ? activo : true,
        },
      });
      
      console.log('[Strapi Precio] ✅ Precio creado exitosamente, ID:', nuevoPrecio.id);
      console.log('═══════════════════════════════════════════════════════');
      
      return ctx.send({
        data: nuevoPrecio,
        message: 'Precio creado exitosamente'
      });
      
    } catch (error) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('[Strapi Precio] ❌ ERROR al crear precio:', error.message);
      console.error('[Strapi Precio] Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════════');
      
      return ctx.badRequest(error.message || 'Error al crear precio', {
        error: error.message,
        details: error.details
      });
    }
  },
  
}));

