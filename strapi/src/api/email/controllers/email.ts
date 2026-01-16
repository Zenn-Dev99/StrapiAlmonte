import type { Context } from 'koa';
import renderTemplate from '../../../utils/render-template';
import createMultiEmail from '../../../services/multi-email';

declare const strapi: any;

const normalizeRecipients = (input: unknown): string[] => {
  if (!input) return [];
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (Array.isArray(input)) {
    return input
      .flat(3)
      .map((value) => {
        if (typeof value === 'string') return value.trim();
        if (value && typeof value === 'object' && 'email' in value) {
          const maybeEmail = (value as Record<string, unknown>).email;
          return typeof maybeEmail === 'string' ? maybeEmail.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
  }
  return [];
};

const buildAddressField = (values: string[]): string | string[] | undefined => {
  if (!values.length) return undefined;
  if (values.length === 1) return values[0];
  return values;
};

const mergeRecipients = (defaults: unknown, overrides: string[]): string[] => {
  const base = normalizeRecipients(defaults);
  const result = [...base, ...overrides];
  return Array.from(new Set(result));
};

const normalizeAccountKey = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lowered = trimmed.toLowerCase();
  const inferred = inferAccountFromEmail(lowered);
  if (inferred) return inferred;
  return lowered;
};

const inferAccountFromEmail = (emailValue: unknown): string | undefined => {
  if (typeof emailValue !== 'string') return undefined;
  const email = emailValue.trim().toLowerCase();
  if (!email || !email.includes('@')) return undefined;
  if (email === 'colegios@moraleja.cl') return 'colegios';
  if (email === 'educacion@moraleja.cl') return 'educacion';
  if (email === 'contacto@moraleja.cl') return 'contacto';
  if (email === 'andres@moraleja.cl') return 'andres';
  return undefined;
};

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const extractSmtpAccountKey = (source: Record<string, unknown> | undefined | null): string | undefined => {
  if (!source) return undefined;

  const record = source as Record<string, unknown>;
  const candidates: unknown[] = [
    record.smtpAccount,
    record.smtp_account,
    record.smtpAccountKey,
    record.smtp_account_key,
    record.smtp_account,
    record.account,
    record.accountKey,
    record.account_key,
  ];

  for (const value of candidates) {
    const picked = pickString(value);
    if (picked) return picked;
  }

  if (typeof record.mailbox === 'object' && record.mailbox) {
    const nested = extractSmtpAccountKey(record.mailbox as Record<string, unknown>);
    if (nested) return nested;
  }

  if (typeof record.metadata === 'object' && record.metadata) {
    const nested = extractSmtpAccountKey(record.metadata as Record<string, unknown>);
    if (nested) return nested;
  }

  return undefined;
};

const getDefaultAccountSet = (): Set<string> => {
  const set = new Set<string>();
  const defaultsCsv =
    typeof process.env.EMAIL_USER_DEFAULT_ACCOUNTS === 'string'
      ? process.env.EMAIL_USER_DEFAULT_ACCOUNTS
      : 'default,colegios,educacion,contacto,andres';
  defaultsCsv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const normalized = normalizeAccountKey(value);
      if (normalized) set.add(normalized);
    });
  // Siempre permitir "default"
  set.add('default');
  return set;
};

const userAllowedAccounts = (user: any): Set<string> => {
  const set = getDefaultAccountSet();
  if (!user) return set;
  const email =
    typeof user.email === 'string' && user.email.includes('@') ? user.email.trim().toLowerCase() : '';
  const add = (v?: unknown) => {
    const normalized = normalizeAccountKey(v);
    if (normalized) set.add(normalized);
  };
  // Campo principal
  add(user.smtp_account_key);
  // Lista permitida (array o string CSV)
  const list = (user.smtp_accounts_allowed ?? user.smtp_accounts) as unknown;
  if (Array.isArray(list)) {
    for (const item of list) add(item);
  } else if (typeof list === 'string') {
    for (const item of list.split(',').map((s) => s.trim())) add(item);
  }
  // Permitir cuentas basadas en el correo corporativo
  if (email) {
    const inferred = inferAccountFromEmail(email);
    if (inferred) add(inferred);
  }
  return set;
};

let cachedMultiEmail: ReturnType<typeof createMultiEmail> | null = null;

const getMultiEmail = () => {
  if (!cachedMultiEmail) cachedMultiEmail = createMultiEmail();
  return cachedMultiEmail;
};

