export default {
  routes: [
    {
      method: 'POST',
      path: '/libros/agregar-precio',
      handler: 'libro.agregarPrecio',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

