export default {
  routes: [
    {
      method: 'POST',
      path: '/evaluaciones',
      handler: 'evaluacion.create',
      config: {
        auth: false, // Deshabilitar autenticación para crear evaluaciones
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/evaluaciones',
      handler: 'evaluacion.find',
      config: {
        auth: false, // Deshabilitar autenticación para listar evaluaciones (JWT personalizado no es reconocido por Strapi)
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/evaluaciones/:id',
      handler: 'evaluacion.findOne',
      config: {
        auth: false, // Deshabilitar autenticación para obtener una evaluación
        policies: [],
        middlewares: [],
      },
    },
  ],
};

