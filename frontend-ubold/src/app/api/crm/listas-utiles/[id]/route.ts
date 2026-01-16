import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/listas-utiles/[id]
 * Obtener una lista de útiles por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listaId = params.id

    const response = await fetch(
      `${STRAPI_URL}/api/listas-utiles/${listaId}?populate=deep`,
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
      console.error('[API /listas-utiles/[id] GET] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al obtener lista de útiles' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data.data,
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/[id] GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener lista de útiles' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/crm/listas-utiles/[id]
 * Actualizar una lista de útiles
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listaId = params.id
    const body = await request.json()
    const { data } = body

    const response = await fetch(
      `${STRAPI_URL}/api/listas-utiles/${listaId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[API /listas-utiles/[id] PUT] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al actualizar lista de útiles' },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/[id] PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar lista de útiles' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/crm/listas-utiles/[id]
 * Eliminar una lista de útiles
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listaId = params.id

    // Verificar si la lista está siendo usada por cursos activos
    const cursosResponse = await fetch(
      `${STRAPI_URL}/api/cursos?filters[lista_utiles][id][$eq]=${listaId}&filters[activo][$eq]=true`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (cursosResponse.ok) {
      const cursosData = await cursosResponse.json()
      if (cursosData.data && cursosData.data.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: `No se puede eliminar la lista. Está siendo usada por ${cursosData.data.length} curso(s) activo(s).`,
            cursosUsando: cursosData.data.length
          },
          { status: 400 }
        )
      }
    }

    const response = await fetch(
      `${STRAPI_URL}/api/listas-utiles/${listaId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[API /listas-utiles/[id] DELETE] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al eliminar lista de útiles' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Lista de útiles eliminada correctamente',
    })
  } catch (error: any) {
    console.error('[API /listas-utiles/[id] DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al eliminar lista de útiles' },
      { status: 500 }
    )
  }
}