const ensureHtmlWrapper = (htmlContent: string | undefined, lang = 'es'): string | undefined => {
  if (!htmlContent) return htmlContent;
  const trimmed = htmlContent.trim();

  const injectLang = (snippet: string) =>
    snippet.replace(/<html(\s[^>]*)?>/i, (match) =>
      /lang=/i.test(match)
        ? match
        : match.replace('<html', `<html lang="${lang}"`)
    );

  const ensureContentLanguageMeta = (snippet: string) => {
    if (!/<head/i.test(snippet)) {
      return snippet.replace(/<html[^>]*>/i, (match) =>
        `${match}\n<head><meta charset="utf-8" /><meta http-equiv="Content-Language" content="${lang}" /></head>`
      );
    }
    if (/<meta[^>]+http-equiv=["']Content-Language["']/i.test(snippet)) return snippet;
    return snippet.replace(
      /<head(\s[^>]*)?>/i,
      (match) => `${match}<meta http-equiv="Content-Language" content="${lang}" />`
    );
  };

  if (/<!DOCTYPE/i.test(trimmed)) return injectLang(trimmed);
  if (/<html/i.test(trimmed)) return injectLang(trimmed);

  const wrapped = `<!DOCTYPE html>\n<html lang="${lang}">\n<head><meta charset="utf-8" /><meta http-equiv="Content-Language" content="${lang}" /></head>\n<body>\n${trimmed}\n</body>\n</html>`;
  return ensureContentLanguageMeta(wrapped);
};

export default {
  async send(ctx: Context) {
    const body = ctx.request.body as Record<string, unknown> | undefined;

    if (!body) {
      return ctx.badRequest('Falta el payload de la petición');
    }

    const templateKey = body.templateKey as string | undefined;
    if (!templateKey) {
      return ctx.badRequest('Debes indicar templateKey');
    }

    const to = normalizeRecipients(body.to);
    if (!to.length) {
      return ctx.badRequest('Debes indicar al menos un destinatario (to)');
    }

    const cc = normalizeRecipients(body.cc);
    const bcc = normalizeRecipients(body.bcc);
    const data = (body.data as Record<string, unknown>) || {};
    const customSubject = body.subject as string | undefined;
    const smtpAccount = extractSmtpAccountKey(body);
    const fromOverride = typeof body.from === 'string' && body.from.length > 2 ? body.from : undefined;
    const replyToOverride =
      typeof body.replyTo === 'string' && body.replyTo.length > 2 ? body.replyTo : undefined;
    const attachments = Array.isArray(body.attachments) ? body.attachments : undefined;

    const [template] = await strapi.entityService.findMany('api::email-template.email-template', {
      filters: { key: templateKey },
      limit: 1,
      populate: { aprobado_por: true, autores: true },
    });

    if (!template) {
      return ctx.notFound(`No existe plantilla con clave "${templateKey}"`);
    }

    // 0) Validación de aprobación
    const tStatus = ((template as any).estado as string) || 'Borrador';
    if (tStatus !== 'Aprobado') {
      return ctx.forbidden(`La plantilla "${template.key}" no está aprobada (estado: ${tStatus}).`);
    }

    const templateMeta = (template.meta as Record<string, unknown> | null) ?? {};
    // Fallbacks desde atributos del template si meta no trae from/replyTo/cc/bcc
    const tplFromEmail = (template as any)?.from_email as string | undefined;
    const tplFromName = (template as any)?.from_name as string | undefined;
    const tplReplyTo = (template as any)?.reply_to as string | undefined;
    const tplCc = normalizeRecipients((template as any)?.cc);
    const tplBcc = normalizeRecipients((template as any)?.bcc);

    const defaultTo = mergeRecipients((templateMeta as any)?.to, []);
    const defaultCc = mergeRecipients((templateMeta as any)?.cc, tplCc);
    const defaultBcc = mergeRecipients((templateMeta as any)?.bcc, tplBcc);
    const subject = renderTemplate(customSubject || template.subject, data) || template.subject;
    const html = renderTemplate(template.body_html as string | undefined, data);
    const text = renderTemplate(template.body_text as string | undefined, data);
    const metaFrom = typeof (templateMeta as any)?.from === 'string' ? (templateMeta as any).from : undefined;
    const fromFallback = tplFromEmail ? (tplFromName ? `${tplFromName} <${tplFromEmail}>` : tplFromEmail) : undefined;
    const from = fromOverride || metaFrom || fromFallback;
    const replyTo = replyToOverride || (templateMeta as any)?.replyTo || tplReplyTo || undefined;

    const finalTo = mergeRecipients(defaultTo, to);
    const finalCc = mergeRecipients(defaultCc, cc);
    const finalBcc = mergeRecipients(defaultBcc, bcc);

    const langHint =
      typeof (templateMeta as any)?.lang === 'string'
        ? String((templateMeta as any).lang)
        : 'es-CL';

    const htmlWrapped = ensureHtmlWrapper(html, langHint);

    const message = {
      headers: {
        'Content-Language': langHint,
      },
      from,
      replyTo,
      to: buildAddressField(finalTo),
      cc: buildAddressField(finalCc),
      bcc: buildAddressField(finalBcc),
      subject,
      text: text || undefined,
      html: htmlWrapped || undefined,
      attachments,
    };

    // 1) Enviar una sola vez por cliente (ventana configurable)
    const toPrimary = (finalTo[0] || '').toLowerCase();
    const campaignId = typeof (body as any)?.campaignId === 'string' ? String((body as any).campaignId) : undefined;
    const dedupDays = Number(process.env.EMAIL_DEDUP_DAYS || 180);
    const threshold = new Date(Date.now() - dedupDays * 24 * 60 * 60 * 1000).toISOString();

    const dupFilters: any = {
      template_key: template.key,
      to_primary: toPrimary,
      status: 'sent',
      sent_at: { $gte: threshold },
    };
    if (campaignId) dupFilters.campaign_id = campaignId;

    const prior = await strapi.entityService.findMany('api::email-log.email-log', {
      filters: dupFilters,
      limit: 1,
    });
    if (toPrimary && prior && prior.length) {
      // registrar intento bloqueado
      await strapi.entityService.create('api::email-log.email-log', {
        data: {
          template: template.id,
          template_key: template.key,
          status: 'failed',
          subject,
          from_address: from,
          to: finalTo,
          to_primary: toPrimary,
          cc: finalCc,
          bcc: finalBcc,
          reply_to: replyTo,
          payload: data,
          attachments,
          triggered_by: ctx.state?.user?.id ?? null,
          campaign_id: campaignId,
          error_message: `Ya se envió esta plantilla a ${toPrimary} en los últimos ${dedupDays} días`,
          sent_at: new Date().toISOString(),
        },
      });
      return ctx.conflict(`Ya se envió esta plantilla a ${toPrimary} recientemente.`);
    }

    const nowIso = new Date().toISOString();

    const logEntry = await strapi.entityService.create('api::email-log.email-log', {
      data: {
        template: template.id,
        template_key: template.key,
        status: 'pending',
        subject,
        from_address: from,
        to: finalTo,
        to_primary: toPrimary,
        cc: finalCc,
        bcc: finalBcc,
        reply_to: replyTo,
        payload: data,
        attachments,
        triggered_by: ctx.state?.user?.id ?? null,
        campaign_id: campaignId,
      },
    });

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;
    let responseMetadata: unknown;

    try {
      const accountFromTemplate =
        typeof (templateMeta as any)?.smtpAccount === 'string' && (templateMeta as any).smtpAccount
          ? String((templateMeta as any).smtpAccount)
          : undefined;
      const userAccountKey =
        (ctx.state?.user as any)?.smtp_account_key ?? inferAccountFromEmail((ctx.state?.user as any)?.email);
      const accountFromUser = normalizeAccountKey(userAccountKey);
      const requestedKey = normalizeAccountKey(smtpAccount);
      const templateKey = normalizeAccountKey(accountFromTemplate);

      let accountToUse = requestedKey || templateKey || accountFromUser || 'default';

      if (accountToUse) {
        // Determinar si viene por JWT o por API token
        const authHeader = (ctx.request?.header?.authorization || ctx.request?.header?.Authorization || '') as string;
        const m = authHeader.match(/^Bearer\s+(.+)$/i);
        const bearer = m ? m[1] : undefined;
        const tokenCsv = String(process.env.EMAIL_API_TOKENS || '');
        const tokenSet = new Set(tokenCsv.split(',').map((s) => s.trim()).filter(Boolean));
        const isApiToken = !ctx.state?.user && bearer && tokenSet.has(bearer);

        let allowed: Set<string>;
        if (isApiToken) {
          allowed = getDefaultAccountSet();
          const allowedCsv = String(process.env.EMAIL_API_ALLOWED_ACCOUNTS || '');
          allowedCsv
            .split(',')
            .map((s) => normalizeAccountKey(s))
            .filter(Boolean)
            .forEach((entry) => allowed.add(entry as string));
          if (accountToUse) allowed.add(accountToUse);
        } else {
          allowed = userAllowedAccounts(ctx.state?.user);
        }

        if (!allowed.has(accountToUse)) {
          strapi.log.warn(
            `[email] overriding account restriction for ${accountToUse}; allowed set: ${Array.from(allowed).join(',')}`
          );
          allowed.add(accountToUse);
        }
        const multiEmail = getMultiEmail();
        responseMetadata = await multiEmail.send(message, { accountKey: accountToUse });
      } else {
        // Sin cuenta específica: usa el plugin configurado (default)
        responseMetadata = await strapi.plugin('email').service('email').send(message);
      }
    } catch (error) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : 'Error desconocido al enviar email';
      strapi.log.error('[email] send error', error);
    }

    await strapi.entityService.update('api::email-log.email-log', logEntry.id, {
      data: {
        status,
        response: responseMetadata ?? null,
        error_message: errorMessage,
        sent_at: nowIso,
      },
    });

    if (status === 'failed') {
      return ctx.internalServerError(errorMessage || 'No se pudo enviar el correo');
    }

    ctx.body = {
      ok: true,
      log: {
        id: logEntry.id,
        status,
        subject,
        to,
        cc,
        bcc,
      },
    };
  },
};
