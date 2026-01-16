// config/server.ts
export default ({ env }) => {
  // Normalizar la URL: asegurar que tenga protocolo y no tenga paths adicionales
  let url = env('URL', 'http://localhost:1337');
  
  // Si la URL no tiene protocolo, agregarlo
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    // En producción, asumir HTTPS
    const isProduction = env('NODE_ENV') === 'production';
    url = `${isProduction ? 'https://' : 'http://'}${url}`;
  }
  
  // Remover cualquier path adicional de la URL (solo debe ser el dominio)
  try {
    const urlObj = new URL(url);
    url = `${urlObj.protocol}//${urlObj.host}`;
  } catch (e) {
    // Si no es una URL válida, usar el valor original
  }
  
  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    url,
    proxy: env.bool('PROXY', true),
    app: { keys: env.array('APP_KEYS') },
    admin: { 
      path: env('ADMIN_PATH', '/admin'),
      // URL pública del admin (necesaria cuando está detrás de proxy como Cloudflare)
      url: env('ADMIN_URL', url),
    },
  };
};
