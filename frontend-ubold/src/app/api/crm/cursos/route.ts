import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/cursos
 * Obtener todos los cursos con filtros opcionales
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const colegioId = searchParams.get('colegioId')
    const nivel = searchParams.get('nivel')
    const activo = searchParams.get('activo')

    const queryParams = new URLSearchParams()
    queryParams.append('populate', 'deep')
    queryParams.append('sort', 'nombre_curso:asc')

    if (colegioId) {
      queryParams.append('filters[colegio][id][$eq]', colegioId)
    }
    if (nivel) {
      queryParams.append('filters[nivel][$eq]', nivel)
    }
    if (activo !== null && activo !== undefined) {
      queryParams.append('filters[activo][$eq]', activo === 'true' ? 'true' : 'false')
    }

    const response = await fetch(
      `${STRAPI_URL}/api/cursos?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[API /cursos GET] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al obtener cursos' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data.data || [],
      meta: data.meta || {},
    })
  } catch (error: any) {
    console.error('[API /cursos GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener cursos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/crm/cursos
 * Crear un nuevo curso
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data } = body

    if (!data || !data.nombre_curso || !data.colegio) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: nombre_curso, colegio' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${STRAPI_URL}/api/cursos`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[API /cursos POST] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al crear curso' },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      data: result.data,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[API /cursos POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear curso' },
      { status: 500 }
    )
  }
}
