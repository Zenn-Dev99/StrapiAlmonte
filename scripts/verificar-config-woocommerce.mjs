/**
 * Script para verificar la configuración de WooCommerce en Strapi
 * (Este script solo muestra qué debería estar configurado, no puede leer las variables de entorno del servidor)
 */

console.log('🔍 Verificación de configuración de WooCommerce\n');
console.log('📋 Variables de entorno que DEBEN estar configuradas en Strapi:\n');

console.log('Para Moraleja:');
console.log('  - WOO_MORALEJA_URL=https://tienda.moraleja.cl');
console.log('  - WOO_MORALEJA_CONSUMER_KEY=ck_...');
console.log('  - WOO_MORALEJA_CONSUMER_SECRET=cs_...\n');

console.log('Para Escolar:');
console.log('  - WOO_ESCOLAR_URL=https://libreriaescolar.cl');
console.log('  - WOO_ESCOLAR_CONSUMER_KEY=ck_...');
console.log('  - WOO_ESCOLAR_CONSUMER_SECRET=cs_...\n');

console.log('Opcional:');
console.log('  - ENABLE_WOOCOMMERCE_SYNC=true (o no configurar, se habilita por defecto)');
console.log('  - ENABLE_WOOCOMMERCE_SYNC=false (para deshabilitar)\n');

console.log('📝 Para verificar si están configuradas:');
console.log('  1. Ve a Railway/Docker/Server donde está corriendo Strapi');
console.log('  2. Revisa las variables de entorno');
console.log('  3. O revisa los logs de Strapi al iniciar - debería mostrar si hay errores de configuración\n');

console.log('🔍 Busca en los logs de Strapi mensajes como:');
console.log('  - "[woo-sync] Configuración de WooCommerce no encontrada"');
console.log('  - "[libro] Error sincronizando a woo_moraleja"');
console.log('  - "[woo-sync] Error obteniendo atributos"');
console.log('  - "[woo-sync] Producto creado/actualizado en woo_moraleja"\n');

console.log('✅ Si todo está bien configurado, deberías ver en los logs:');
console.log('  - "[libro] Iniciando sincronización para libro X"');
console.log('  - "[woo-sync] Sincronizando atributos para libro X"');
console.log('  - "[woo-sync] Producto creado/actualizado en woo_moraleja: ID"\n');




