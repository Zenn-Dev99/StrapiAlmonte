'use client'

import { useState } from 'react'
import { Card, CardBody, CardHeader, Alert, Button, Badge } from 'react-bootstrap'
import { TbEye, TbPlus } from 'react-icons/tb'
import Link from 'next/link'

type Persona = {
  id: number
  rut?: string
  nombre_completo?: string
  activo?: boolean
  origen?: string
}

type PersonasListProps = {
  personas: Persona[]
  error: string | null
}

export default function PersonasList({ personas, error }: PersonasListProps) {
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
        <h4 className="mb-0">Listado de Personas</h4>
        <Link href="/crm/personas/nuevo">
          <Button variant="primary" size="sm">
            <TbPlus className="me-1" />
            Nueva Persona
          </Button>
        </Link>
      </Card.Header>
      <Card.Body>
        {personas.length === 0 ? (
          <Alert variant="info">No hay personas registradas</Alert>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>RUT</th>
                  <th>Nombre Completo</th>
                  <th>Estado</th>
                  <th>Origen</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td>{persona.rut || '-'}</td>
                    <td>{persona.nombre_completo || '-'}</td>
                    <td>
                      <Badge bg={persona.activo ? 'success' : 'secondary'}>
                        {persona.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td>{persona.origen || '-'}</td>
                    <td>
                      <Link href={`/crm/personas/${persona.id}`}>
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

