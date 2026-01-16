import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * Construye populate params usando la sintaxis correcta de Strapi v4
 * Sintaxis: populate[0]=trayectorias&populate[0][populate][0]=colegio&populate[0][populate][0][populate][0]=comuna
 */
function buildPopulateQuery(populates: string[]): string {
  const params: string[] = []
  let populateIndex = 0
  
  populates.forEach((populate) => {
    if (populate.includes('.')) {
      // Para relaciones anidadas: "trayectorias.colegio.comuna"
      const parts = populate.split('.')
      params.push(`populate[${populateIndex}]=${parts[0]}`)
      
      // Para cada nivel anidado
      parts.slice(1).forEach((part, partIndex) => {
        // Construir la clave anidada correctamente
        // populate[0][populate][0]=colegio
        // populate[0][populate][0][populate][0]=comuna
        let key = `populate[${populateIndex}]`
        for (let i = 0; i <= partIndex; i++) {
          key += '[populate]'
        }
        key += `[0]=${part}`
        params.push(key)
      })
    } else {
      // Relación simple
      params.push(`populate[${populateIndex}]=${populate}`)
    }
    populateIndex++
  })
  
  return params.join('&')
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personaId = params.id

    // Populate completo para la ficha - usando sintaxis correcta de Strapi v4
    const populateFields = [
      'telefonos',
      'emails',
      'trayectorias.colegio.comuna',  // Nivel 3: trayectorias → colegio → comuna
      'trayectorias.curso',
      'trayectorias.asignatura',
      'trayectorias.curso_asignatura',
      'cartera_asignaciones.colegio',
      'cartera_asignaciones.periodo',
    ]
    
    const populateParams = buildPopulateQuery(populateFields)

    const queryString = populateParams ? `?${populateParams}` : ''
    const response = await fetch(
      `${STRAPI_URL}/api/personas/${personaId}${queryString}`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: 'Persona no encontrada',
            data: null,
          },
          { status: 404 }
        )
      }
      throw new Error(`Strapi API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      data: data.data || null,
    })
  } catch (error: any) {
    console.error('[API CRM Persona Detail] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener la persona',
        data: null,
      },
      { status: 500 }
    )
  }
}

