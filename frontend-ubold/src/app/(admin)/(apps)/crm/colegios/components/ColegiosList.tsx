'use client'

import { useState, useEffect } from 'react'
import { Card, CardBody, CardHeader, Alert, Button, Badge, Form, Row, Col, InputGroup } from 'react-bootstrap'
import { TbEye, TbPlus, TbSearch, TbFilter } from 'react-icons/tb'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type Colegio = {
  id: number
  documentId?: string
  rbd?: number
  colegio_nombre?: string
  estado?: string
  estado_estab?: string
  region?: string
  comuna?: {
    id: number
    attributes?: {
      comuna_nombre?: string
      region_nombre?: string
    }
    comuna_nombre?: string
  }
  attributes?: {
    rbd?: number
    colegio_nombre?: string
    estado?: string
    estado_estab?: string
    region?: string
    comuna?: any
  }
}

type ColegiosListProps = {
  initialColegios: Colegio[]
  initialError: string | null
}

const ESTADOS = ['Por Verificar', 'Verificado', 'Aprobado']
const ESTADOS_ESTAB = ['Funcionando', 'En receso', 'Cerrado', 'Autorizado sin matrícula']

export default function ColegiosList({ initialColegios, initialError }: ColegiosListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [colegios, setColegios] = useState<Colegio[]>(initialColegios)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [regiones, setRegiones] = useState<string[]>([])
  
  // Filtros
  const [filtroRegion, setFiltroRegion] = useState(searchParams.get('region') || 'todos')
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get('estado') || 'todos')
  const [filtroEstadoEstab, setFiltroEstadoEstab] = useState(searchParams.get('estado_estab') || 'todos')
  const [filtroSearch, setFiltroSearch] = useState(searchParams.get('search') || '')
  const [agruparPorRegion, setAgruparPorRegion] = useState(false)

  // Cargar regiones disponibles
  useEffect(() => {
    const cargarRegiones = async () => {
      try {
        const headersList = await fetch('/api/crm/colegios/regiones', { cache: 'no-store' })
        const data = await headersList.json()
        if (data.success && Array.isArray(data.data)) {
          setRegiones(data.data)
        }
      } catch (err) {
        console.error('[ColegiosList] Error cargando regiones:', err)
      }
    }
    cargarRegiones()
  }, [])

  // Aplicar filtros con debounce para search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const aplicarFiltros = async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams()
          if (filtroRegion && filtroRegion !== 'todos') params.append('region', filtroRegion)
          if (filtroEstado && filtroEstado !== 'todos') params.append('estado', filtroEstado)
          if (filtroEstadoEstab && filtroEstadoEstab !== 'todos') params.append('estado_estab', filtroEstadoEstab)
          if (filtroSearch.trim()) params.append('search', filtroSearch.trim())

          // Actualizar URL sin recargar
          const newUrl = params.toString() ? `/crm/colegios?${params.toString()}` : '/crm/colegios'
          router.replace(newUrl, { scroll: false })

          const headersList = await fetch(`/api/crm/colegios?${params.toString()}`, {
            cache: 'no-store',
          })

          const data = await headersList.json()

          if (data.success && data.data) {
            setColegios(Array.isArray(data.data) ? data.data : [data.data])
            setError(null)
          } else {
            setError(data.error || 'Error al obtener colegios')
            setColegios([])
          }
        } catch (err: any) {
          setError(err.message || 'Error al conectar con la API')
          setColegios([])
        } finally {
          setLoading(false)
        }
      }

      aplicarFiltros()
    }, filtroSearch ? 500 : 0) // Debounce solo para search

    return () => clearTimeout(timeoutId)
  }, [filtroRegion, filtroEstado, filtroEstadoEstab, filtroSearch, router])

  // Normalizar datos del colegio
  const normalizarColegio = (colegio: Colegio) => {
    const attrs = colegio.attributes || colegio
    const comunaData = attrs.comuna?.attributes || attrs.comuna || colegio.comuna
    
    return {
      id: colegio.id || colegio.documentId,
      rbd: attrs.rbd || colegio.rbd,
      colegio_nombre: attrs.colegio_nombre || colegio.colegio_nombre,
      estado: attrs.estado || colegio.estado,
      estado_estab: attrs.estado_estab || colegio.estado_estab,
      region: attrs.region || colegio.region || comunaData?.region_nombre,
      comuna: {
        id: comunaData?.id,
        nombre: comunaData?.comuna_nombre || comunaData?.nombre,
      },
    }
  }

  // Agrupar por región si está activado
  const colegiosNormalizados = colegios.map(normalizarColegio)
  const colegiosAgrupados = agruparPorRegion
    ? colegiosNormalizados.reduce((acc, colegio) => {
        const region = colegio.region || 'Sin Región'
        if (!acc[region]) acc[region] = []
        acc[region].push(colegio)
        return acc
      }, {} as Record<string, typeof colegiosNormalizados>)
    : null

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h4 className="mb-0">Listado de Colegios</h4>
        <Link href="/crm/colegios/nuevo">
          <Button variant="primary" size="sm">
            <TbPlus className="me-1" />
            Nuevo Colegio
          </Button>
        </Link>
      </Card.Header>
      <Card.Body>
        {/* Filtros */}
        <Row className="mb-3">
          <Col md={12}>
            <Card className="bg-light">
              <Card.Body>
                <Row className="g-3">
                  <Col md={3}>
                    <Form.Label>Buscar</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>
                        <TbSearch />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        placeholder="Nombre o RBD"
                        value={filtroSearch}
                        onChange={(e) => setFiltroSearch(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={3}>
                    <Form.Label>Región</Form.Label>
                    <Form.Select
                      value={filtroRegion}
                      onChange={(e) => setFiltroRegion(e.target.value)}
                    >
                      <option value="todos">Todas las Regiones</option>
                      {regiones.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label>Estado</Form.Label>
                    <Form.Select
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                      <option value="todos">Todos los Estados</option>
                      {ESTADOS.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label>Estado Estab.</Form.Label>
                    <Form.Select
                      value={filtroEstadoEstab}
                      onChange={(e) => setFiltroEstadoEstab(e.target.value)}
                    >
                      <option value="todos">Todos</option>
                      {ESTADOS_ESTAB.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={2}>
                    <Form.Label>Vista</Form.Label>
                    <div className="d-flex gap-2">
                      <Button
                        variant={!agruparPorRegion ? 'primary' : 'outline-primary'}
                        size="sm"
                        onClick={() => setAgruparPorRegion(false)}
                        title="Vista Lista"
                      >
                        <TbFilter />
                      </Button>
                      <Button
                        variant={agruparPorRegion ? 'primary' : 'outline-primary'}
                        size="sm"
                        onClick={() => setAgruparPorRegion(true)}
                        title="Agrupar por Región"
                      >
                        <TbFilter className="me-1" />
                        Región
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {loading && (
          <Alert variant="info">Cargando...</Alert>
        )}

        {!loading && colegiosNormalizados.length === 0 ? (
          <Alert variant="info">No hay colegios que coincidan con los filtros</Alert>
        ) : agruparPorRegion && colegiosAgrupados ? (
          // Vista agrupada por región
          Object.entries(colegiosAgrupados).map(([region, colegiosRegion]) => (
            <Card key={region} className="mb-3">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">
                  {region} ({colegiosRegion.length} {colegiosRegion.length === 1 ? 'colegio' : 'colegios'})
                </h5>
              </Card.Header>
              <Card.Body>
                <div className="table-responsive">
                  <table className="table table-hover table-sm">
                    <thead>
                      <tr>
                        <th>RBD</th>
                        <th>Nombre</th>
                        <th>Estado</th>
                        <th>Estado Estab.</th>
                        <th>Comuna</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colegiosRegion.map((colegio) => (
                        <tr key={colegio.id}>
                          <td>{colegio.rbd || '-'}</td>
                          <td>{colegio.colegio_nombre || '-'}</td>
                          <td>
                            <Badge bg={colegio.estado === 'Aprobado' ? 'success' : 'secondary'}>
                              {colegio.estado || 'N/A'}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={colegio.estado_estab === 'Funcionando' ? 'success' : 'warning'}>
                              {colegio.estado_estab || '-'}
                            </Badge>
                          </td>
                          <td>{colegio.comuna?.nombre || '-'}</td>
                          <td>
                            <Link href={`/crm/colegios/${colegio.id}`}>
                              <Button variant="outline-primary" size="sm">
                                <TbEye className="me-1" />
                                Ver
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          ))
        ) : (
          // Vista lista normal
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>RBD</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Estado Estab.</th>
                  <th>Región</th>
                  <th>Comuna</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {colegiosNormalizados.map((colegio) => (
                  <tr key={colegio.id}>
                    <td>{colegio.rbd || '-'}</td>
                    <td>{colegio.colegio_nombre || '-'}</td>
                    <td>
                      <Badge bg={colegio.estado === 'Aprobado' ? 'success' : 'secondary'}>
                        {colegio.estado || 'N/A'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={colegio.estado_estab === 'Funcionando' ? 'success' : 'warning'}>
                        {colegio.estado_estab || '-'}
                      </Badge>
                    </td>
                    <td>{colegio.region || '-'}</td>
                    <td>{colegio.comuna?.nombre || '-'}</td>
                    <td>
                      <Link href={`/crm/colegios/${colegio.id}`}>
                        <Button variant="outline-primary" size="sm">
                          <TbEye className="me-1" />
                          Ver
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

