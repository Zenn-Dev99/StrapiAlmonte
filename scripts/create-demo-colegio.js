'use strict';

const path = require('path');

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi({ distDir: path.join(process.cwd(), 'dist') });
  const app = await createStrapi(appContext).load();

  const YEAR = Number(process.env.ANIO || new Date().getFullYear());
  const RBD = Number(process.env.RBD || 999990);
  const NOMBRE = process.env.NOMBRE || 'Colegio Ejemplo Moraleja';
  const LETRAS = (process.env.LETRAS || 'A,B,C').split(',').map((s)=>s.trim().toUpperCase()).filter(Boolean);
  const MATRICULA = Number(process.env.MATRICULA || 30);

  try {
    // 1) Colegio
    const exist = await app.entityService.findMany('api::colegio.colegio', {
      filters: { rbd: RBD },
      limit: 1,
      fields: ['id', 'colegio_nombre'],
    });
    const colegio = exist[0] || await app.entityService.create('api::colegio.colegio', {
      data: { rbd: RBD, rbd_digito_verificador: 'K', colegio_nombre: NOMBRE, publishedAt: new Date() },
    });

    // 2) Niveles
    const niveles = await app.entityService.findMany('api::nivel.nivel', {
      sort: { orden: 'asc' },
      fields: ['id', 'nombre', 'clave'],
      limit: 200,
    });

    let created = 0, skipped = 0;
    for (const nivel of niveles) {
      for (const letra of LETRAS) {
        const found = await app.entityService.findMany('api::curso.curso', {
          filters: { anio: YEAR, letra, colegio: { id: { $eq: colegio.id } }, nivel_ref: { id: { $eq: nivel.id } } },
          limit: 1,
          fields: ['id'],
        });
        if (found.length) { skipped++; continue; }
        await app.entityService.create('api::curso.curso', {
          data: {
            anio: YEAR,
            letra,
            matricula: MATRICULA,
            colegio: { connect: [colegio.id] },
            nivel_ref: { connect: [nivel.id] },
            publishedAt: new Date(),
          },
        });
        created++;
      }
    }
    console.log(`Colegio: ${colegio.colegio_nombre} (rbd=${RBD})`);
    console.log(`Cursos creados=${created}, existentes=${skipped}`);
    console.log('Abre Admin -> Cursos y filtra por el colegio demo.');
  } finally {
    await app.destroy();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
