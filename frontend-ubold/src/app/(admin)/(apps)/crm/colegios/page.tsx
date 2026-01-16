import { Container } from 'react-bootstrap'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

import PageBreadcrumb from '@/components/PageBreadcrumb'
import ColegiosList from './components/ColegiosList'

// Forzar renderizado dinámico
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'CRM - Colegios',
}

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  let colegios: any[] = []
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    // Construir query params con filtros
    const params = new URLSearchParams()
    if (searchParams.region && searchParams.region !== 'todos') {
      params.append('region', String(searchParams.region))
    }
    if (searchParams.estado && searchParams.estado !== 'todos') {
      params.append('estado', String(searchParams.estado))
    }
    if (searchParams.estado_estab && searchParams.estado_estab !== 'todos') {
      params.append('estado_estab', String(searchParams.estado_estab))
    }
    if (searchParams.search) {
      params.append('search', String(searchParams.search))
    }

    const response = await fetch(`${baseUrl}/api/crm/colegios?${params.toString()}`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      colegios = Array.isArray(data.data) ? data.data : [data.data]
    } else {
      error = data.error || 'Error al obtener colegios'
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Colegios Page] Error:', err)
  }

  return (
    <Container fluid>
      <PageBreadcrumb title="CRM - Colegios" subtitle="Gestión de Colegios" />
      <ColegiosList initialColegios={colegios} initialError={error} />
    </Container>
  )
}

