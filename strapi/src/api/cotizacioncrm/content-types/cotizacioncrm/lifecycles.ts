export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    if (!data.fecha_creacion) {
      data.fecha_creacion = new Date();
    }
  },
};
