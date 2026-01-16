'use client'

import { Card, CardBody, CardHeader, Tab, Tabs, Badge, Row, Col } from 'react-bootstrap'
import Link from 'next/link'
import ContactosList from './ContactosList'

type ColegioDetailProps = {
  colegio: any
}

export default function ColegioDetail({ colegio }: ColegioDetailProps) {
  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">{colegio.colegio_nombre || 'Sin nombre'}</h4>
          <Badge bg={colegio.estado === 'Aprobado' ? 'success' : 'secondary'}>
            {colegio.estado || 'N/A'}
          </Badge>
        </div>
      </Card.Header>
      <Card.Body>
        <Tabs defaultActiveKey="info" className="mb-3">
          <Tab eventKey="info" title="Información General">
            <Row className="mt-3">
              <Col md={6}>
                <h5>Datos Básicos</h5>
                <table className="table table-sm">
                  <tbody>
                    <tr>
                      <td><strong>RBD:</strong></td>
                      <td>{colegio.rbd || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Nombre:</strong></td>
                      <td>{colegio.colegio_nombre || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Estado:</strong></td>
                      <td>
                        <Badge bg={colegio.estado === 'Aprobado' ? 'success' : 'secondary'}>
                          {colegio.estado || '-'}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Dependencia:</strong></td>
                      <td>{colegio.dependencia || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Ruralidad:</strong></td>
                      <td>{colegio.ruralidad || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </Col>
              <Col md={6}>
                <h5>Ubicación</h5>
                <table className="table table-sm">
                  <tbody>
                    <tr>
                      <td><strong>Región:</strong></td>
                      <td>{colegio.region || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Provincia:</strong></td>
                      <td>{colegio.provincia || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Comuna:</strong></td>
                      <td>{colegio.comuna?.nombre || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Zona:</strong></td>
                      <td>{colegio.zona || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </Col>
            </Row>

            {colegio.telefonos && colegio.telefonos.length > 0 && (
              <div className="mt-3">
                <h5>Teléfonos</h5>
                <ul>
                  {colegio.telefonos.map((tel: any, idx: number) => (
                    <li key={idx}>
                      {tel.telefono_raw || tel.telefono_norm} 
                      {tel.tipo && ` (${tel.tipo})`}
                      {tel.principal && <Badge bg="primary" className="ms-2">Principal</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {colegio.emails && colegio.emails.length > 0 && (
              <div className="mt-3">
                <h5>Emails</h5>
                <ul>
                  {colegio.emails.map((email: any, idx: number) => (
                    <li key={idx}>
                      {email.email}
                      {email.principal && <Badge bg="primary" className="ms-2">Principal</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Tab>

          <Tab eventKey="asignaciones" title="Asignaciones">
            <div className="mt-3">
              <p>Asignaciones de ejecutivos comerciales y soporte.</p>
              {/* TODO: Implementar lista de asignaciones */}
            </div>
          </Tab>

          <Tab eventKey="profesores" title="Profesores">
            <ContactosList colegioId={colegio.id || colegio.documentId} />
          </Tab>

          <Tab eventKey="actividades" title="Actividades">
            <div className="mt-3">
              <p>Timeline de actividades y eventos.</p>
              {/* TODO: Implementar timeline */}
            </div>
          </Tab>

          <Tab eventKey="notas" title="Notas">
            <div className="mt-3">
              <p>Notas y observaciones.</p>
              {/* TODO: Implementar notas */}
            </div>
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  )
}

