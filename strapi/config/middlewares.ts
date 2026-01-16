export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::poweredBy',
  'strapi::favicon',
  'strapi::public', // CRÍTICO: Servir archivos estáticos PRIMERO, antes de cualquier otro middleware
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Permite cargar scripts desde CDNs necesarios (Cloudflare, etc.)
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://static.cloudflareinsights.com',
            'https:',
          ],
          // Permite cargar imágenes y media desde el CDN
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https:',
            'http:',
            'media.moraleja.cl',
            'd0d33d133a62a52212828b990b6df604.r2.cloudflarestorage.com',
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'https:',
            'http:',
            'media.moraleja.cl',
            'd0d33d133a62a52212828b990b6df604.r2.cloudflarestorage.com',
          ],
          'connect-src': [
            "'self'",
            'https:',
            'http:',
            'ws:',
            'wss:',
            'https://static.cloudflareinsights.com',
          ],
          'frame-src': ["'self'", 'https:', 'http:'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'https://strapi.moraleja.cl',
        'https://intranet.moraleja.cl',
        'https://staging.moraleja.cl',
        'https://staging.escolar.cl',
        'https://moraleja.cl',
        'https://escolar.cl',
        'https://mira-almonte-production.up.railway.app',
        'https://etiquetas-escolar-production-f449.up.railway.app',
        'http://localhost:3000', // Para desarrollo local
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Range', 'X-WC-Webhook-Source'],
      keepHeaderOnError: true,
    },
  },
  'global::fix-query-filters',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      jsonLimit: '200mb',
      formLimit: '200mb',
      textLimit: '200mb',
    },
  },
  'strapi::session',
];
