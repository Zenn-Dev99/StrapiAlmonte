import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/listas-utiles/para-selector
 * Obtener listas de útiles formateadas para un selector/dropdown
 * Filtro opcional por nivel y grado
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nivel = searchParams.get('nivel')
    const grado = searchParams.get('grado')

    const queryParams = new URLSearchParams()
    queryParams.append('filters[activo][$eq]', 'true')
    queryParams.append('sort', 'nombre:asc')
    queryParams.append('fields[0]', 'nombre')
    queryParams.append('fields[1]', 'nivel')
    queryParams.append('fields[2]', 'grado')

    if (nivel) {
      queryParams.append('filters[nivel][$eq]', nivel)
    }
    if (grado) {
      queryParams.append('filters[grado][$eq]', grado)
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
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al obtener listas' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const listas = (data.data || []).map((lista: any) => {
      const attrs = lista.attributes || lista
      return {
        id: lista.id || lista.documentId,
        nombre: attrs.nombre,
        nivel: attrs.nivel,
        grado: attrs.grado,
        label: `${attrs.nombre} (${attrs.nivel} - ${attrs.grado}°)`,
      }
    })
    
    return NextResponse.json({
      success: true,
      data: listas,
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/para-selector GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener listas' },
      { status: 500 }
    )
  }
}
