import nodemailerProvider from '@strapi/provider-email-nodemailer';

type SendOptions = Record<string, unknown>;

interface AccountEnvCfg {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
  tlsRejectUnauthorized?: boolean;
}

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
};

const toNum = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const readAccountFromEnv = (key: string): AccountEnvCfg => {
  const prefix = key === 'default' ? 'SMTP' : `SMTP_${key.toUpperCase()}`;
  return {
    host: process.env[`${prefix}_HOST`],
    port: toNum(process.env[`${prefix}_PORT`], 587),
    secure: toBool(process.env[`${prefix}_SECURE`], false),
    user: process.env[`${prefix}_USERNAME`],
    pass: process.env[`${prefix}_PASSWORD`],
    defaultFrom: process.env[`${prefix}_DEFAULT_FROM`],
    defaultReplyTo: process.env[`${prefix}_DEFAULT_REPLY_TO`],
    tlsRejectUnauthorized: toBool(process.env[`${prefix}_TLS_REJECT_UNAUTHORIZED`], true),
  };
};

const buildProvider = (cfg: AccountEnvCfg) => {
  if (!cfg.host) throw new Error('Falta host SMTP en cuenta');
  const auth = cfg.user
    ? {
        auth: {
          user: cfg.user,
          pass: cfg.pass,
        },
      }
    : {};

  const tls = cfg.tlsRejectUnauthorized ? {} : { tls: { rejectUnauthorized: false } };

  const provider = (nodemailerProvider as any).init(
    {
      host: cfg.host,
      port: cfg.port ?? 587,
      secure: !!cfg.secure,
      ...auth,
      ...tls,
    },
    {
      defaultFrom: cfg.defaultFrom || 'no-reply@localhost',
      defaultReplyTo: cfg.defaultReplyTo || 'no-reply@localhost',
    }
  );

  return provider;
};

export default () => {
  const providers: Record<string, any> = {};

  const getAccountKeys = (): string[] => {
    const raw = process.env.SMTP_ACCOUNTS || '';
    const extra = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    return ['default', ...Array.from(new Set(extra))];
  };

  const getProvider = (accountKey: string) => {
    const key = (accountKey || 'default').toLowerCase();
    if (!providers[key]) {
      const envCfg = readAccountFromEnv(key);
      providers[key] = buildProvider(envCfg);
    }
    return providers[key];
  };

  const send = async (message: SendOptions, opts?: { accountKey?: string }) => {
    const key = (opts?.accountKey || 'default').toLowerCase();
    const provider = getProvider(key);
    return provider.send(message);
  };

  return {
    send,
    getAccountKeys,
  };
};
