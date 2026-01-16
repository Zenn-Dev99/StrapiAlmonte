import { NextRequest, NextResponse } from 'next/server'

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || ''

/**
 * GET /api/crm/cursos/[id]
 * Obtener un curso por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cursoId = params.id

    // Con draftAndPublish: true, necesitamos publicationState=preview para incluir drafts
    const response = await fetch(
      `${STRAPI_URL}/api/cursos/${cursoId}?populate=deep&publicationState=preview`,
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
      console.error('[API /cursos/[id] GET] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al obtener curso' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data.data,
    })
  } catch (error: any) {
    console.error('[API /cursos/[id] GET] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener curso' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/crm/cursos/[id]
 * Actualizar un curso
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cursoId = params.id
    const body = await request.json()
    const { data } = body

    const response = await fetch(
      `${STRAPI_URL}/api/cursos/${cursoId}`,
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
      console.error('[API /cursos/[id] PUT] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al actualizar curso' },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error: any) {
    console.error('[API /cursos/[id] PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar curso' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/crm/cursos/[id]
 * Eliminar un curso
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cursoId = params.id

    const response = await fetch(
      `${STRAPI_URL}/api/cursos/${cursoId}`,
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
      console.error('[API /cursos/[id] DELETE] Error response:', errorData)
      return NextResponse.json(
        { success: false, error: errorData.error?.message || 'Error al eliminar curso' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Curso eliminado correctamente',
    })
  } catch (error: any) {
    console.error('[API /cursos/[id] DELETE] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al eliminar curso' },
      { status: 500 }
    )
  }
}
