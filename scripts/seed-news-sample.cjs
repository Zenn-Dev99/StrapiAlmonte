const path = require('node:path');
const { createStrapi } = require('@strapi/strapi');

const slugify = (value = '') =>
  value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const nowISO = () => new Date().toISOString();

const CATEGORIES = [
  {
    name: 'Comunicados oficiales',
    slug: 'comunicados-oficiales',
    description: 'Anuncios institucionales y comunicados de prensa.',
    color: '#003366'
  },
  {
    name: 'Innovación educativa',
    slug: 'innovacion-educativa',
    description: 'Tendencias EdTech y metodologías activas.',
    color: '#4A90E2'
  },
  {
    name: 'Comunidad Moraleja',
    slug: 'comunidad-moraleja',
    description: 'Historias, testimonios y vida escolar.',
    color: '#F5A623'
  },
  {
    name: 'Recursos para docentes',
    slug: 'recursos-para-docentes',
    description: 'Ideas, guías y materiales prácticos para equipos docentes.',
    color: '#7B61FF'
  }
];

const TAGS = [
  { name: 'Lanzamientos', slug: 'lanzamientos' },
  { name: 'Eventos', slug: 'eventos' },
  { name: 'Docentes', slug: 'docentes' },
  { name: 'Transformación Digital', slug: 'transformacion-digital' },
  { name: 'Gestión Escolar', slug: 'gestion-escolar' },
  { name: 'PAES', slug: 'paes' },
  { name: 'Comunidad', slug: 'comunidad' },
  { name: 'Tecnología', slug: 'tecnologia' }
];

const AUTHORS = [
  {
    name: 'Paula Arancibia',
    position: 'Editora de Contenidos',
    team: 'Marketing',
    bio: 'Periodista especializada en educación y divulgación pedagógica.',
    email: 'paula.arancibia@moraleja.cl',
    social_links: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/paulaarancibia/' }
    ]
  },
  {
    name: 'Rodrigo Sáenz',
    position: 'Director Académico',
    team: 'Currículum',
    bio: 'Profesor y magíster en innovación educativa. Lidera el desarrollo curricular de Moraleja.',
    email: 'rodrigo.saenz@moraleja.cl',
    social_links: [
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/rodrigosaenz/' },
      { platform: 'twitter', url: 'https://twitter.com/rodrigo_innova' }
    ]
  },
  {
    name: 'Isidora Rojas',
    position: 'Coordinadora de Comunidad',
    team: 'Relaciones con Colegios',
    bio: 'Gestora de alianzas y responsable del programa Comunidad Moraleja.',
    email: 'isidora.rojas@moraleja.cl',
    social_links: [
      { platform: 'instagram', url: 'https://instagram.com/moraleja.cl' }
    ]
  }
];

