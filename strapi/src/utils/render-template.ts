interface RenderOptions {
  fallback?: string;
}

const resolvePath = (source: unknown, path: string): unknown => {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) {
      const index = Number(key);
      return Number.isNaN(index) ? undefined : acc[index];
    }
    if (typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
};

export const renderTemplate = (
  template: string | null | undefined,
  data: Record<string, unknown> = {},
  options: RenderOptions = {}
): string => {
  if (!template) return '';
  return template.replace(/{{\s*([^}\s]+)\s*}}/g, (match, token) => {
    const value = resolvePath(data, token.trim());
    if (value === undefined || value === null) {
      return options.fallback ?? '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
};

export default renderTemplate;
