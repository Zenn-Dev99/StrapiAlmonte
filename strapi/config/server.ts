// config/server.ts
export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL', 'http://localhost:1337'),
  proxy: env.bool('PROXY', true),
  app: { keys: env.array('APP_KEYS') },
  admin: { 
    path: env('ADMIN_PATH', '/admin'),
    // URL pública del admin (necesaria cuando está detrás de proxy como Cloudflare)
    url: env('ADMIN_URL', env('URL', 'http://localhost:1337')),
  },
});
