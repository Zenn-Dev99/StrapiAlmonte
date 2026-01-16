import { Container } from 'react-bootstrap'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

import PageBreadcrumb from '@/components/PageBreadcrumb'
import PersonasList from './components/PersonasList'

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'CRM - Personas',
}

export default async function Page() {
  let personas: any[] = []
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/crm/personas`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      personas = Array.isArray(data.data) ? data.data : [data.data]
    } else {
      error = data.error || 'Error al obtener personas'
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Personas Page] Error:', err)
  }

  return (
    <Container fluid>
      <PageBreadcrumb title="CRM - Personas" subtitle="Gestión de Personas" />
      <PersonasList personas={personas} error={error} />
    </Container>
  )
}

