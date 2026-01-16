import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Container } from 'react-bootstrap'
import PageBreadcrumb from '@/components/layouts/includes/breadcrumb'
import ListaUtilesDetail from '../components/ListaUtilesDetail'

export const metadata: Metadata = {
  title: 'CRM - Detalle Lista de Útiles',
}

export default async function Page({ params }: { params: { id: string } }) {
  let lista: any = null
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/crm/listas-utiles/${params.id}`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      lista = data.data
    } else {
      error = data.error || 'Error al obtener lista de útiles'
      if (response.status === 404) {
        notFound()
      }
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Lista Utiles Detail Page] Error:', err)
  }

  if (error && !lista) {
    return (
      <Container fluid>
        <PageBreadcrumb title="CRM - Lista de Útiles" subtitle="Error" />
        <div className="alert alert-danger">{error}</div>
      </Container>
    )
  }

  return (
    <Container fluid>
      <PageBreadcrumb
        title="CRM - Lista de Útiles"
        subtitle={lista?.attributes?.nombre || lista?.nombre || 'Detalle'}
      />
      <ListaUtilesDetail lista={lista} />
    </Container>
  )
}
