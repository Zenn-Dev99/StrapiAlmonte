export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    if (!data.fecha_procesamiento) {
      data.fecha_procesamiento = new Date();
    }
  },
};

