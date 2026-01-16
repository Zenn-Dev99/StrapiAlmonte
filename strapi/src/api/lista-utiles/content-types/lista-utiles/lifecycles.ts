export default {
  async beforeCreate(event) {
    const data = event.params?.data || {};
    
    // Establecer año actual si no se proporciona
    if (!data.año) {
      data.año = new Date().getFullYear();
    }
  },
  async beforeUpdate(event) {
    const data = event.params?.data || {};
    
    // Establecer año actual si no se proporciona (en updates)
    if (!data.año && !('año' in data)) {
      data.año = new Date().getFullYear();
    }
  },
};
