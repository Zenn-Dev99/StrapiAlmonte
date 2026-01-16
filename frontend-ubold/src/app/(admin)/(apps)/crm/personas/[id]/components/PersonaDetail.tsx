'use client'

import { Card, CardBody, CardHeader, Tab, Tabs, Badge, Row, Col } from 'react-bootstrap'

type PersonaDetailProps = {
  persona: any
}

export default function PersonaDetail({ persona }: PersonaDetailProps) {
  return (
    <Card>
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">{persona.nombre_completo || 'Sin nombre'}</h4>
          <Badge bg={persona.activo ? 'success' : 'secondary'}>
            {persona.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </Card.Header>
      <Card.Body>
        <Tabs defaultActiveKey="info" className="mb-3">
          <Tab eventKey="info" title="Información General">
            <Row className="mt-3">
              <Col md={6}>
                <h5>Datos Personales</h5>
                <table className="table table-sm">
                  <tbody>
                    <tr>
                      <td><strong>RUT:</strong></td>
                      <td>{persona.rut || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Nombres:</strong></td>
                      <td>{persona.nombres || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Apellidos:</strong></td>
                      <td>
                        {[persona.primer_apellido, persona.segundo_apellido]
                          .filter(Boolean)
                          .join(' ') || '-'}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Nombre Completo:</strong></td>
                      <td>{persona.nombre_completo || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Estado:</strong></td>
                      <td>
                        <Badge bg={persona.activo ? 'success' : 'secondary'}>
                          {persona.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Origen:</strong></td>
                      <td>{persona.origen || '-'}</td>
                    </tr>
                    <tr>
                      <td><strong>Nivel Confianza:</strong></td>
                      <td>
                        <Badge bg={
                          persona.nivel_confianza === 'alta' ? 'success' :
                          persona.nivel_confianza === 'media' ? 'warning' : 'secondary'
                        }>
                          {persona.nivel_confianza || '-'}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Col>
              <Col md={6}>
                <h5>Contacto</h5>
                {persona.telefonos && persona.telefonos.length > 0 && (
                  <div className="mb-3">
                    <strong>Teléfonos:</strong>
                    <ul>
                      {persona.telefonos.map((tel: any, idx: number) => (
                        <li key={idx}>
                          {tel.telefono_raw || tel.telefono_norm}
                          {tel.tipo && ` (${tel.tipo})`}
                          {tel.principal && <Badge bg="primary" className="ms-2">Principal</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {persona.emails && persona.emails.length > 0 && (
                  <div>
                    <strong>Emails:</strong>
                    <ul>
                      {persona.emails.map((email: any, idx: number) => (
                        <li key={idx}>
                          {email.email}
                          {email.principal && <Badge bg="primary" className="ms-2">Principal</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(!persona.telefonos || persona.telefonos.length === 0) &&
                 (!persona.emails || persona.emails.length === 0) && (
                  <p className="text-muted">No hay información de contacto</p>
                )}
              </Col>
            </Row>
          </Tab>

          <Tab eventKey="colegios" title="Colegios">
            <div className="mt-3">
              <h5>Colegios donde trabaja</h5>
              {(() => {
                // Manejar diferentes formatos de respuesta de Strapi
                const trayectorias = persona.trayectorias?.data || persona.trayectorias || []
                
                if (trayectorias.length === 0) {
                  return <p className="text-muted">No hay colegios registrados para esta persona</p>
                }

                return (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>Colegio</th>
                          <th>RBD</th>
                          <th>Comuna</th>
                          <th>Cargo</th>
                          <th>Año</th>
                          <th>Curso</th>
                          <th>Asignatura</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trayectorias.map((trayectoria: any) => {
                          const tAttrs = trayectoria.attributes || trayectoria
                          const colegio = tAttrs.colegio?.data || tAttrs.colegio
                          const colegioAttrs = colegio?.attributes || colegio
                          const curso = tAttrs.curso?.data || tAttrs.curso
                          const cursoAttrs = curso?.attributes || curso
                          const asignatura = tAttrs.asignatura?.data || tAttrs.asignatura
                          const asignaturaAttrs = asignatura?.attributes || asignatura
                          const comuna = colegioAttrs?.comuna?.data || colegioAttrs?.comuna
                          const comunaAttrs = comuna?.attributes || comuna

                          return (
                            <tr key={trayectoria.id || trayectoria.documentId}>
                              <td>{colegioAttrs?.colegio_nombre || '-'}</td>
                              <td>{colegioAttrs?.rbd || '-'}</td>
                              <td>{comunaAttrs?.nombre || '-'}</td>
                              <td>{tAttrs.cargo || '-'}</td>
                              <td>{tAttrs.anio || '-'}</td>
                              <td>{cursoAttrs?.nombre || cursoAttrs?.titulo || '-'}</td>
                              <td>{asignaturaAttrs?.nombre || '-'}</td>
                              <td>
                                {tAttrs.is_current ? (
                                  <Badge bg="success">Actual</Badge>
                                ) : (
                                  <Badge bg="secondary">Histórica</Badge>
                                )}
                                {!tAttrs.activo && (
                                  <Badge bg="danger" className="ms-1">Inactiva</Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </Tab>

          <Tab eventKey="asignaciones" title="Asignaciones">
            <div className="mt-3">
              <p>Colegios asignados como ejecutivo comercial o soporte.</p>
              {/* TODO: Implementar lista de asignaciones desde cartera-asignacion */}
            </div>
          </Tab>

          <Tab eventKey="actividades" title="Actividades">
            <div className="mt-3">
              <p>Timeline de actividades y eventos.</p>
              {/* TODO: Implementar timeline */}
            </div>
          </Tab>

          <Tab eventKey="notas" title="Notas">
            <div className="mt-3">
              {persona.notas ? (
                <div>
                  <h5>Notas</h5>
                  <p>{persona.notas}</p>
                </div>
              ) : (
                <p className="text-muted">No hay notas registradas</p>
              )}
            </div>
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  )
}

