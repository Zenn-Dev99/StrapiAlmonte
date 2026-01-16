'use client'

import { useState, useEffect } from 'react'
import { Alert, Badge, Button, Form, Row, Col, InputGroup, Card, CardBody } from 'react-bootstrap'
import { TbSearch, TbFilter } from 'react-icons/tb'
import Link from 'next/link'

type Contacto = {
  id: number
  documentId?: string
  nombre_completo?: string
  nombres?: string
  primer_apellido?: string
  segundo_apellido?: string
  rut?: string
  activo?: boolean
  emails?: Array<{ email: string; estado?: string; principal?: boolean }>
  telefonos?: Array<{ telefono_raw?: string; telefono_norm?: string; estado?: string; principal?: boolean }>
  trayectorias?: Array<{
    id: number
    cargo?: string
    anio?: number
    is_current?: boolean
    activo?: boolean
    curso?: { nombre?: string; titulo?: string }
    asignatura?: { nombre?: string }
  }>
}

type ContactosListProps = {
  colegioId: string | number
}

const ESTADOS_EMAIL = ['Por Verificar', 'Verificado', 'Aprobado']
const ESTADOS_TELEFONO = ['Por Verificar', 'Verificado', 'Aprobado']

export default function ContactosList({ colegioId }: ContactosListProps) {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [filtroSearch, setFiltroSearch] = useState('')
  const [filtroEstadoEmail, setFiltroEstadoEmail] = useState('todos')
  const [filtroEstadoTelefono, setFiltroEstadoTelefono] = useState('todos')
  const [filtroSoloActuales, setFiltroSoloActuales] = useState(false)
  const [agruparPorEstado, setAgruparPorEstado] = useState(false)

  // Cargar contactos
  useEffect(() => {
    const cargarContactos = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filtroSoloActuales) {
          params.append('onlyCurrent', 'true')
        }

        const response = await fetch(`/api/crm/colegios/${colegioId}/contactos?${params.toString()}`, {
          cache: 'no-store',
        })

        const data = await response.json()

        if (data.success && data.data) {
          setContactos(Array.isArray(data.data) ? data.data : [data.data])
          setError(null)
        } else {
          setError(data.error || 'Error al obtener contactos')
          setContactos([])
        }
      } catch (err: any) {
        setError(err.message || 'Error al conectar con la API')
        setContactos([])
      } finally {
        setLoading(false)
      }
    }

    cargarContactos()
  }, [colegioId, filtroSoloActuales])

  // Filtrar contactos localmente
  const contactosFiltrados = contactos.filter((contacto) => {
    // Filtro de búsqueda
    if (filtroSearch.trim()) {
      const searchTerm = filtroSearch.toLowerCase()
      const nombreCompleto = (contacto.nombre_completo || '').toLowerCase()
      const rut = (contacto.rut || '').toLowerCase()
      if (!nombreCompleto.includes(searchTerm) && !rut.includes(searchTerm)) {
        return false
      }
    }

    // Filtro por estado de email
    if (filtroEstadoEmail !== 'todos') {
      const tieneEmailConEstado = contacto.emails?.some(
        (email) => email.estado === filtroEstadoEmail
      )
      if (!tieneEmailConEstado) return false
    }

    // Filtro por estado de teléfono
    if (filtroEstadoTelefono !== 'todos') {
      const tieneTelefonoConEstado = contacto.telefonos?.some(
        (telefono) => telefono.estado === filtroEstadoTelefono
      )
      if (!tieneTelefonoConEstado) return false
    }

    return true
  })

  // Agrupar por estado si está activado
  const contactosAgrupados = agruparPorEstado
    ? contactosFiltrados.reduce((acc, contacto) => {
        // Determinar estado principal del contacto
        const estadoEmail = contacto.emails?.find((e) => e.principal)?.estado || 
                           contacto.emails?.[0]?.estado || 
                           'Sin Estado'
        const estado = estadoEmail
        
        if (!acc[estado]) acc[estado] = []
        acc[estado].push(contacto)
        return acc
      }, {} as Record<string, typeof contactosFiltrados>)
    : null

  if (loading) {
    return <Alert variant="info">Cargando contactos...</Alert>
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  return (
    <div className="mt-3">
      <h5>Profesores y contactos del colegio</h5>
      
      {/* Filtros */}
      <Card className="bg-light mb-3">
        <CardBody>
          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Buscar</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <TbSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Nombre o RUT"
                  value={filtroSearch}
                  onChange={(e) => setFiltroSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={2}>
              <Form.Label>Estado Email</Form.Label>
              <Form.Select
                value={filtroEstadoEmail}
                onChange={(e) => setFiltroEstadoEmail(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                {ESTADOS_EMAIL.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label>Estado Teléfono</Form.Label>
              <Form.Select
                value={filtroEstadoTelefono}
                onChange={(e) => setFiltroEstadoTelefono(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                {ESTADOS_TELEFONO.map((estado) => (
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
                  variant={!agruparPorEstado ? 'primary' : 'outline-primary'}
                  size="sm"
                  onClick={() => setAgruparPorEstado(false)}
                  title="Vista Lista"
                >
                  <TbFilter />
                </Button>
                <Button
                  variant={agruparPorEstado ? 'primary' : 'outline-primary'}
                  size="sm"
                  onClick={() => setAgruparPorEstado(true)}
                  title="Agrupar por Estado"
                >
                  <TbFilter className="me-1" />
                  Estado
                </Button>
              </div>
            </Col>
            <Col md={2}>
              <Form.Label>Filtro</Form.Label>
              <Form.Check
                type="checkbox"
                label="Solo actuales"
                checked={filtroSoloActuales}
                onChange={(e) => setFiltroSoloActuales(e.target.checked)}
              />
            </Col>
          </Row>
        </CardBody>
      </Card>

      {contactosFiltrados.length === 0 ? (
        <Alert variant="info">No hay contactos que coincidan con los filtros</Alert>
      ) : agruparPorEstado && contactosAgrupados ? (
        // Vista agrupada por estado
        Object.entries(contactosAgrupados).map(([estado, contactosEstado]) => (
          <Card key={estado} className="mb-3">
            <Card.Header className="bg-primary text-white">
              <h6 className="mb-0">
                {estado} ({contactosEstado.length} {contactosEstado.length === 1 ? 'contacto' : 'contactos'})
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>RUT</th>
                      <th>Cargo</th>
                      <th>Año</th>
                      <th>Curso</th>
                      <th>Asignatura</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactosEstado.map((contacto) => (
                      <ContactoRow key={contacto.id || contacto.documentId} contacto={contacto} />
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
                <th>Nombre</th>
                <th>RUT</th>
                <th>Cargo</th>
                <th>Año</th>
                <th>Curso</th>
                <th>Asignatura</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contactosFiltrados.map((contacto) => (
                <ContactoRow key={contacto.id || contacto.documentId} contacto={contacto} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ContactoRow({ contacto }: { contacto: Contacto }) {
  const trayectoriaActual = contacto.trayectorias?.find((t) => t.is_current) || contacto.trayectorias?.[0]
  
  return (
    <tr>
      <td>
        <Link href={`/crm/personas/${contacto.id || contacto.documentId}`}>
          {contacto.nombre_completo || 
           `${contacto.nombres || ''} ${contacto.primer_apellido || ''} ${contacto.segundo_apellido || ''}`.trim() || 
           '-'}
        </Link>
      </td>
      <td>{contacto.rut || '-'}</td>
      <td>{trayectoriaActual?.cargo || '-'}</td>
      <td>{trayectoriaActual?.anio || '-'}</td>
      <td>{trayectoriaActual?.curso?.nombre || trayectoriaActual?.curso?.titulo || '-'}</td>
      <td>{trayectoriaActual?.asignatura?.nombre || '-'}</td>
      <td>
        {trayectoriaActual?.is_current ? (
          <Badge bg="success">Actual</Badge>
        ) : (
          <Badge bg="secondary">Histórica</Badge>
        )}
        {trayectoriaActual && !trayectoriaActual.activo && (
          <Badge bg="danger" className="ms-1">Inactiva</Badge>
        )}
        {contacto.emails?.some((e) => e.estado === 'Aprobado') && (
          <Badge bg="info" className="ms-1">Email OK</Badge>
        )}
        {contacto.telefonos?.some((t) => t.estado === 'Aprobado') && (
          <Badge bg="info" className="ms-1">Tel OK</Badge>
        )}
      </td>
      <td>
        <Link href={`/crm/personas/${contacto.id || contacto.documentId}`}>
          <Button variant="outline-primary" size="sm">
            Ver
          </Button>
        </Link>
      </td>
    </tr>
  )
}
