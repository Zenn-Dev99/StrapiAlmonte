// Create a demo school with one course per nivel
import path from 'node:path';
import { createStrapi } from '@strapi/strapi';

const YEAR = Number(process.env.ANIO || new Date().getFullYear());
const RBD = Number(process.env.RBD || 999990);
const NOMBRE = process.env.NOMBRE || 'Colegio Ejemplo Moraleja';
const LETRA = process.env.LETRA || 'A';
const MATRICULA = Number(process.env.MATRICULA || 30);

async function main() {
  const projectDir = process.cwd();
  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();
  try {
    // 1) Ensure colegio
    const existing = await strapi.entityService.findMany('api::colegio.colegio', {
      filters: { rbd: RBD },
      limit: 1,
      fields: ['id', 'colegio_nombre', 'rbd'],
    });
    let colegioId;
    if (existing.length) {
      colegioId = existing[0].id;
      console.log(`Colegio ya existe: ${existing[0].colegio_nombre} (rbd=${RBD})`);
    } else {
      const created = await strapi.entityService.create('api::colegio.colegio', {
        data: {
          rbd: RBD,
          rbd_digito_verificador: 'K',
          colegio_nombre: NOMBRE,
          publishedAt: new Date().toISOString(),
        },
      });
      colegioId = created.id;
      console.log(`Colegio creado: ${NOMBRE} (rbd=${RBD})`);
    }

    // 2) Load all niveles
    const niveles = await strapi.entityService.findMany('api::nivel.nivel', {
      sort: { orden: 'asc' },
      fields: ['id', 'nombre', 'clave', 'orden'],
      limit: 200,
    });
    console.log(`Niveles encontrados: ${niveles.length}`);

    // 3) Ensure one Curso per nivel for YEAR
    let createdCursos = 0, skipped = 0;
    for (const nivel of niveles) {
      const found = await strapi.entityService.findMany('api::curso.curso', {
        filters: {
          anio: YEAR,
          letra: LETRA,
          colegio: { id: { $eq: colegioId } },
          nivel_ref: { id: { $eq: nivel.id } },
        },
        limit: 1,
        fields: ['id'],
      });
      if (found.length) { skipped++; continue; }
      await strapi.entityService.create('api::curso.curso', {
        data: {
          anio: YEAR,
          letra: LETRA,
          matricula: MATRICULA,
          colegio: { connect: [colegioId] },
          nivel_ref: { connect: [nivel.id] },
          publishedAt: new Date().toISOString(),
        },
      });
      createdCursos++;
    }
    console.log(`Cursos creados: ${createdCursos}, existentes omitidos: ${skipped}`);

    console.log('Listo. Ve en Admin -> Cursos y filtra por el colegio demo.');
  } finally {
    await strapi.destroy();
  }
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});

