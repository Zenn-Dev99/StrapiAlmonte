export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Si no se proporciona fecha, usar la fecha actual
    if (!data.fecha) {
      data.fecha = new Date();
    }

    // Si no se proporciona tipo, usar el default
    if (!data.tipo) {
      data.tipo = 'nota';
    }

    // Si no se proporciona estado, usar el default
    if (!data.estado) {
      data.estado = 'pendiente';
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;

    // Si se actualiza pero no tiene fecha, mantener la fecha actual o establecer una nueva
    // (esto es opcional, depende de tu lógica de negocio)
  },
};
