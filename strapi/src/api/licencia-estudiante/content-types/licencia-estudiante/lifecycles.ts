export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    if (!data.fecha_activacion) {
      data.fecha_activacion = new Date();
    }
    // Si no se especifica google_drive_folder_id, usar el del libro
    if (!data.google_drive_folder_id && data.libro_mira) {
      const libroMiraId = typeof data.libro_mira === 'object' 
        ? (data.libro_mira.documentId || data.libro_mira.id) 
        : data.libro_mira;
      
      if (libroMiraId) {
        const libroMira = await strapi.entityService.findOne(
          'api::libro-mira.libro-mira' as any,
          libroMiraId,
          { fields: ['google_drive_folder_id'] }
        );
        if (libroMira?.google_drive_folder_id) {
          data.google_drive_folder_id = libroMira.google_drive_folder_id;
        }
      }
    }
  },
};

