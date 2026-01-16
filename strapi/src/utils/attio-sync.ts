const ATTIO_API_URL = process.env.ATTIO_API_URL ?? 'https://api.attio.com/v2';
const ATTIO_API_TOKEN = process.env.ATTIO_API_TOKEN;

type ColegioEntity = {
  id: number;
  documentId?: string;
  colegio_nombre?: string;
  rbd?: number | null;
  estado?: string | null;
  dependencia?: string | null;
  attio_company_id?: string | null;
  attio_metadata?: unknown;
  Website?: Array<{
    website?: string | null;
    status?: boolean | null;
  }> | null;
  comuna?: {
    id: number;
    comuna_nombre?: string | null;
    region_nombre?: string | null;
  } | null;
};

type AttioValues = {
  name: string;
  rbd?: number;
  nombre_estado?: string;
  dependencia?: string[];
  comuna?: string;
  region?: string;
  domains?: string[];
};

const UNSUPPORTED = !ATTIO_API_TOKEN;

const ATTIO_HEADERS = ATTIO_API_TOKEN
  ? {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${ATTIO_API_TOKEN}`,
    }
  : undefined;

function extractDomain(website: string | undefined | null): string | null {
  if (!website) return null;
  let cleaned = website.trim();
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const { hostname } = new URL(cleaned);
    return hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return cleaned.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
  }
}

function buildAttioValues(colegio: ColegioEntity): AttioValues | null {
  const name = (colegio.colegio_nombre ?? '').trim();
  if (!name) return null;

  const values: AttioValues = { name };

  if (colegio.rbd) {
    const rbdNumber = Number.parseInt(String(colegio.rbd), 10);
    if (!Number.isNaN(rbdNumber)) {
      values.rbd = rbdNumber;
    }
  }

  if (colegio.estado) {
    values.nombre_estado = colegio.estado;
  }

  if (colegio.dependencia) {
    values.dependencia = [colegio.dependencia];
  }

  const comunaNombre = (colegio as any)?.comuna?.comuna_nombre ?? (colegio as any)?.comuna_nombre;
  if (typeof comunaNombre === 'string' && comunaNombre.trim()) {
    values.comuna = comunaNombre.trim();
  }

  const regionNombre = (colegio as any)?.comuna?.region_nombre ?? (colegio as any)?.region_nombre;
  if (typeof regionNombre === 'string' && regionNombre.trim()) {
    values.region = regionNombre.trim();
  }

  const websites = Array.isArray(colegio.Website) ? colegio.Website : [];
  const preferred = websites.find((item) => item?.status !== false) ?? websites[0];
  const domain = extractDomain(preferred?.website);
  if (domain) {
    values.domains = [domain];
  }

  return values;
}

async function attioRequest<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T | null> {
  if (UNSUPPORTED || !ATTIO_HEADERS) {
    return null;
  }

  const response = await fetch(`${ATTIO_API_URL}${path}`, {
    method,
    headers: ATTIO_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Attio ${method} ${path} -> ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}

async function loadColegio(strapi: any, colegio: number | ColegioEntity): Promise<ColegioEntity | null> {
  if (typeof colegio === 'object') {
    return colegio;
  }

  return (await strapi.entityService.findOne('api::colegio.colegio', colegio, {
    fields: ['colegio_nombre', 'rbd', 'estado', 'dependencia', 'attio_company_id', 'attio_metadata'],
    populate: {
      Website: true,
      comuna: {
        fields: ['comuna_nombre', 'region_nombre'],
      },
    },
  })) as ColegioEntity;
}

function buildWhereClause(entity: ColegioEntity) {
  if (entity.documentId) {
    return { documentId: entity.documentId };
  }
  return { id: entity.id };
}

export async function syncColegio(strapi: any, colegioInput: number | ColegioEntity): Promise<void> {
  if (UNSUPPORTED) {
    strapi.log.warn('[attio-sync] ATTIO_API_TOKEN no está definido, se omite la sincronización.');
    return;
  }

  const colegio = await loadColegio(strapi, colegioInput);
  if (!colegio) return;

  const values = buildAttioValues(colegio);
  if (!values) {
    strapi.log.debug(`[attio-sync] Colegio ${colegio.id} sin nombre, omitiendo.`);
    return;
  }

  const metadata = {
    syncedAt: new Date().toISOString(),
    payload: values,
  };

  try {
    if (colegio.attio_company_id) {
      await attioRequest(`/objects/companies/records/${colegio.attio_company_id}`, 'PATCH', {
        data: { values },
      });

      await strapi.db.query('api::colegio.colegio').update({
        where: buildWhereClause(colegio),
        data: { attio_metadata: metadata },
      });
      return;
    }

    const result = await attioRequest<{ data?: { id?: { record_id?: string } } }>(
      '/objects/companies/records',
      'POST',
      { data: { values } },
    );

    const attioId = result?.data?.id?.record_id;
    if (!attioId) {
      throw new Error('Attio no devolvió record_id');
    }

    await strapi.db.query('api::colegio.colegio').update({
      where: buildWhereClause(colegio),
      data: {
        attio_company_id: attioId,
        attio_metadata: metadata,
      },
    });
  } catch (error) {
    strapi.log.error(`[attio-sync] Error sincronizando colegio ${colegio.id}: ${(error as Error).message}`);
  }
}

