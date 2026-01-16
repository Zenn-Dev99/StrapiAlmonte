'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
let fetch = globalThis.fetch;
if (!fetch) {
  const nodeFetch = require('node-fetch');
  fetch = nodeFetch.default || nodeFetch;
}

async function bootstrap() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi({ distDir: path.join(process.cwd(), 'dist') });
  const app = await createStrapi(appContext).load();
  return app;
}

async function downloadImage(seed, width = 1200, height = 800) {
  const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar la imagen ${url} (${res.status})`);
  }
  let buffer;
  if (typeof res.buffer === 'function') {
    buffer = await res.buffer();
  } else {
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType, url };
}

async function uploadDemoImage(app, seed, altText) {
  const fileBaseName = `${seed}.jpg`;
  const tmpFile = path.join(os.tmpdir(), `${seed}-${Date.now()}.jpg`);

  const { buffer, contentType } = await downloadImage(seed);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const uploadService = app.plugin('upload').service('upload');
    const [uploaded] = await uploadService.upload({
      data: {
        fileInfo: {
          name: fileBaseName,
          alternativeText: altText,
          caption: altText,
        },
      },
      files: {
        filepath: tmpFile,
        name: fileBaseName,
        type: contentType,
        size: buffer.length,
      },
    });
    return uploaded;
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

async function ensureDocument(app, uid, filters, data) {
  const existing = await app.entityService.findMany(uid, {
    filters,
    fields: ['id', 'documentId'],
    limit: 1,
  });
  if (existing.length) {
    return { ...existing[0], created: false };
  }
  const created = await app.entityService.create(uid, { data });
  return { ...created, created: true };
}

async function seedTaxonomies(app) {
  const results = { tags: [], categories: [] };

  const tagSpecs = [
    {
      name: 'Catálogos 2026',
      slug: 'catalogos-2026',
      description: 'Material promocional y recursos descargables de la campaña 2026.',
    },
    {
      name: 'Testimonios Colegios',
      slug: 'testimonios-colegios',
      description: 'Historias y entrevistas con comunidades educativas.',
    },
    {
      name: 'Lanzamientos Digitales',
      slug: 'lanzamientos-digitales',
      description: 'Activos pensados para campañas digitales y RRSS.',
    },
  ];

  for (const spec of tagSpecs) {
    const tag = await ensureDocument(app, 'api::media-tag.media-tag', { slug: { $eq: spec.slug } }, spec);
    results.tags.push(tag);
  }

  const categorySpecs = [
    {
      name: 'Campañas Corporativas',
      slug: 'campanas-corporativas',
      description: 'Activos transversales usados en marcos corporativos.',
    },
    {
      name: 'Eventos Presenciales',
      slug: 'eventos-presenciales',
      description: 'Cobertura fotográfica y recursos para ferias o encuentros presenciales.',
    },
    {
      name: 'Recursos Descargables',
      slug: 'recursos-descargables',
      description: 'Plantillas, guías y piezas diseñadas para descargar y compartir.',
    },
  ];

  for (const spec of categorySpecs) {
    const category = await ensureDocument(app, 'api::media-category.media-category', { slug: { $eq: spec.slug } }, spec);
    results.categories.push(category);
  }

  return results;
}

async function seedMediaAssets(app, tags, categories) {
  const createdAssets = [];
  const imageSeeds = [
    { seed: 'hero-intranet', title: 'Hero Intranet Moraleja', slug: 'hero-intranet-moraleja' },
    { seed: 'colegios-alianza', title: 'Colegio en jornada Moraleja', slug: 'colegio-jornada-moraleja' },
    { seed: 'campana-digital', title: 'Campaña digital retorno a clases', slug: 'campana-digital-retorno' },
  ];

  for (let i = 0; i < imageSeeds.length; i += 1) {
    const spec = imageSeeds[i];
    const upload = await uploadDemoImage(app, spec.seed, spec.title);

    const assetData = {
      title: spec.title,
      slug: spec.slug,
      description:
        'Contenido demo cargado automáticamente para pruebas de la biblioteca multimedia. Reemplaza esta descripción con información real antes de publicar.',
      file: upload.id,
      thumbnail: upload.id,
      status: 'active',
      tags: { connect: tags.map((t) => t.id) },
      categories: { connect: categories.map((c) => c.id) },
      usageNotes: 'Disponible para campañas internas y piezas de comunicación institucional.',
      source: 'interno',
      metadata: {
        demoSeed: spec.seed,
      },
    };

    if (i === 1) {
      assetData.externalUrl = 'https://intranet.moraleja.cl/campanas/alianza';
    }

    const asset = await ensureDocument(
      app,
      'api::media-asset.media-asset',
      { slug: { $eq: spec.slug } },
      assetData
    );

    createdAssets.push({ ...asset, upload });
  }

  return createdAssets;
}

function buildHeroStats() {
  return [
    { value: '+350', label: 'Colegios conectados a la intranet', order: 1 },
    { value: '95%', label: 'Satisfacción en campañas 2024', order: 2 },
    { value: '48h', label: 'Tiempo promedio de soporte', order: 3 },
  ];
}

async function seedHomeHero(app, heroMedia) {
  const now = new Date();
  const activeFrom = new Date(now.getTime() - 1000 * 60 * 60 * 24);
  const activeUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
  const heroImageId = heroMedia?.upload?.id;

  const data = {
    title: 'Tu biblioteca multimedia para campañas 2026',
    subtitle:
      '<p>Centraliza recursos gráficos, videos y testimonios para reutilizarlos en ferias, newsletters y canales digitales sin depender de archivos sueltos.</p>',
    highlight: 'Catálogo 2026',
    campaign_tag: 'home-hero-catalogo-2026',
    primary_cta: {
      label: 'Explorar biblioteca',
      href: 'https://intranet.moraleja.cl/media',
      is_primary: true,
      aria_label: 'Ir a la biblioteca multimedia',
      external: false,
    },
    secondary_cta: {
      label: 'Ver guía de uso',
      href: 'https://intranet.moraleja.cl/guias/repositorio-multimedia',
      is_primary: false,
      aria_label: 'Abrir guía de configuración del repositorio multimedia',
      external: false,
    },
    stats: buildHeroStats(),
    background_style: heroImageId ? 'image' : 'gradient',
    media: heroImageId ? heroImageId : null,
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    active_from: activeFrom.toISOString(),
    active_until: activeUntil.toISOString(),
    is_default: true,
    seo: {
      metaTitle: 'Hero multimedia | Moraleja Intranet',
      metaDescription: 'Descubre la biblioteca multimedia centralizada para campañas Moraleja 2026.',
      shareImage: heroImageId ? heroImageId : null,
    },
    structured_data: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: 'Repositorio multimedia Moraleja',
      creator: {
        '@type': 'Organization',
        name: 'Moraleja',
      },
      dateCreated: activeFrom.toISOString(),
    },
    publishedAt: now.toISOString(),
  };

  if (!heroImageId) {
    delete data.media;
    if (data.seo) {
      delete data.seo.shareImage;
    }
  }

  const existingRaw = await app.entityService.findMany('api::home-hero.home-hero', {
    fields: ['id'],
    limit: 1,
  });
  const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw ? [existingRaw] : [];

  if (existing.length) {
    await app.entityService.update('api::home-hero.home-hero', existing[0].id, { data });
    return { id: existing[0].id, updated: true };
  }

  const created = await app.entityService.create('api::home-hero.home-hero', { data });
  return { id: created.id, created: true };
}

async function run() {
  const app = await bootstrap();

  try {
    const { tags, categories } = await seedTaxonomies(app);
    const assets = await seedMediaAssets(app, tags, categories);
    const hero = await seedHomeHero(app, assets[0]);

    console.log('✅ Demo multimedia lista:');
    console.table([
      { tipo: 'Tags', cantidad: tags.length },
      { tipo: 'Categorías', cantidad: categories.length },
      { tipo: 'Assets', cantidad: assets.length },
      { tipo: 'Home hero', estado: hero.updated ? 'Actualizado' : 'Creado' },
    ]);
  } catch (err) {
    console.error('❌ Error sembrando demo multimedia', err);
  } finally {
    await app.destroy();
  }
}

run();
