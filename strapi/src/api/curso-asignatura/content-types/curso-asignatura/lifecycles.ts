function makeUniqKey(input: { curso?: any; asignatura?: any; anio?: number | null | undefined; grupo?: string | null | undefined }) {
  const cursoId = getRelId(input.curso);
  const asigId = getRelId(input.asignatura);
  const year = input.anio || null;
  const group = (input.grupo || '').toString().trim().toLowerCase();
  return [cursoId || '', asigId || '', year || '', group].join('::');
}

function getRelId(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    if (typeof val.id === 'string') return val.id;
    const bag = val.connect || val.set;
    if (Array.isArray(bag) && bag.length > 0) {
      const first = bag[0];
      if (typeof first === 'string') return first;
      if (first && typeof first.id === 'string') return first.id;
    }
  }
  return null;
}

export default {
  async beforeCreate(event) {
    const data = event.params.data;
    // Derivar anio desde curso si falta
    if (!data.anio && data.curso) {
      const cursoId = getRelId(data.curso);
      if (cursoId) {
        const curso = await strapi.entityService.findOne('api::curso.curso', cursoId, { fields: ['anio','letra','curso_letra_anio'] } as any);
        if (curso?.anio) data.anio = curso.anio;
        if (curso?.letra && !data.letra) data.letra = curso.letra;
        if (curso?.curso_letra_anio && !data.curso_letra_anio) data.curso_letra_anio = curso.curso_letra_anio;
      }
    }
    data.uniq_key = makeUniqKey(data);
  },
  async beforeUpdate(event) {
    const data = event.params.data;
    if (!data) return;
    // Si cambió curso, refrescar anio cuando falte
    if (data.curso && !('anio' in data)) {
      const cursoId = getRelId(data.curso);
      if (cursoId) {
        const curso = await strapi.entityService.findOne('api::curso.curso', cursoId, { fields: ['anio','letra','curso_letra_anio'] } as any);
        if (curso?.anio) data.anio = curso.anio;
        if (curso?.letra) data.letra = curso.letra;
        if (curso?.curso_letra_anio) data.curso_letra_anio = curso.curso_letra_anio;
      }
    }
    data.uniq_key = makeUniqKey(data);
  },
};
