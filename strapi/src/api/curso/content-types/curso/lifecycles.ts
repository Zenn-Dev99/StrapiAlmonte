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

async function buildTitulo(data: any) {
  let nivelNombre = '';
  const nivelId = getRelId(data?.nivel_ref);
  if (nivelId) {
    const nivel = await strapi.entityService.findOne('api::nivel.nivel', nivelId, {} as any);
    nivelNombre = nivel?.nombre || nivel?.clave || '';
  }
  const letra = (data?.letra || '').toString().trim().toUpperCase();
  const año = data?.año ? Number(data.año) : undefined;
  const parts = [nivelNombre, letra].filter(Boolean).join(' ');
  return año ? `${parts} (${año})` : parts;
}

function buildNombreCurso(data: any): string {
  const grado = data?.grado ? Number(data.grado) : null;
  const nivel = data?.nivel || '';
  const paralelo = (data?.paralelo || '').toString().trim().toUpperCase();
  
  if (!grado || !nivel) {
    return '';
  }
  
  const parts = [`${grado}°`, nivel].filter(Boolean);
  if (paralelo) {
    parts.push(paralelo);
  }
  
  return parts.join(' ');
}

export default {
  async beforeCreate(event) {
    const data = event.params?.data || {};
    
    // Establecer año actual si no se proporciona
    if (!data.año) {
      data.año = new Date().getFullYear();
    }
    
    // Generar nombre_curso automáticamente si hay nivel, grado (y opcional paralelo)
    if ((data?.nivel || data?.grado) && !data.nombre_curso) {
      data.nombre_curso = buildNombreCurso(data);
    }
    
    data.titulo = await buildTitulo(data);
    if (data?.letra && data?.año) data.curso_letra_anio = `${String(data.letra).toUpperCase()}${Number(data.año)}`;
  },
  async beforeUpdate(event) {
    const data = event.params?.data || {};
    
    // Recalcular nombre_curso si cambia nivel, grado o paralelo
    if ('nivel' in data || 'grado' in data || 'paralelo' in data) {
      data.nombre_curso = buildNombreCurso(data);
    }
    
    // Recalcular si cambia nivel_ref, letra o año, o si falta
    if ('nivel_ref' in data || 'letra' in data || 'año' in data || !data.titulo) {
      data.titulo = await buildTitulo(data);
    }
    if ('letra' in data || 'año' in data || !data.curso_letra_anio) {
      const letra = (data?.letra || '').toString().toUpperCase();
      const año = data?.año ? Number(data.año) : undefined;
      if (letra && año) data.curso_letra_anio = `${letra}${año}`;
    }
  },
};
