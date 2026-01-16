export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Si no se proporciona fecha, usar la fecha actual
    if (!data.fecha) {
      data.fecha = new Date().toISOString();
    }

    // Validar que los campos requeridos estén presentes
    if (!data.texto || !data.cliente_id || !data.remitente_id) {
      throw new Error('Los campos texto, cliente_id y remitente_id son requeridos');
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;

    // Validaciones al actualizar
    if (data.texto !== undefined && !data.texto) {
      throw new Error('El campo texto no puede estar vacío');
    }
  },

  async afterCreate(event: any) {
    const { result } = event;
    strapi.log.info(`[intranet-chat] ✅ Mensaje creado: ID ${result.id}, Cliente: ${result.cliente_id}`);
  },

  async afterUpdate(event: any) {
    const { result } = event;
    strapi.log.info(`[intranet-chat] ✅ Mensaje actualizado: ID ${result.id}`);
  },

  async afterDelete(event: any) {
    const { result } = event;
    strapi.log.info(`[intranet-chat] ✅ Mensaje eliminado: ID ${result.id}`);
  }
};













