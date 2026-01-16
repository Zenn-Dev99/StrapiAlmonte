import { errors } from '@strapi/utils';

const { ForbiddenError } = errors;

const UPLOAD_FILE_UID = 'plugin::upload.file';

type LifecycleEvent = {
  params: {
    data?: Record<string, any>;
    where?: Record<string, unknown>;
  };
  state?: Record<string, any>;
  result?: Record<string, any>;
};

type UploadFile = {
  id: string | number;
  mime?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  ext?: string | null;
  hash?: string | null;
  name?: string | null;
  provider?: string | null;
  url?: string | null;
};

function normalizeId(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = normalizeId(item);
      if (candidate != null) return candidate;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.id && (typeof record.id === 'string' || typeof record.id === 'number')) {
      return record.id;
    }
    if (record.documentId && typeof record.documentId === 'string') {
      return record.documentId;
    }
    if (Array.isArray(record.connect) && record.connect.length > 0) {
      return normalizeId(record.connect[0]);
    }
    if (Array.isArray(record.set) && record.set.length > 0) {
      return normalizeId(record.set[0]);
    }
  }
  return null;
}

function detectAssetType(mime?: string | null): 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime === 'application/pdf' ||
    mime.startsWith('application/vnd') ||
    mime.startsWith('text/')
  ) {
    return 'document';
  }
  return 'other';
}

function computeFileSizeBytes(size?: number | null): number | null {
  if (typeof size !== 'number' || Number.isNaN(size)) {
    return null;
  }
  // Strapi upload stores size in KB. Convert to bytes conservatively.
  const inBytes = Math.round(size * 1024);
  return Number.isFinite(inBytes) ? inBytes : null;
}

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildPublicUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  const configUrl = normalizeBaseUrl(strapi.config.get('server.url'));
  const envUrl =
    normalizeBaseUrl(process.env.MEDIA_BASE_URL) ||
    normalizeBaseUrl(process.env.ASSETS_BASE_URL) ||
    normalizeBaseUrl(process.env.STRAPI_URL) ||
    configUrl;
  if (!envUrl) {
    return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  }
  const base = envUrl.replace(/\/+$/, '');
  const path = rawUrl.replace(/^\/+/, '');
  return `${base}/${path}`;
}

async function loadFileFromData(data: Record<string, any>): Promise<UploadFile | null> {
  const relId = normalizeId(data.file);
  if (!relId) return null;

  try {
    return (await strapi.entityService.findOne(UPLOAD_FILE_UID, relId)) as UploadFile | null;
  } catch (err) {
    strapi.log.error('[media-asset:lifecycle] Error reading upload file', err);
    return null;
  }
}

function maybeAssignUploader(event: LifecycleEvent): string | number | null {
  const stateUser =
    event.state?.user ||
    event.state?.auth?.credentials?.user ||
    event.state?.auth?.credentials ||
    event.state?.auth?.user;
  if (stateUser && (typeof stateUser.id === 'string' || typeof stateUser.id === 'number')) {
    return stateUser.id;
  }
  const contextUser = (event as any).context?.state?.user;
  if (contextUser && (typeof contextUser.id === 'string' || typeof contextUser.id === 'number')) {
    return contextUser.id;
  }
  const resultUser = event.result?.createdBy;
  if (resultUser && (typeof resultUser.id === 'string' || typeof resultUser.id === 'number')) {
    return resultUser.id;
  }
  return null;
}

function setDefaults(data: Record<string, any>, event: LifecycleEvent, mode: 'create' | 'update'): void {
  if (mode === 'create') {
    if (!data.uploadedAt) {
      data.uploadedAt = new Date().toISOString();
    }
    if (!data.status) {
      data.status = 'active';
    }
    if (!data.uploadedBy) {
      const userId = maybeAssignUploader(event);
      if (userId) {
        data.uploadedBy = userId;
      }
    }
    return;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'uploadedAt') && !data.uploadedAt) {
    data.uploadedAt = new Date().toISOString();
  }
  if (Object.prototype.hasOwnProperty.call(data, 'status') && !data.status) {
    data.status = 'active';
  }
  if (Object.prototype.hasOwnProperty.call(data, 'uploadedBy') && !data.uploadedBy) {
    const userId = maybeAssignUploader(event);
    if (userId) {
      data.uploadedBy = userId;
    }
  }
}

async function applyMetadata(event: LifecycleEvent, mode: 'create' | 'update'): Promise<void> {
  const data = event.params?.data;
  if (!data) return;

  setDefaults(data, event, mode);

  if (mode === 'update' && !Object.prototype.hasOwnProperty.call(data, 'file')) {
    return;
  }

  if (!data.file) return;

  const file = await loadFileFromData(data);
  if (!file) return;

  const assetType = detectAssetType(file.mime);
  data.assetType = assetType;
  data.mimeType = file.mime ?? null;

  const size = computeFileSizeBytes(file.size);
  if (size != null) {
    data.fileSizeBytes = size;
  }

  if (typeof file.width === 'number') data.width = file.width;
  if (typeof file.height === 'number') data.height = file.height;

  if (typeof file.duration === 'number' && !Number.isNaN(file.duration)) {
    data.durationSeconds = Math.round(file.duration);
  }

  const publicUrl = buildPublicUrl(file.url);
  if (publicUrl) {
    data.publicUrl = publicUrl;
  }

  const existingMetadata =
    typeof data.metadata === 'object' && data.metadata !== null ? { ...data.metadata } : {};

  data.metadata = {
    ...existingMetadata,
    originalName: file.name ?? null,
    extension: file.ext ?? null,
    hash: file.hash ?? null,
    provider: file.provider ?? null,
    url: file.url ?? null,
  };
}

export default {
  async beforeCreate(event: LifecycleEvent) {
    await applyMetadata(event, 'create');
  },

  async beforeUpdate(event: LifecycleEvent) {
    if (event.params?.data) {
      await applyMetadata(event, 'update');
    }
  },

  async beforeDelete() {
    throw new ForbiddenError('Eliminar assets está deshabilitado; usa el estado "hidden".');
  },
};
