import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Convierte documentId a id numérico
 */
async function getNumericId(
  contentType: 'colegio' | 'persona' | 'curso' | 'asignatura',
  documentId: string
): Promise<number | null> {
  try {
    const endpoint = contentType === 'colegio' ? 'colegios' :
                    contentType === 'persona' ? 'personas' :
                    contentType === 'curso' ? 'cursos' :
                    'asignaturas'
    
    const response = await fetch(`${STRAPI_URL}/api/${endpoint}/${documentId}?fields[0]=id`, {
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
  contentType: 'colegio' | 'persona' | 'curso' | 'asignatura',
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
 * POST /api/crm/persona-trayectorias
 * Crear una nueva trayectoria
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { personaId, colegioId, cargo, anio, cursoId, asignaturaId, cursoAsignaturaId, fecha_inicio, fecha_fin, is_current, activo, notas } = body

    // Validaciones
    if (!personaId || personaId === '' || personaId === '0' || personaId === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'personaId es requerido',
        },
        { status: 400 }
      )
    }

    if (!colegioId || colegioId === '' || colegioId === '0' || colegioId === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'colegioId es requerido',
        },
        { status: 400 }
      )
    }

    // Convertir documentIds a ids numéricos
    const personaIdNum = await resolveNumericId('persona', personaId)
    const colegioIdNum = await resolveNumericId('colegio', colegioId)

    if (!personaIdNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo obtener el ID numérico de la persona',
        },
        { status: 400 }
      )
    }

    if (!colegioIdNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo obtener el ID numérico del colegio',
        },
        { status: 400 }
      )
    }

    // Resolver IDs opcionales
    let cursoIdNum: number | null = null
    let asignaturaIdNum: number | null = null
    let cursoAsignaturaIdNum: number | null = null

    if (cursoId && cursoId !== '' && cursoId !== '0' && cursoId !== 0) {
      cursoIdNum = await resolveNumericId('curso', cursoId)
    }

    if (asignaturaId && asignaturaId !== '' && asignaturaId !== '0' && asignaturaId !== 0) {
      asignaturaIdNum = await resolveNumericId('asignatura', asignaturaId)
    }

    if (cursoAsignaturaId && cursoAsignaturaId !== '' && cursoAsignaturaId !== '0' && cursoAsignaturaId !== 0) {
      cursoAsignaturaIdNum = await resolveNumericId('asignatura', cursoAsignaturaId) // Mismo endpoint
    }

    // Construir payload para Strapi
    const payload: any = {
      data: {
        persona: { connect: [personaIdNum] },
        colegio: { connect: [colegioIdNum] },
        activo: activo !== undefined ? activo : true,
        is_current: is_current !== undefined ? is_current : false,
      },
    }

    // Agregar campos opcionales
    if (cargo) payload.data.cargo = cargo
    if (anio) payload.data.anio = parseInt(String(anio), 10)
    if (fecha_inicio) payload.data.fecha_inicio = fecha_inicio
    if (fecha_fin) payload.data.fecha_fin = fecha_fin
    if (notas) payload.data.notas = notas

    // Agregar relaciones opcionales
    if (cursoIdNum) {
      payload.data.curso = { connect: [cursoIdNum] }
    }

    if (asignaturaIdNum) {
      payload.data.asignatura = { connect: [asignaturaIdNum] }
    }

    if (cursoAsignaturaIdNum) {
      payload.data.curso_asignatura = { connect: [cursoAsignaturaIdNum] }
    }

    // Crear trayectoria en Strapi
    const response = await fetch(`${STRAPI_URL}/api/persona-trayectorias`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API CRM Trayectorias POST] Error:', errorText)
      
      return NextResponse.json(
        {
          success: false,
          error: `Error al crear trayectoria: ${response.status} ${errorText}`,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      data: data.data || null,
    })
  } catch (error: any) {
    console.error('[API CRM Trayectorias POST] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al crear trayectoria',
      },
      { status: 500 }
    )
  }
}
