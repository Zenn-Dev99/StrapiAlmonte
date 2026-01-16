import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/listas-utiles
 * Obtener todas las listas de útiles
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const grado = searchParams.get('grado')
    const activo = searchParams.get('activo')

    // Construir query string para filtros
    const queryParams = new URLSearchParams()
    queryParams.append('populate', 'deep')
    queryParams.append('sort', 'nombre:asc')

    if (nivel) {
      queryParams.append('filters[nivel][$eq]', nivel)
    }
    if (grado) {
      queryParams.append('filters[grado][$eq]', grado)
    }
    if (activo !== null && activo !== undefined) {
      queryParams.append('filters[activo][$eq]', activo === 'true' ? 'true' : 'false')
    }

    const response = await fetch(
      `${STRAPI_URL}/api/listas-utiles?${queryParams.toString()}`,
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
      console.error('[API /listas-utiles GET] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al obtener listas de útiles' },
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
    console.error('[API /listas-utiles GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener listas de útiles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/crm/listas-utiles
 * Crear una nueva lista de útiles
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data } = body

    if (!data || !data.nombre || !data.nivel || !data.grado) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: nombre, nivel, grado' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${STRAPI_URL}/api/listas-utiles`,
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
      console.error('[API /listas-utiles POST] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al crear lista de útiles' },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      data: result.data,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[API /listas-utiles POST] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear lista de útiles' },
      { status: 500 }
    )
  }
}
