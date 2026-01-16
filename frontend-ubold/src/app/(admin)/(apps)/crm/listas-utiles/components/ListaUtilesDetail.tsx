'use client'

import { Card, CardBody, CardHeader, Badge, Table, Row, Col, Button } from 'react-bootstrap'
import { TbEdit, TbArrowLeft } from 'react-icons/tb'
import Link from 'next/link'
import { useState } from 'react'
import ListaUtilesModal from './ListaUtilesModal'

type ListaUtilesDetailProps = {
  lista: any
}

export default function ListaUtilesDetail({ lista }: ListaUtilesDetailProps) {
  const [showEditModal, setShowEditModal] = useState(false)

  const attrs = lista?.attributes || lista || {}
  const materiales = attrs.materiales || []

  const tiposMaterial = [
    { value: 'util', label: 'Útil' },
    { value: 'libro', label: 'Libro' },
    { value: 'cuaderno', label: 'Cuaderno' },
    { value: 'otro', label: 'Otro' },
  ]

  return (
    <>
      <Card>
        <CardHeader className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">{attrs.nombre || 'Sin nombre'}</h4>
          <div className="d-flex gap-2">
            <Link href="/crm/listas-utiles">
              <Button variant="outline-secondary" size="sm">
                <TbArrowLeft className="me-1" />
                Volver
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowEditModal(true)}
            >
              <TbEdit className="me-1" />
              Editar
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Row className="mb-4">
            <Col md={6}>
              <h5>Información General</h5>
              <Table striped bordered size="sm">
                <tbody>
                  <tr>
                    <td><strong>Nombre:</strong></td>
                    <td>{attrs.nombre || '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Nivel:</strong></td>
                    <td>
                      <Badge bg={attrs.nivel === 'Basica' ? 'primary' : 'success'}>
                        {attrs.nivel || '-'}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Grado:</strong></td>
                    <td>{attrs.grado || '-'}°</td>
                  </tr>
                  <tr>
                    <td><strong>Estado:</strong></td>
                    <td>
                      <Badge bg={attrs.activo !== false ? 'success' : 'secondary'}>
                        {attrs.activo !== false ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                  </tr>
                  {attrs.descripcion && (
                    <tr>
                      <td><strong>Descripción:</strong></td>
                      <td>{attrs.descripcion}</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>

          <h5>Materiales ({materiales.length})</h5>
          {materiales.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Material</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Obligatorio</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((material: any, index: number) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{material.material_nombre || '-'}</td>
                      <td>
                        <Badge bg="secondary">
                          {tiposMaterial.find((t) => t.value === material.tipo)?.label || material.tipo}
                        </Badge>
                      </td>
                      <td>{material.cantidad || 1}</td>
                      <td>
                        {material.obligatorio !== false ? (
                          <Badge bg="success">Sí</Badge>
                        ) : (
                          <Badge bg="warning">No</Badge>
                        )}
                      </td>
                      <td>{material.descripcion || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="alert alert-info">No hay materiales en esta lista.</div>
          )}
        </CardBody>
      </Card>

      <ListaUtilesModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false)
          window.location.reload()
        }}
        lista={lista}
      />
    </>
  )
}
