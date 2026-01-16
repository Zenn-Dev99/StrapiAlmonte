'use strict';

const path = require('path');

async function ensureAsignatura(app, nombre, cod, area = 'General'){
  const found = await app.entityService.findMany('api::asignatura.asignatura', { filters: { cod_subsector: cod }, limit: 1, fields: ['id'] });
  if (found.length) return found[0];
  return app.entityService.create('api::asignatura.asignatura', {
    data: { nombre, cod_subsector: cod, area_subsector: area, area_general: area, slug: nombre, publishedAt: new Date() },
  });
}

async function ensurePersona(app, rut, nombres, primer_apellido){
  const p = await app.entityService.findMany('api::persona.persona', { filters: { rut }, limit: 1, fields: ['id'] });
  if (p.length) return p[0];
  return app.entityService.create('api::persona.persona', { data: { rut, nombres, primer_apellido, publishedAt: new Date() } });
}

async function ensureColegio(app, rbd, nombre){
  const c = await app.entityService.findMany('api::colegio.colegio', { filters: { rbd }, limit: 1, fields: ['id','colegio_nombre'] });
  if (c.length) return c[0];
  return app.entityService.create('api::colegio.colegio', { data: { rbd, rbd_digito_verificador: 'K', colegio_nombre: nombre, publishedAt: new Date() } });
}

async function getNivelesBase(app){
  const all = await app.entityService.findMany('api::nivel.nivel', { sort: { orden: 'asc' }, fields: ['id','nombre','orden'], limit: 200 });
  // Toma los primeros 3 niveles para el demo
  return all.slice(0, 3);
}

async function ensureCurso(app, colegioId, nivelId, anio, letra, matricula){
  const found = await app.entityService.findMany('api::curso.curso', { filters: { anio, letra, colegio: { id: { $eq: colegioId } }, nivel_ref: { id: { $eq: nivelId } } }, limit: 1, fields: ['id'] });
  if (found.length) return found[0];
  return app.entityService.create('api::curso.curso', {
    data: { anio, letra, matricula, colegio: { connect: [colegioId] }, nivel_ref: { connect: [nivelId] }, publishedAt: new Date() },
  });
}

async function ensureCursoAsignatura(app, cursoId, asignaturaId, anio, grupo, matricula){
  const found = await app.entityService.findMany('api::curso-asignatura.curso-asignatura', { filters: { curso: { id: { $eq: cursoId } }, asignatura: { id: { $eq: asignaturaId } }, anio, grupo }, limit: 1, fields: ['id'] });
  if (found.length) return found[0];
  return app.entityService.create('api::curso-asignatura.curso-asignatura', { data: { curso: { connect: [cursoId] }, asignatura: { connect: [asignaturaId] }, anio, grupo, matricula, publishedAt: new Date() } });
}

async function ensureTrayectoria(app, personaId, colegioId, cursoId, asigId, anio, isCurrent){
  const t = await app.entityService.findMany('api::persona-trayectoria.persona-trayectoria', { filters: { persona: { id: { $eq: personaId } }, colegio: { id: { $eq: colegioId } }, curso: { id: { $eq: cursoId } }, asignatura: { id: { $eq: asigId } }, anio }, limit: 1, fields: ['id'] });
  if (t.length) return t[0];
  return app.entityService.create('api::persona-trayectoria.persona-trayectoria', { data: { persona: { connect: [personaId] }, colegio: { connect: [colegioId] }, curso: { connect: [cursoId] }, asignatura: { connect: [asigId] }, anio, cargo: 'Docente', is_current: !!isCurrent, publishedAt: new Date() } });
}

async function main(){
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi({ distDir: path.join(process.cwd(), 'dist') });
  const app = await createStrapi(appContext).load();
  try {
    // Catálogos
    const mat = await ensureAsignatura(app, 'Matemática', 101);
    const len = await ensureAsignatura(app, 'Lenguaje', 102);
    const his = await ensureAsignatura(app, 'Historia', 103);

    const juan = await ensurePersona(app, '11111111K', 'Juan', 'Pérez');
    const ana  = await ensurePersona(app, '22222222K', 'Ana', 'Díaz');
    const maria= await ensurePersona(app, '33333333K', 'María', 'López');

    const col1 = await ensureColegio(app, 999990, 'Colegio Ejemplo Moraleja');
    const col2 = await ensureColegio(app, 999991, 'Colegio Demostración');
    const niveles = await getNivelesBase(app);

    const years = [2024, 2025];
    const letras = ['A','B','C'];
    for (const col of [col1, col2]){
      for (const year of years){
        for (const n of niveles){
          for (const letra of letras){
            const cur = await ensureCurso(app, col.id, n.id, year, letra, 30 + (n.orden || 0));
            // Curso-Asignaturas
            await ensureCursoAsignatura(app, cur.id, mat.id, year, null, cur.matricula);
            await ensureCursoAsignatura(app, cur.id, len.id, year, null, cur.matricula);
          }
        }
      }
    }

    // Trayectorias (evolución)
    // Juan enseña Matemática en 1er nivel A en 2024 y sube al siguiente nivel en 2025
    const n1 = niveles[0];
    const n2 = niveles[1] || n1;
    const curso24 = (await app.entityService.findMany('api::curso.curso', { filters: { colegio: { id: { $eq: col1.id } }, anio: 2024, letra: 'A', nivel_ref: { id: { $eq: n1.id } } }, limit: 1, fields: ['id'] }))[0];
    const curso25 = (await app.entityService.findMany('api::curso.curso', { filters: { colegio: { id: { $eq: col1.id } }, anio: 2025, letra: 'A', nivel_ref: { id: { $eq: n2.id } } }, limit: 1, fields: ['id'] }))[0];
    await ensureTrayectoria(app, juan.id, col1.id, curso24.id, mat.id, 2024, false);
    await ensureTrayectoria(app, juan.id, col1.id, curso25.id, mat.id, 2025, true);

    // Ana enseña Lenguaje en ambos años, sección B
    const curso24b = (await app.entityService.findMany('api::curso.curso', { filters: { colegio: { id: { $eq: col1.id } }, anio: 2024, letra: 'B', nivel_ref: { id: { $eq: n1.id } } }, limit: 1, fields: ['id'] }))[0];
    const curso25b = (await app.entityService.findMany('api::curso.curso', { filters: { colegio: { id: { $eq: col1.id } }, anio: 2025, letra: 'B', nivel_ref: { id: { $eq: n2.id } } }, limit: 1, fields: ['id'] }))[0];
    await ensureTrayectoria(app, ana.id, col1.id, curso24b.id, len.id, 2024, false);
    await ensureTrayectoria(app, ana.id, col1.id, curso25b.id, len.id, 2025, true);

    // María enseña Historia en el segundo colegio 2025
    const cur2 = (await app.entityService.findMany('api::curso.curso', { filters: { colegio: { id: { $eq: col2.id } }, anio: 2025, letra: 'A' }, limit: 1, fields: ['id'] }))[0];
    await ensureTrayectoria(app, maria.id, col2.id, cur2.id, his.id, 2025, true);

    console.log('Demo académico cargado. Revisa Colegios, Cursos, Curso Asignaturas y Persona Trayectorias.');
  } finally {
    await app.destroy();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
