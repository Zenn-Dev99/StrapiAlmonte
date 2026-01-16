export default ({ env }) => {
  const plugins: Record<string, unknown> = {};

  if (env('S3_BUCKET')) {
    plugins.upload = {
      config: {
        sizeLimit: (env.int('UPLOAD_SIZE_LIMIT_MB', 200) || 200) * 1024 * 1024,
        provider: '@strapi/provider-upload-aws-s3',
        providerOptions: {
          baseUrl: env('S3_BASE_URL', undefined),
          s3Options: {
            region: env('S3_REGION', 'auto'),
            endpoint: env('S3_ENDPOINT'),
            forcePathStyle: env.bool('S3_FORCE_PATH_STYLE', true),
            credentials: {
              accessKeyId: env('S3_ACCESS_KEY_ID'),
              secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
            },
          },
          params: {
            Bucket: env('S3_BUCKET'),
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
    };
  }

  // Prioridad: SendGrid si está configurado, sino usar SMTP como fallback
  if (env('SENDGRID_API_KEY')) {
    plugins.email = {
      config: {
        provider: 'sendgrid',
        providerOptions: {
          apiKey: env('SENDGRID_API_KEY'),
        },
        settings: {
          defaultFrom: env('SENDGRID_DEFAULT_FROM', 'no-reply@mira.app'),
          defaultReplyTo: env('SENDGRID_DEFAULT_REPLY_TO', 'soporte@mira.app'),
        },
      },
    };
  } else if (env('SMTP_HOST')) {
    const auth = env('SMTP_USERNAME')
      ? {
          auth: {
            user: env('SMTP_USERNAME'),
            pass: env('SMTP_PASSWORD'),
          },
        }
      : {};

    const tls = env.bool('SMTP_TLS_REJECT_UNAUTHORIZED', true)
      ? {}
      : { tls: { rejectUnauthorized: false } };

    plugins.email = {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: env('SMTP_HOST'),
          port: env.int('SMTP_PORT', 587),
          secure: env.bool('SMTP_SECURE', false),
          ...auth,
          ...tls,
        },
        settings: {
          defaultFrom: env('SMTP_DEFAULT_FROM', 'no-reply@localhost'),
          defaultReplyTo: env('SMTP_DEFAULT_REPLY_TO', 'no-reply@localhost'),
        },
      },
    };
  }

  return plugins;
};
