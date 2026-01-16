import { Container } from 'react-bootstrap'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import PageBreadcrumb from '@/components/PageBreadcrumb'
import PersonaDetail from './components/PersonaDetail'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'CRM - Detalle Persona',
}

export default async function Page({ params }: { params: { id: string } }) {
  let persona: any = null
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/crm/personas/${params.id}`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      persona = data.data
    } else {
      error = data.error || 'Error al obtener la persona'
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Persona Detail Page] Error:', err)
  }

  if (error || !persona) {
    notFound()
  }

  return (
    <Container fluid>
      <PageBreadcrumb 
        title={persona.nombre_completo || 'Detalle Persona'} 
        subtitle={`RUT: ${persona.rut || 'N/A'}`}
      />
      <PersonaDetail persona={persona} />
    </Container>
  )
}

