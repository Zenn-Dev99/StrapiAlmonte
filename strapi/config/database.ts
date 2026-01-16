import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite').toLowerCase();

  // Helper para construir configuración SSL
  const buildSSLConfig = () => {
    const sslEnabled = env.bool('DATABASE_SSL', false);
    if (!sslEnabled) return false;

    // Si DATABASE_SSL=true pero no hay configuración específica, usar modo requerido simple
    const sslMode = env('DATABASE_SSL_MODE', 'require');
    
    // Para PostgreSQL, si SSL está habilitado pero no hay certificados, usar modo simple
    if (client === 'postgres' && sslMode === 'require') {
      return {
        rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
      };
    }

    // Configuración SSL completa si hay certificados
    const sslConfig: any = {
      key: env('DATABASE_SSL_KEY', undefined),
      cert: env('DATABASE_SSL_CERT', undefined),
      ca: env('DATABASE_SSL_CA', undefined),
      capath: env('DATABASE_SSL_CAPATH', undefined),
      cipher: env('DATABASE_SSL_CIPHER', undefined),
      rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
    };

    // Solo retornar SSL config si hay al menos una propiedad definida
    const hasSSLConfig = Object.values(sslConfig).some((v) => v !== undefined);
    return hasSSLConfig ? sslConfig : { rejectUnauthorized: false };
  };

  const connections = {
    mysql: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: buildSSLConfig(),
      },
      pool: { 
        min: env.int('DATABASE_POOL_MIN', 2), 
        max: env.int('DATABASE_POOL_MAX', 10),
        acquireTimeoutMillis: env.int('DATABASE_POOL_ACQUIRE_TIMEOUT', 30000),
        createTimeoutMillis: env.int('DATABASE_POOL_CREATE_TIMEOUT', 30000),
        idleTimeoutMillis: env.int('DATABASE_POOL_IDLE_TIMEOUT', 30000),
        reapIntervalMillis: env.int('DATABASE_POOL_REAP_INTERVAL', 1000),
      },
    },
    postgres: {
      connection: (() => {
        // Prioridad 1: DATABASE_URL (más común en servicios cloud)
        const databaseUrl = env('DATABASE_URL');
        if (databaseUrl) {
          const sslConfig = buildSSLConfig();
          return {
            connectionString: databaseUrl,
            ssl: sslConfig !== false ? sslConfig : undefined,
            schema: env('DATABASE_SCHEMA', 'public'),
          };
        }

        // Prioridad 2: Parámetros individuales
        const host = env('DATABASE_HOST', 'localhost');
        const port = env.int('DATABASE_PORT', 5432);
        const database = env('DATABASE_NAME', 'strapi');
        const user = env('DATABASE_USERNAME', 'strapi');
        const password = env('DATABASE_PASSWORD', 'strapi');
        const schema = env('DATABASE_SCHEMA', 'public');
        const sslConfig = buildSSLConfig();

        const connection: any = {
          host,
          port,
          database,
          user,
          password,
          schema,
        };

        if (sslConfig !== false) {
          connection.ssl = sslConfig;
        }

        return connection;
      })(),
      pool: { 
        min: env.int('DATABASE_POOL_MIN', 2), 
        max: env.int('DATABASE_POOL_MAX', 10),
        acquireTimeoutMillis: env.int('DATABASE_POOL_ACQUIRE_TIMEOUT', 30000),
        createTimeoutMillis: env.int('DATABASE_POOL_CREATE_TIMEOUT', 30000),
        idleTimeoutMillis: env.int('DATABASE_POOL_IDLE_TIMEOUT', 30000),
        reapIntervalMillis: env.int('DATABASE_POOL_REAP_INTERVAL', 1000),
      },
    },
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  // Validar que el cliente sea soportado
  if (!connections[client]) {
    throw new Error(
      `Cliente de base de datos no soportado: "${client}". ` +
      `Clientes soportados: ${Object.keys(connections).join(', ')}`
    );
  }

  const connectionConfig = {
    client,
    ...connections[client],
    acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
  };

  const result = {
    connection: connectionConfig,
  };

  // Logging de configuración (sin exponer contraseñas)
  if (process.env.NODE_ENV !== 'production') {
    const logConfig = JSON.parse(JSON.stringify(result));
    const db = logConfig.connection;
    if (db?.connection?.password) {
      db.connection.password = '***';
    }
    if (db?.connection?.connectionString) {
      try {
        const url = new URL(db.connection.connectionString);
        if (url.password) {
          url.password = '***';
          db.connection.connectionString = url.toString();
        }
      } catch (err) {
        // Ignorar errores al parsear URLs inválidas
      }
    }
    console.log('[database] Configuración:', JSON.stringify(logConfig, null, 2));
  }

  return result;
};
