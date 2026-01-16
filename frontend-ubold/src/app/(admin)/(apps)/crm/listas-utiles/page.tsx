import { headers } from 'next/headers'
import { Metadata } from 'next'
import { Container } from 'react-bootstrap'
import PageBreadcrumb from '@/components/layouts/includes/breadcrumb'
import ListasUtilesList from './components/ListasUtilesList'

export const metadata: Metadata = {
  title: 'CRM - Listas de Útiles',
}

export default async function Page() {
  let listas: any[] = []
  let error: string | null = null

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}`

    const response = await fetch(`${baseUrl}/api/crm/listas-utiles`, {
      cache: 'no-store',
    })

    const data = await response.json()

    if (data.success && data.data) {
      listas = Array.isArray(data.data) ? data.data : [data.data]
    } else {
      error = data.error || 'Error al obtener listas de útiles'
    }
  } catch (err: any) {
    error = err.message || 'Error al conectar con la API'
    console.error('[CRM Listas Utiles Page] Error:', err)
  }

  return (
    <Container fluid>
      <PageBreadcrumb title="CRM - Listas de Útiles" subtitle="Gestión de Listas Predefinidas de Útiles Escolares" />
      <ListasUtilesList listas={listas} error={error} />
    </Container>
  )
}
