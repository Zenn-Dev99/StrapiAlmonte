import { Container } from 'react-bootstrap'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import PageBreadcrumb from '@/components/PageBreadcrumb'
import ColegioDetail from './components/ColegioDetail'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'CRM - Detalle Colegio',
}

export default async function Page({ params }: { params: { id: string } }) {
  let colegio: any = null
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/crm/colegios/${params.id}`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      colegio = data.data
    } else {
      error = data.error || 'Error al obtener el colegio'
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Colegio Detail Page] Error:', err)
  }

  if (error || !colegio) {
    notFound()
  }

  return (
    <Container fluid>
      <PageBreadcrumb 
        title={colegio.colegio_nombre || 'Detalle Colegio'} 
        subtitle={`RBD: ${colegio.rbd || 'N/A'}`}
      />
      <ColegioDetail colegio={colegio} />
    </Container>
  )
}

