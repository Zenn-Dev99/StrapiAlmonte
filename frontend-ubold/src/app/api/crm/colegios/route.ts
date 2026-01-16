import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('pageSize') || '25'
    const region = searchParams.get('region')
    const estado = searchParams.get('estado')
    const estado_estab = searchParams.get('estado_estab')
    const search = searchParams.get('search')

    // Construir query params para Strapi
    const params = new URLSearchParams({
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      'populate[0]': 'comuna',
      'populate[1]': 'cartera_asignaciones.ejecutivo',
      'populate[2]': 'cartera_asignaciones.periodo',
      'sort[0]': 'colegio_nombre:asc',
      'publicationState': 'preview', // Incluir drafts
    })

    // Agregar filtros
    if (region && region !== 'todos' && region !== '') {
      // Filtrar por campo region directo (se establece desde comuna en lifecycle)
      params.append('filters[region][$eq]', region)
    }

    if (estado && estado !== 'todos' && estado !== '') {
      params.append('filters[estado][$eq]', estado)
    }

    if (estado_estab && estado_estab !== 'todos' && estado_estab !== '') {
      params.append('filters[estado_estab][$eq]', estado_estab)
    }

    if (search && search.trim()) {
      const searchTerm = search.trim()
      // Buscar por nombre o RBD
      const rbdNum = Number(searchTerm)
      if (!isNaN(rbdNum)) {
        params.append('filters[rbd][$eq]', String(rbdNum))
      } else {
        params.append('filters[colegio_nombre][$containsi]', searchTerm)
      }
    }

    const response = await fetch(`${STRAPI_URL}/api/colegios?${params}`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Strapi API error: ${response.status}`)
    }

    const data = await response.json()

    // Formatear respuesta
    return NextResponse.json({
      success: true,
      data: data.data || [],
      meta: data.meta || {},
    })
  } catch (error: any) {
    console.error('[API CRM Colegios] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener colegios',
        data: [],
      },
      { status: 500 }
    )
  }
}

