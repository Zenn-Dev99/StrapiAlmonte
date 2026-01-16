export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Si no se proporciona fecha, usar la fecha actual
    if (!data.fecha) {
      data.fecha = new Date();
    }
  },
};

