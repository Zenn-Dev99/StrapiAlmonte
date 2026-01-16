import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Convierte documentId a id numérico
 */
async function getNumericId(
  contentType: 'colegio' | 'persona',
  documentId: string
): Promise<number | null> {
  try {
    const response = await fetch(`${STRAPI_URL}/api/${contentType === 'persona' ? 'personas' : 'colegios'}/${documentId}?fields[0]=id`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.data?.id || data.data?.attributes?.id || data.id || null
  } catch (error) {
    console.error(`[getNumericId] Error:`, error)
    return null
  }
}

/**
 * Verifica si es documentId
 */
function isDocumentId(id: string | number): boolean {
  if (typeof id === 'number') return false
  return !/^\d+$/.test(String(id))
}

/**
 * Obtiene el ID numérico (convertiendo si es necesario)
 */
async function resolveNumericId(
  contentType: 'colegio' | 'persona',
  id: string | number
): Promise<number | null> {
  if (typeof id === 'number') {
    return id
  }

  if (isDocumentId(id)) {
    return await getNumericId(contentType, id)
  }

  const numericId = parseInt(id, 10)
  return isNaN(numericId) ? null : numericId
}

/**
 * GET /api/crm/colegios/[id]/contactos
 * Obtiene todas las personas que tienen trayectorias asociadas a un colegio específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const colegioId = params.id

    // Convertir documentId a id numérico si es necesario
    const colegioIdNum = await resolveNumericId('colegio', colegioId)
    
    if (!colegioIdNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de colegio inválido',
          data: [],
        },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('pageSize') || '50'
    const onlyCurrent = searchParams.get('onlyCurrent') === 'true'

    // Opción 1: Query directa a persona-trayectorias y luego obtener personas
    // Esto es más confiable que filtros anidados
    const trayectoriasParams = new URLSearchParams({
      'filters[colegio][id][$eq]': String(colegioIdNum),
      'pagination[page]': page,
      'pagination[pageSize]': '200', // Obtener más trayectorias para luego filtrar
      'populate[0]': 'persona',
      'populate[1]': 'curso',
      'populate[2]': 'asignatura',
      'populate[3]': 'curso_asignatura',
      'sort[0]': 'is_current:desc',
      'sort[1]': 'anio:desc',
    })

    if (onlyCurrent) {
      trayectoriasParams.append('filters[is_current][$eq]', 'true')
    }

    const trayectoriasResponse = await fetch(
      `${STRAPI_URL}/api/persona-trayectorias?${trayectoriasParams}`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!trayectoriasResponse.ok) {
      throw new Error(`Strapi API error: ${trayectoriasResponse.status}`)
    }

    const trayectoriasData = await trayectoriasResponse.json()
    const trayectorias = trayectoriasData.data || []

    // Obtener IDs únicos de personas
    const personaIds = [...new Set(
      trayectorias
        .map((t: any) => t.persona?.id || t.attributes?.persona?.data?.id)
        .filter(Boolean)
    )]

    if (personaIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: parseInt(page, 10),
            pageSize: parseInt(pageSize, 10),
            pageCount: 0,
            total: 0,
          },
        },
      })
    }

    // Obtener las personas completas
    const personasParams = new URLSearchParams({
      'filters[id][$in]': personaIds.join(','),
      'pagination[page]': '1',
      'pagination[pageSize]': String(personaIds.length),
      'populate[0]': 'emails',
      'populate[1]': 'telefonos',
      'populate[2]': 'imagen',
      'populate[3]': 'tags',
      'sort[0]': 'nombre_completo:asc',
    })

    const personasResponse = await fetch(
      `${STRAPI_URL}/api/personas?${personasParams}`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!personasResponse.ok) {
      throw new Error(`Strapi API error: ${personasResponse.status}`)
    }

    const personasData = await personasResponse.json()
    const personas = personasData.data || []

    // Crear un mapa de trayectorias por persona
    const trayectoriasPorPersona = new Map()
    trayectorias.forEach((trayectoria: any) => {
      const personaId = trayectoria.persona?.id || trayectoria.attributes?.persona?.data?.id
      if (!personaId) return

      if (!trayectoriasPorPersona.has(personaId)) {
        trayectoriasPorPersona.set(personaId, [])
      }

      const tAttrs = trayectoria.attributes || trayectoria
      trayectoriasPorPersona.get(personaId).push({
        id: trayectoria.id || trayectoria.documentId,
        documentId: trayectoria.documentId,
        cargo: tAttrs.cargo || null,
        anio: tAttrs.anio || null,
        is_current: tAttrs.is_current || false,
        fecha_inicio: tAttrs.fecha_inicio || null,
        fecha_fin: tAttrs.fecha_fin || null,
        curso: trayectoria.curso || tAttrs.curso?.data || null,
        asignatura: trayectoria.asignatura || tAttrs.asignatura?.data || null,
        curso_asignatura: trayectoria.curso_asignatura || tAttrs.curso_asignatura?.data || null,
      })
    })

    // Combinar personas con sus trayectorias
    const personasConTrayectorias = personas.map((persona: any) => {
      const attrs = persona.attributes || persona
      const personaId = persona.id
      const trayectoriasDePersona = trayectoriasPorPersona.get(personaId) || []

      return {
        id: persona.id,
        documentId: persona.documentId,
        nombre_completo: attrs.nombre_completo || null,
        nombres: attrs.nombres || null,
        primer_apellido: attrs.primer_apellido || null,
        segundo_apellido: attrs.segundo_apellido || null,
        rut: attrs.rut || null,
        activo: attrs.activo !== undefined ? attrs.activo : true,
        emails: attrs.emails || [],
        telefonos: attrs.telefonos || [],
        imagen: attrs.imagen || null,
        trayectorias: trayectoriasDePersona.filter((t: any) => {
          // Filtrar solo trayectorias del colegio específico
          const tColegioId = t.colegio?.id || t.colegio?.data?.id
          return tColegioId === colegioIdNum
        }),
      }
    })

    // Aplicar paginación manual
    const total = personasConTrayectorias.length
    const pageNum = parseInt(page, 10)
    const pageSizeNum = parseInt(pageSize, 10)
    const start = (pageNum - 1) * pageSizeNum
    const end = start + pageSizeNum
    const paginatedData = personasConTrayectorias.slice(start, end)

    return NextResponse.json({
      success: true,
      data: paginatedData,
      meta: {
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          pageCount: Math.ceil(total / pageSizeNum),
          total,
        },
      },
    })
  } catch (error: any) {
    console.error('[API CRM Colegios Contactos] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener contactos del colegio',
        data: [],
      },
      { status: 500 }
    )
  }
}