const ARTICLES = [
  {
    title: 'Moraleja presenta su nueva plataforma de lecturas interactivas',
    excerpt: 'El equipo de producto estrenó un ecosistema de lecturas guiadas que combina narrativa, evaluación y analítica en tiempo real.',
    body: `<p>Moraleja lanzó oficialmente su plataforma de lecturas interactivas, diseñada para acompañar a docentes y estudiantes en todos los niveles. El nuevo entorno integra evaluaciones formativas, analítica de progreso y sugerencias pedagógicas personalizadas.</p><p>“Queríamos un espacio donde las lecturas convoquen a los estudiantes con experiencias multimedia, pero manteniendo el foco en los objetivos curriculares”, explicó Paula Arancibia, editora de contenidos.</p><p>La plataforma se encuentra disponible para los colegios que utilizan el ecosistema Moraleja y se irá habilitando gradualmente durante el primer semestre.</p>`,
    category: 'innovacion-educativa',
    tags: ['lanzamientos', 'transformacion-digital', 'tecnologia'],
    author: 'paula-arancibia',
    read_time: 4,
    is_featured: true,
    pin_until: '2025-12-31T12:00:00.000Z',
    canonical_url: 'https://moraleja.cl/noticias/plataforma-lecturas-interactivas',
    seo: {
      metaTitle: 'Nueva plataforma de lecturas interactivas Moraleja',
      metaDescription: 'Conoce la plataforma de lecturas interactivas que potencia la comprensión lectora con recursos multimedia y analítica en tiempo real.',
      metaRobots: 'index_follow'
    },
    cta: {
      label: 'Conoce la plataforma',
      subtitle: 'Solicita una demo personalizada para tu colegio.',
      button_text: 'Agendar demostración',
      button_url: 'https://moraleja.cl/contacto',
      style: 'primary'
    },
    related: []
  },
  {
    title: 'Aprendizaje basado en proyectos: experiencias desde la comunidad Moraleja',
    excerpt: 'Docentes de tres colegios comparten cómo implementan el ABP con recursos Moraleja y qué resultados observan en el aula.',
    body: `<p>La comunidad Moraleja se reunió para intercambiar experiencias de aprendizaje basado en proyectos (ABP). Los docentes destacaron la importancia de planificar con objetivos claros, abrir espacios de co-creación y evaluar procesos, no solo productos.</p><p>“El ABP nos permitió integrar asignaturas y trabajar competencias transversales. Los recursos Moraleja nos entregan pautas y rúbricas listas para adaptar”, comentaron desde Colegio Horizonte.</p><p>En el sitio de Comunidad Moraleja encontrarás kits descargables, plantillas y foros de discusión para continuar la conversación.</p>`,
    category: 'comunidad-moraleja',
    tags: ['comunidad', 'docentes'],
    author: 'isidora-rojas',
    read_time: 5,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/aprendizaje-basado-en-proyectos',
    seo: {
      metaTitle: 'Experiencias ABP desde la comunidad Moraleja',
      metaDescription: 'Docentes de la red Moraleja relatan cómo aplican el aprendizaje basado en proyectos con apoyo de recursos colaborativos.'
    },
    related: []
  },
  {
    title: 'Moraleja Labs abre convocatoria a pilotos con realidad aumentada',
    excerpt: 'El laboratorio de innovación invita a colegios socios a probar actividades de realidad aumentada en ciencias y lenguaje.',
    body: `<p>Moraleja Labs anunció una convocatoria para colegios que deseen pilotear actividades con realidad aumentada durante 2026. El programa incluye capacitación docente, dispositivos y acompañamiento pedagógico.</p><p>“Buscamos que cada actividad tenga un propósito claro en el currículo. La tecnología es un medio para reforzar conceptos complejos”, señaló Rodrigo Sáenz, director académico.</p><p>Los colegios interesados pueden postular hasta el 30 de noviembre.</p>`,
    category: 'innovacion-educativa',
    tags: ['tecnologia', 'transformacion-digital'],
    author: 'rodrigo-saenz',
    read_time: 3,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/convocatoria-moraleja-labs-ar',
    seo: {
      metaTitle: 'Convocatoria Moraleja Labs: pilotos con realidad aumentada',
      metaDescription: 'Conoce cómo participar en el piloto de realidad aumentada de Moraleja Labs y potenciar la experiencia de aprendizaje.'
    },
    cta: {
      label: 'Postula a Moraleja Labs',
      subtitle: 'Completa el formulario y agenda una reunión informativa.',
      button_text: 'Postular',
      button_url: 'https://moraleja.cl/labs',
      style: 'outline'
    },
    related: []
  },
  {
    title: 'Guía práctica para planificar el plan lector 2026',
    excerpt: 'Compartimos una checklist descargable con los hitos clave para diseñar un plan lector motivador y alineado a los objetivos ministeriales.',
    body: `<p>El equipo editorial preparó una guía para apoyar a coordinadores académicos en la planificación del plan lector 2026. El documento incluye un calendario de hitos, criterios para seleccionar lecturas y propuestas de evaluación formativa.</p><p>El recurso está disponible de manera gratuita para todos los colegios registrados en Moraleja Comunidad.</p>`,
    category: 'recursos-para-docentes',
    tags: ['docentes', 'paes'],
    author: 'paula-arancibia',
    read_time: 6,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/guia-plan-lector-2026',
    seo: {
      metaTitle: 'Checklist para planificar el plan lector 2026',
      metaDescription: 'Descarga la guía de Moraleja con pasos, plantillas y sugerencias para construir tu plan lector.'
    },
    cta: {
      label: 'Descargar guía',
      subtitle: 'Accede al recurso gratuito y compártelo con tu equipo docente.',
      button_text: 'Descargar PDF',
      button_url: 'https://moraleja.cl/recursos/plan-lector-2026.pdf',
      style: 'secondary'
    },
    related: []
  },
  {
    title: 'Encuentro Comunidad Moraleja reúne a 120 directivos escolares',
    excerpt: 'Paneles de gestión escolar, talleres prácticos y networking marcaron la jornada anual organizada por Moraleja.',
    body: `<p>En la versión 2025 del Encuentro Comunidad Moraleja participaron más de 120 directivos escolares de todo el país. El evento incluyó paneles sobre liderazgo pedagógico, talleres de planificación y una feria de soluciones innovadoras.</p><p>Las presentaciones y materiales se encuentran disponibles para los asistentes en el portal de Comunidad.</p>`,
    category: 'comunidad-moraleja',
    tags: ['eventos', 'gestion-escolar', 'comunidad'],
    author: 'isidora-rojas',
    read_time: 4,
    is_featured: true,
    pin_until: '2025-11-15T10:00:00.000Z',
    canonical_url: 'https://moraleja.cl/noticias/encuentro-comunidad-moraleja',
    seo: {
      metaTitle: 'Resumen del Encuentro Comunidad Moraleja 2025',
      metaDescription: 'Revisa los principales aprendizajes y recursos compartidos en el Encuentro Comunidad Moraleja.'
    },
    related: []
  },
  {
    title: 'Plan lector colaborativo: tres colegios comparten su metodología',
    excerpt: 'Equipos docentes explican cómo construyen clubes de lectura y retos de escritura compartidos.',
    body: `<p>Moraleja visitó tres colegios que llevan más de un año trabajando con plan lector colaborativo. La clave, explican, es calendarizar encuentros de lectura y sumar desafíos creativos usando las plantillas del ecosistema.</p><p>Descarga la guía metodológica con ejemplos de rúbricas y formatos de trabajo colaborativo.</p>`,
    category: 'comunidad-moraleja',
    tags: ['docentes', 'comunidad'],
    author: 'paula-arancibia',
    read_time: 5,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/plan-lector-colaborativo',
    seo: {
      metaTitle: 'Plan lector colaborativo: experiencias reales',
      metaDescription: 'Conoce cómo distintos colegios implementan clubes de lectura y retos creativos con apoyo Moraleja.'
    },
    related: []
  },
  {
    title: 'Analytics para docentes: cómo interpretar los tableros Moraleja',
    excerpt: 'Te mostramos funcionalidades poco conocidas del módulo de analítica y cómo transformar datos en decisiones pedagógicas.',
    body: `<p>El módulo de analítica de Moraleja permite visualizar el progreso por curso, comparar avances entre unidades y detectar estudiantes que necesitan apoyo.</p><p>En este artículo revisamos ejemplos concretos y descargables para facilitar la toma de decisiones en reunión de ciclo.</p>`,
    category: 'recursos-para-docentes',
    tags: ['transformacion-digital', 'gestion-escolar'],
    author: 'rodrigo-saenz',
    read_time: 6,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/analytics-para-docentes',
    seo: {
      metaTitle: 'Analytics Moraleja: guía rápida para docentes',
      metaDescription: 'Aprende a interpretar los tableros de analítica y genera estrategias de acompañamiento con evidencia.'
    },
    related: []
  },
  {
    title: 'PAES 2026: recomendaciones de lectura crítica desde Moraleja',
    excerpt: 'El equipo curricular compartió prácticas destacadas para fortalecer la lectura crítica rumbo a la PAES 2026.',
    body: `<p>Tras analizar los resultados recientes, el equipo curricular recomienda integrar lecturas diversas y trabajar habilidades metacognitivas con preguntas guiadas.</p><p>Descarga la planificación modelo y los recursos propuestos para tercero y cuarto medio.</p>`,
    category: 'recursos-para-docentes',
    tags: ['paes', 'docentes'],
    author: 'rodrigo-saenz',
    read_time: 5,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/paes-2026-recomendaciones-lectura',
    seo: {
      metaTitle: 'PAES 2026: estrategias de lectura crítica',
      metaDescription: 'Planificaciones y recursos sugeridos por Moraleja para preparar la PAES 2026 en comprensión lectora.'
    },
    related: []
  },
  {
    title: 'Moraleja renueva su programa de acompañamiento a directivos',
    excerpt: 'Se suman sesiones de mentoring personalizado y métricas accionables para equipos directivos.',
    body: `<p>El programa de acompañamiento a directivos de Moraleja incorporará mentoring individual, sesiones grupales y seguimiento de indicadores clave.</p><p>Las inscripciones están abiertas para los colegios que trabajan con el ecosistema editorial 2026.</p>`,
    category: 'comunicados-oficiales',
    tags: ['gestion-escolar', 'eventos'],
    author: 'rodrigo-saenz',
    read_time: 3,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/programa-acompanamiento-directivos',
    seo: {
      metaTitle: 'Nuevo programa de acompañamiento a directivos Moraleja',
      metaDescription: 'Descubre el renovado programa de mentoring y seguimiento para equipos directivos escolares.'
    },
    related: []
  },
  {
    title: 'Historias de aula: estudiantes crean podcasts literarios',
    excerpt: 'El Colegio Andino implementó un proyecto de podcast en su plan lector y los resultados sorprendieron a toda la comunidad.',
    body: `<p>Como parte del plan lector colaborativo, estudiantes de sexto básico produjeron un podcast literario con entrevistas a personajes y análisis de capítulos clave.</p><p>La iniciativa fomentó la comprensión profunda de las obras y desarrolló habilidades comunicativas.</p>`,
    category: 'comunidad-moraleja',
    tags: ['comunidad', 'docentes'],
    author: 'isidora-rojas',
    read_time: 4,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/historias-de-aula-podcast-literario',
    seo: {
      metaTitle: 'Cómo crear un podcast literario en tu plan lector',
      metaDescription: 'Conoce la experiencia del Colegio Andino y descarga la guía paso a paso para replicarla.'
    },
    related: ['plan-lector-colaborativo']
  },
  {
    title: 'Calendario anual de actividades Moraleja 2026',
    excerpt: 'Publicamos el calendario completo de hitos, webinars y lanzamientos del próximo año escolar.',
    body: `<p>Ya está disponible el calendario Moraleja 2026 con webinars, lanzamientos editoriales y fechas claves para coordinadores académicos.</p><p>Revisa el documento y agenda tus actividades con anticipación.</p>`,
    category: 'comunicados-oficiales',
    tags: ['eventos', 'gestion-escolar'],
    author: 'paula-arancibia',
    read_time: 2,
    is_featured: false,
    pin_until: null,
    canonical_url: 'https://moraleja.cl/noticias/calendario-actividades-moraleja-2026',
    seo: {
      metaTitle: 'Calendario de actividades Moraleja 2026',
      metaDescription: 'Descarga el calendario completo con hitos, webinars y lanzamientos de Moraleja para 2026.'
    },
    cta: {
      label: 'Descargar calendario',
      subtitle: 'Obtén el PDF con todas las fechas relevantes para tu planificación.',
      button_text: 'Descargar',
      button_url: 'https://moraleja.cl/recursos/calendario-moraleja-2026.pdf',
      style: 'primary'
    },
    related: []
  }
];

