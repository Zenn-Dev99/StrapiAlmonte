import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('pageSize') || '25'

    // Construir query params para Strapi
    const params = new URLSearchParams({
      'pagination[page]': page,
      'pagination[pageSize]': pageSize,
      'populate[0]': 'emails',
      'populate[1]': 'telefonos',
      'sort[0]': 'nombre_completo:asc',
    })

    const response = await fetch(`${STRAPI_URL}/api/personas?${params}`, {
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
    console.error('[API CRM Personas] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener personas',
        data: [],
      },
      { status: 500 }
    )
  }
}

