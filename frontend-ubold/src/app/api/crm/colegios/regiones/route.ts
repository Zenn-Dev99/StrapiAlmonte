import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/colegios/regiones
 * Obtener todas las regiones únicas de los colegios
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener todos los colegios con región para extraer valores únicos
    const response = await fetch(
      `${STRAPI_URL}/api/colegios?fields[0]=region&pagination[pageSize]=1000&publicationState=preview`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error(`Strapi API error: ${response.status}`)
    }

    const data = await response.json()
    const colegios = data.data || []

    // Extraer regiones únicas y ordenarlas
    const regionesSet = new Set<string>()
    colegios.forEach((colegio: any) => {
      const attrs = colegio.attributes || colegio
      const region = attrs.region
      if (region && typeof region === 'string' && region.trim()) {
        regionesSet.add(region.trim())
      }
    })

    const regiones = Array.from(regionesSet).sort()

    return NextResponse.json({
      success: true,
      data: regiones,
    })
  } catch (error: any) {
    console.error('[API CRM Colegios Regiones] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener regiones',
        data: [],
      },
      { status: 500 }
    )
  }
}
