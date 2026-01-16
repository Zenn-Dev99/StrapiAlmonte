// Nota: evitamos tipos estrictos para compatibilidad con Strapi v5 en tiempo de build
// 
// SIMPLIFICACIÓN: Las relaciones geográficas directas (region, provincia, zona) 
// fueron eliminadas del schema. Ahora solo mantenemos la relación con comuna
// y derivamos región/provincia cuando sea necesario en los controladores.
//
// Esto simplifica el modelo y elimina redundancias, ya que comuna siempre
// tiene provincia, y provincia siempre tiene región y zona.

export default {
  // Los lifecycles de enriquecimiento geográfico ya no son necesarios
  // ya que las relaciones directas fueron eliminadas.
  // Si se necesita región/provincia, se obtiene desde comuna en los controladores.
  
  async beforeCreate(event) {
    // Lifecycle simplificado - ya no es necesario enriquecer relaciones geográficas
    // La relación con comuna es suficiente
  },

  async beforeUpdate(event) {
    // Lifecycle simplificado - ya no es necesario enriquecer relaciones geográficas
    // La relación con comuna es suficiente
  },
};