async function main() {
  const projectDir = process.cwd();
  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    const ensureCategory = async (data) => {
      const slug = data.slug || slugify(data.name);
      const existing = await strapi.db
        .query('api::news-category.news-category')
        .findOne({ where: { slug }, select: ['id'] });

      const payload = {
        name: data.name,
        slug,
        description: data.description,
        color: data.color,
        is_public: data.is_public ?? true
      };

      if (existing) {
        await strapi.entityService.update('api::news-category.news-category', existing.id, {
          data: payload,
        });
        return existing.id;
      }

      const created = await strapi.entityService.create('api::news-category.news-category', {
        data: payload,
      });
      return created.id;
    };

    const ensureTag = async (data) => {
      const slug = data.slug || slugify(data.name);
      const existing = await strapi.db
        .query('api::news-tag.news-tag')
        .findOne({ where: { slug }, select: ['id'] });

      const payload = {
        name: data.name,
        slug,
        description: data.description,
      };

      if (existing) {
        await strapi.entityService.update('api::news-tag.news-tag', existing.id, {
          data: payload,
        });
        return existing.id;
      }

      const created = await strapi.entityService.create('api::news-tag.news-tag', {
        data: payload,
      });
      return created.id;
    };

    const ensureAuthor = async (data) => {
      const slug = data.slug || slugify(data.name);
      const existing = await strapi.db
        .query('api::news-author.news-author')
        .findOne({ where: { slug }, select: ['id'] });

      const payload = {
        name: data.name,
        slug,
        bio: data.bio,
        position: data.position,
        team: data.team,
        email: data.email,
        social_links: data.social_links || [],
        is_active: data.is_active ?? true,
      };

      if (existing) {
        await strapi.entityService.update('api::news-author.news-author', existing.id, {
          data: payload,
        });
        return existing.id;
      }

      const created = await strapi.entityService.create('api::news-author.news-author', {
        data: payload,
      });
      return created.id;
    };

    const categoryMap = new Map();
    for (const category of CATEGORIES) {
      const id = await ensureCategory(category);
      categoryMap.set(category.slug, id);
    }

    const tagMap = new Map();
    for (const tag of TAGS) {
      const id = await ensureTag(tag);
      tagMap.set(tag.slug, id);
    }

    const authorMap = new Map();
    for (const author of AUTHORS) {
      const slug = author.slug || slugify(author.name);
      const id = await ensureAuthor({ ...author, slug });
      authorMap.set(slug, id);
    }

    const articleRecords = [];
    const articleIdBySlug = new Map();

    for (const article of ARTICLES) {
      const slug = slugify(article.title);
      const categoryId = categoryMap.get(article.category);
      if (!categoryId) {
        throw new Error(`Categoría no encontrada para artículo: ${article.title}`);
      }

      const tagIds = (article.tags || [])
        .map((tagSlug) => tagMap.get(tagSlug))
        .filter(Boolean);

      const authorSlug = article.author || '';
      const authorId = authorMap.get(authorSlug);
      if (!authorId) {
        throw new Error(`Autor no encontrado para artículo: ${article.title}`);
      }

      const payload = {
        locale: 'en',
        title: article.title,
        slug,
        excerpt: article.excerpt,
        body: article.body,
        read_time: article.read_time,
        is_featured: article.is_featured ?? false,
        pin_until: article.pin_until,
        canonical_url: article.canonical_url,
        newsletter_sent: article.newsletter_sent ?? false,
        seo: article.seo || null,
        cta: article.cta || null,
        category: { connect: [categoryId] },
        author: { connect: [authorId] },
        tags: tagIds.length ? { connect: tagIds } : undefined,
      };

      const existing = await strapi.db
        .query('api::news-article.news-article')
        .findOne({ where: { slug }, select: ['id'] });

      if (existing) {
        const updateData = { ...payload };
        updateData.tags = { set: tagIds };

        await strapi.entityService.update('api::news-article.news-article', existing.id, {
          data: updateData,
        });
        articleRecords.push({ id: existing.id, slug, related: article.related || [] });
        articleIdBySlug.set(slug, existing.id);
      } else {
        const created = await strapi.entityService.create('api::news-article.news-article', {
          data: payload,
        });
        articleRecords.push({ id: created.id, slug: created.slug || slug, related: article.related || [] });
        articleIdBySlug.set(created.slug || slug, created.id);
      }
    }

    for (const record of articleRecords) {
      const relatedIds = (record.related || [])
        .map((relatedSlug) => articleIdBySlug.get(slugify(relatedSlug)))
        .filter(Boolean);

      if (!relatedIds.length) continue;

      await strapi.entityService.update('api::news-article.news-article', record.id, {
        data: {
          related_articles: { set: relatedIds },
        },
      });
    }

    console.log(`✅ Noticias listas. Categorías: ${categoryMap.size}, Tags: ${tagMap.size}, Autores: ${authorMap.size}, Artículos procesados: ${articleRecords.length}.`);
  } finally {
    try {
      await strapi.destroy();
    } catch (error) {
      const message = error && error.message ? String(error.message) : '';
      if (!message.includes('aborted')) {
        throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error('❌ Error al cargar noticias de ejemplo:', error);
  if (error && error.details) {
    console.error('Detalles:', JSON.stringify(error.details, null, 2));
  }
  process.exit(1);
});
