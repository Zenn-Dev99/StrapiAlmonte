'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Form, Row, Col, Table, Badge, Alert } from 'react-bootstrap'
import { TbPlus, TbTrash } from 'react-icons/tb'

type Material = {
  material_nombre: string
  tipo: 'util' | 'libro' | 'cuaderno' | 'otro'
  cantidad: number
  obligatorio: boolean
  descripcion?: string
}

type ListaUtilesModalProps = {
  show: boolean
  onHide: () => void
  lista?: any
}

export default function ListaUtilesModal({ show, onHide, lista }: ListaUtilesModalProps) {
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState<'Basica' | 'Media'>('Basica')
  const [grado, setGrado] = useState<number>(1)
  const [descripcion, setDescripcion] = useState('')
  const [activo, setActivo] = useState(true)
  const [materiales, setMateriales] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Nuevo material en edición
  const [newMaterial, setNewMaterial] = useState<Material>({
    material_nombre: '',
    tipo: 'util',
    cantidad: 1,
    obligatorio: true,
    descripcion: '',
  })

  useEffect(() => {
    if (lista) {
      const attrs = lista.attributes || lista
      setNombre(attrs.nombre || '')
      setNivel(attrs.nivel || 'Basica')
      setGrado(attrs.grado || 1)
      setDescripcion(attrs.descripcion || '')
      setActivo(attrs.activo !== false)
      setMateriales(attrs.materiales || [])
    } else {
      // Reset para nuevo
      setNombre('')
      setNivel('Basica')
      setGrado(1)
      setDescripcion('')
      setActivo(true)
      setMateriales([])
      setNewMaterial({
        material_nombre: '',
        tipo: 'util',
        cantidad: 1,
        obligatorio: true,
        descripcion: '',
      })
    }
    setError(null)
  }, [lista, show])

  const handleAddMaterial = () => {
    if (!newMaterial.material_nombre.trim()) {
      setError('El nombre del material es requerido')
      return
    }

    setMateriales([...materiales, { ...newMaterial }])
    setNewMaterial({
      material_nombre: '',
      tipo: 'util',
      cantidad: 1,
      obligatorio: true,
      descripcion: '',
    })
    setError(null)
  }

  const handleRemoveMaterial = (index: number) => {
    setMateriales(materiales.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!nombre.trim()) {
      setError('El nombre es requerido')
      setLoading(false)
      return
    }

    if (materiales.length === 0) {
      setError('Debe agregar al menos un material')
      setLoading(false)
      return
    }

    try {
      const url = lista
        ? `/api/crm/listas-utiles/${lista.id || lista.documentId}`
        : '/api/crm/listas-utiles'
      const method = lista ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            nombre,
            nivel,
            grado,
            descripcion: descripcion || undefined,
            activo,
            materiales,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        onHide()
      } else {
        setError(data.error || 'Error al guardar lista')
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar lista')
    } finally {
      setLoading(false)
    }
  }

  const tiposMaterial = [
    { value: 'util', label: 'Útil' },
    { value: 'libro', label: 'Libro' },
    { value: 'cuaderno', label: 'Cuaderno' },
    { value: 'otro', label: 'Otro' },
  ]

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          {lista ? 'Editar Lista de Útiles' : 'Nueva Lista de Útiles'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <Row className="mb-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Nombre de la Lista *</Form.Label>
                <Form.Control
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Nivel *</Form.Label>
                <Form.Select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value as 'Basica' | 'Media')}
                  required
                >
                  <option value="Basica">Básica</option>
                  <option value="Media">Media</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Grado *</Form.Label>
                <Form.Select
                  value={grado}
                  onChange={(e) => setGrado(Number(e.target.value))}
                  required
                >
                  {nivel === 'Basica' ? (
                    Array.from({ length: 8 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}°
                      </option>
                    ))
                  ) : (
                    Array.from({ length: 4 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}°
                      </option>
                    ))
                  )}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Group>
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col>
              <Form.Check
                type="checkbox"
                label="Activa"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
            </Col>
          </Row>

          <hr />

          <h5>Materiales ({materiales.length})</h5>

          {/* Formulario para agregar material */}
          <div className="border p-3 mb-3 rounded">
            <Row>
              <Col md={4}>
                <Form.Group className="mb-2">
                  <Form.Label>Nombre del Material *</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMaterial.material_nombre}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, material_nombre: e.target.value })
                    }
                    placeholder="Ej: Lápiz grafito"
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-2">
                  <Form.Label>Tipo *</Form.Label>
                  <Form.Select
                    value={newMaterial.tipo}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, tipo: e.target.value as any })
                    }
                  >
                    {tiposMaterial.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-2">
                  <Form.Label>Cantidad *</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    value={newMaterial.cantidad}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, cantidad: Number(e.target.value) })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group className="mb-2">
                  <Form.Label>Obligatorio</Form.Label>
                  <Form.Check
                    type="checkbox"
                    checked={newMaterial.obligatorio}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, obligatorio: e.target.checked })
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Label>&nbsp;</Form.Label>
                <Button
                  variant="primary"
                  onClick={handleAddMaterial}
                  className="w-100"
                  disabled={!newMaterial.material_nombre.trim()}
                >
                  <TbPlus /> Agregar
                </Button>
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Group className="mb-2">
                  <Form.Label>Descripción</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMaterial.descripcion}
                    onChange={(e) =>
                      setNewMaterial({ ...newMaterial, descripcion: e.target.value })
                    }
                    placeholder="Opcional"
                  />
                </Form.Group>
              </Col>
            </Row>
          </div>

          {/* Tabla de materiales */}
          {materiales.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Obligatorio</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((material, index) => (
                    <tr key={index}>
                      <td>{material.material_nombre}</td>
                      <td>
                        <Badge bg="secondary">
                          {tiposMaterial.find((t) => t.value === material.tipo)?.label || material.tipo}
                        </Badge>
                      </td>
                      <td>{material.cantidad}</td>
                      <td>
                        {material.obligatorio ? (
                          <Badge bg="success">Sí</Badge>
                        ) : (
                          <Badge bg="warning">No</Badge>
                        )}
                      </td>
                      <td>{material.descripcion || '-'}</td>
                      <td>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveMaterial(index)}
                        >
                          <TbTrash />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="info">No hay materiales agregados. Agregue al menos uno.</Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={loading || materiales.length === 0}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
