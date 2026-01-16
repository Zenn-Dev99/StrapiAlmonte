import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Convierte documentId a id numérico
 */
async function getNumericId(
  contentType: 'colegio' | 'persona' | 'curso' | 'asignatura' | 'persona-trayectoria',
  documentId: string
): Promise<number | null> {
  try {
    const endpoint = contentType === 'colegio' ? 'colegios' :
                    contentType === 'persona' ? 'personas' :
                    contentType === 'curso' ? 'cursos' :
                    contentType === 'asignatura' ? 'asignaturas' :
                    'persona-trayectorias'
    
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
  contentType: 'colegio' | 'persona' | 'curso' | 'asignatura' | 'persona-trayectoria',
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
 * PUT /api/crm/persona-trayectorias/[id]
 * Actualizar una trayectoria existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trayectoriaId = params.id
    const body = await request.json()
    const { colegioId, cargo, anio, cursoId, asignaturaId, cursoAsignaturaId, fecha_inicio, fecha_fin, is_current, activo, notas } = body

    // Convertir documentId a id numérico si es necesario
    const trayectoriaIdNum = await resolveNumericId('persona-trayectoria', trayectoriaId)
    
    if (!trayectoriaIdNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de trayectoria inválido',
        },
        { status: 400 }
      )
    }

    // Construir payload para Strapi
    const payload: any = {
      data: {},
    }

    // Validar y agregar colegio si se proporciona
    if (colegioId && colegioId !== '' && colegioId !== '0' && colegioId !== 0) {
      const colegioIdNum = await resolveNumericId('colegio', colegioId)
      if (colegioIdNum) {
        payload.data.colegio = { connect: [colegioIdNum] }
      }
    }

    // Agregar campos opcionales
    if (cargo !== undefined) payload.data.cargo = cargo
    if (anio !== undefined) payload.data.anio = anio ? parseInt(String(anio), 10) : null
    if (fecha_inicio !== undefined) payload.data.fecha_inicio = fecha_inicio || null
    if (fecha_fin !== undefined) payload.data.fecha_fin = fecha_fin || null
    if (is_current !== undefined) payload.data.is_current = is_current
    if (activo !== undefined) payload.data.activo = activo
    if (notas !== undefined) payload.data.notas = notas || null

    // Resolver y agregar relaciones opcionales
    if (cursoId !== undefined) {
      if (cursoId && cursoId !== '' && cursoId !== '0' && cursoId !== 0) {
        const cursoIdNum = await resolveNumericId('curso', cursoId)
        if (cursoIdNum) {
          payload.data.curso = { connect: [cursoIdNum] }
        }
      } else {
        payload.data.curso = { disconnect: [] }
      }
    }

    if (asignaturaId !== undefined) {
      if (asignaturaId && asignaturaId !== '' && asignaturaId !== '0' && asignaturaId !== 0) {
        const asignaturaIdNum = await resolveNumericId('asignatura', asignaturaId)
        if (asignaturaIdNum) {
          payload.data.asignatura = { connect: [asignaturaIdNum] }
        }
      } else {
        payload.data.asignatura = { disconnect: [] }
      }
    }

    if (cursoAsignaturaId !== undefined) {
      if (cursoAsignaturaId && cursoAsignaturaId !== '' && cursoAsignaturaId !== '0' && cursoAsignaturaId !== 0) {
        const cursoAsignaturaIdNum = await resolveNumericId('asignatura', cursoAsignaturaId)
        if (cursoAsignaturaIdNum) {
          payload.data.curso_asignatura = { connect: [cursoAsignaturaIdNum] }
        }
      } else {
        payload.data.curso_asignatura = { disconnect: [] }
      }
    }

    // Actualizar trayectoria en Strapi
    const response = await fetch(`${STRAPI_URL}/api/persona-trayectorias/${trayectoriaIdNum}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API CRM Trayectorias PUT] Error:', errorText)
      
      return NextResponse.json(
        {
          success: false,
          error: `Error al actualizar trayectoria: ${response.status} ${errorText}`,
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
    console.error('[API CRM Trayectorias PUT] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al actualizar trayectoria',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/crm/persona-trayectorias/[id]
 * Eliminar una trayectoria
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trayectoriaId = params.id

    // Convertir documentId a id numérico si es necesario
    const trayectoriaIdNum = await resolveNumericId('persona-trayectoria', trayectoriaId)
    
    if (!trayectoriaIdNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID de trayectoria inválido',
        },
        { status: 400 }
      )
    }

    // Eliminar trayectoria en Strapi
    const response = await fetch(`${STRAPI_URL}/api/persona-trayectorias/${trayectoriaIdNum}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API CRM Trayectorias DELETE] Error:', errorText)
      
      return NextResponse.json(
        {
          success: false,
          error: `Error al eliminar trayectoria: ${response.status} ${errorText}`,
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Trayectoria eliminada correctamente',
    })
  } catch (error: any) {
    console.error('[API CRM Trayectorias DELETE] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al eliminar trayectoria',
      },
      { status: 500 }
    )
  }
}
