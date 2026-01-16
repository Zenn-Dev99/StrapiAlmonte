import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL?.replace(/\/$/, '') || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('Falta STRAPI_API_TOKEN (token API de Strapi).');
  process.exit(1);
}

/**
 * Lista de content types a exportar.
 * Agrega o modifica las entradas según lo que necesites bajar.
 */
const CONTENT_TYPES = [
  {
    uid: 'api::colegio.colegio',
    apiPath: 'colegios',
    filename: 'colegios.csv',
  },
  {
    uid: 'api::persona.persona',
    apiPath: 'personas',
    filename: 'personas.csv',
  },
  {
    uid: 'api::cartera-asignacion.cartera-asignacion',
    apiPath: 'cartera-asignaciones',
    filename: 'cartera-asignaciones.csv',
  },
  {
    uid: 'api::persona-trayectoria.persona-trayectoria',
    apiPath: 'persona-trayectorias',
    filename: 'colegio-profesores.csv',
  },
  {
    uid: 'api::comuna.comuna',
    apiPath: 'comunas',
    filename: 'ubicacion-comunas.csv',
  },
  {
    uid: 'api::provincia.provincia',
    apiPath: 'provincias',
    filename: 'ubicacion-provincias.csv',
  },
  {
    uid: 'api::region.region',
    apiPath: 'regions',
    filename: 'ubicacion-regiones.csv',
  },
  {
    uid: 'api::zona.zona',
    apiPath: 'zonas',
    filename: 'ubicacion-zonas.csv',
  },
];

const apiPathFromUid = (config) => {
  if (config.apiPath) return config.apiPath;
  const [, rest] = config.uid.split('::');
  return rest.replace(/\./g, '/');
};

const buildQuery = (page, pageSize) => {
  const params = new URLSearchParams();
  params.append('pagination[page]', page);
  params.append('pagination[pageSize]', pageSize);
  params.append('populate', '*');
  params.append('locale', 'all');
  return params.toString();
};

const fetchAllEntries = async (config) => {
  const path = apiPathFromUid(config);
  const pageSize = 200;
  let page = 1;
  let hasMore = true;
  const collected = [];

  while (hasMore) {
    const query = buildQuery(page, pageSize);
    const url = `${STRAPI_URL}/api/${path}?${query}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Error ${response.status} al obtener ${config.uid} (page ${page}): ${errorBody}`
      );
    }

    const json = await response.json();
    const data = json.data || [];
    data.forEach((entry) => {
      collected.push(flattenEntry(entry));
    });

    const pagination = json.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return collected;
};

const flattenEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return {};
  const target = {};
  if ('id' in entry) target.id = entry.id;
  const source =
    entry.attributes && Object.keys(entry.attributes).length
      ? entry.attributes
      : entry;
  Object.entries(source).forEach(([key, value]) => {
    if (key === 'id' || key === 'attributes') return;
    flattenValue(value, target, key);
  });
  return target;
};

const flattenValue = (value, target, prefix = '') => {
  if (value === null || value === undefined) {
    target[prefix] = '';
    return;
  }

  if (!prefix) {
    // debería existir un prefijo para colocar la columna
    throw new Error('flattenValue requiere un prefijo');
  }

  if (Array.isArray(value)) {
    target[prefix] = JSON.stringify(
      value.map((item) => {
        if (item?.id && item?.attributes) {
          const obj = { id: item.id };
          Object.entries(item.attributes).forEach(([k, v]) => {
            flattenValue(v, obj, k);
          });
          return obj;
        }
        return item;
      })
    );
    return;
  }

  if (typeof value === 'object') {
    if ('data' in value) {
      const data = value.data;
      if (Array.isArray(data)) {
        target[prefix] = JSON.stringify(
          data.map((item) => {
            if (item?.attributes) {
              const obj = { id: item.id };
              Object.entries(item.attributes).forEach(([k, v]) => {
                flattenValue(v, obj, k);
              });
              return obj;
            }
            return item;
          })
        );
        return;
      }
      if (data && data.attributes) {
        target[`${prefix}.id`] = data.id ?? '';
        Object.entries(data.attributes).forEach(([k, v]) => {
          flattenValue(v, target, `${prefix}.${k}`);
        });
        return;
      }
      target[prefix] = '';
      return;
    }

    Object.entries(value).forEach(([key, val]) => {
      const path = `${prefix}.${key}`;
      flattenValue(val, target, path);
    });
    return;
  }

  target[prefix] = value;
};

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach((row) => {
    const line = headers.map((header) => escapeCell(row[header] ?? '')).join(',');
    lines.push(line);
  });

  return lines.join('\n');
};

async function main() {
  const exportDir = resolve(process.cwd(), 'exports');
  mkdirSync(exportDir, { recursive: true });

  for (const ct of CONTENT_TYPES) {
    console.log(`→ Exportando ${ct.uid}...`);
    const rows = await fetchAllEntries(ct);
    const csv = toCsv(rows);
    const filepath = resolve(exportDir, ct.filename);
    writeFileSync(filepath, csv);
    console.log(`  ✔ Guardado ${rows.length} registros en ${filepath}`);
  }

  console.log('Exportación completada.');
}

main().catch((error) => {
  console.error('Error en la exportación:', error);
  process.exit(1);
});
