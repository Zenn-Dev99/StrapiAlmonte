'use client'

import { useState, useRef } from 'react'
import { Modal, Button, Form, Table, Alert, ProgressBar, Row, Col } from 'react-bootstrap'
import { TbUpload, TbFileSpreadsheet } from 'react-icons/tb'

type Material = {
  material_nombre: string
  tipo: 'util' | 'libro' | 'cuaderno' | 'otro'
  cantidad: number
  obligatorio: boolean
  descripcion?: string
}

type ImportarExcelModalProps = {
  show: boolean
  onHide: () => void
}

export default function ImportarExcelModal({ show, onHide }: ImportarExcelModalProps) {
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState<'Basica' | 'Media'>('Basica')
  const [grado, setGrado] = useState<number>(1)
  const [descripcion, setDescripcion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Material[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editableMaterials, setEditableMaterials] = useState<Material[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Seleccione un archivo')
      return
    }

    if (!nombre.trim()) {
      setError('El nombre de la lista es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('nombre', nombre)
      formData.append('nivel', nivel)
      formData.append('grado', grado.toString())
      if (descripcion) {
        formData.append('descripcion', descripcion)
      }

      const response = await fetch('/api/crm/listas-utiles/import-excel', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success && data.preview) {
        setPreview(data.preview.materiales)
        setEditableMaterials([...data.preview.materiales])
      } else {
        setError(data.error || 'Error al procesar archivo')
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (editableMaterials.length === 0) {
      setError('No hay materiales para guardar')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/crm/listas-utiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            nombre,
            nivel,
            grado,
            descripcion: descripcion || undefined,
            activo: true,
            materiales: editableMaterials,
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

  const handleMaterialChange = (index: number, field: keyof Material, value: any) => {
    const updated = [...editableMaterials]
    updated[index] = { ...updated[index], [field]: value }
    setEditableMaterials(updated)
  }

  const handleRemoveMaterial = (index: number) => {
    setEditableMaterials(editableMaterials.filter((_, i) => i !== index))
  }

  const handleClose = () => {
    setNombre('')
    setNivel('Basica')
    setGrado(1)
    setDescripcion('')
    setFile(null)
    setPreview(null)
    setEditableMaterials([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onHide()
  }

  const tiposMaterial = [
    { value: 'util', label: 'Útil' },
    { value: 'libro', label: 'Libro' },
    { value: 'cuaderno', label: 'Cuaderno' },
    { value: 'otro', label: 'Otro' },
  ]

  return (
    <Modal show={show} onHide={handleClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          <TbFileSpreadsheet className="me-2" />
          Importar Lista desde Excel
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {!preview ? (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Nombre de la Lista *</Form.Label>
              <Form.Control
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Lista 1° Básica 2024"
              />
            </Form.Group>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Nivel *</Form.Label>
                  <Form.Select
                    value={nivel}
                    onChange={(e) => setNivel(e.target.value as 'Basica' | 'Media')}
                  >
                    <option value="Basica">Básica</option>
                    <option value="Media">Media</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Grado *</Form.Label>
                  <Form.Select
                    value={grado}
                    onChange={(e) => setGrado(Number(e.target.value))}
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

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Opcional"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Archivo Excel (.xlsx, .xls, .csv) *</Form.Label>
              <Form.Control
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileChange}
              />
              <Form.Text className="text-muted">
                Formato esperado: Material | Tipo | Cantidad | Obligatorio | Descripción
              </Form.Text>
            </Form.Group>

            {loading && (
              <div className="mb-3">
                <ProgressBar animated now={100} />
                <small className="text-muted">Procesando archivo...</small>
              </div>
            )}
          </>
        ) : (
          <>
            <Alert variant="success" className="mb-3">
              <strong>¡Archivo procesado exitosamente!</strong>
              <br />
              Se encontraron {editableMaterials.length} material(es). Revise y edite si es necesario antes de guardar.
            </Alert>

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
                  {editableMaterials.map((material, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          value={material.material_nombre}
                          onChange={(e) =>
                            handleMaterialChange(index, 'material_nombre', e.target.value)
                          }
                          size="sm"
                        />
                      </td>
                      <td>
                        <Form.Select
                          value={material.tipo}
                          onChange={(e) =>
                            handleMaterialChange(index, 'tipo', e.target.value)
                          }
                          size="sm"
                        >
                          {tiposMaterial.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="1"
                          value={material.cantidad}
                          onChange={(e) =>
                            handleMaterialChange(index, 'cantidad', Number(e.target.value))
                          }
                          size="sm"
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={material.obligatorio}
                          onChange={(e) =>
                            handleMaterialChange(index, 'obligatorio', e.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          value={material.descripcion || ''}
                          onChange={(e) =>
                            handleMaterialChange(index, 'descripcion', e.target.value)
                          }
                          size="sm"
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveMaterial(index)}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        {!preview ? (
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={loading || !file || !nombre.trim()}
          >
            <TbUpload className="me-1" />
            {loading ? 'Procesando...' : 'Procesar Archivo'}
          </Button>
        ) : (
          <Button
            variant="success"
            onClick={handleSave}
            disabled={loading || editableMaterials.length === 0}
          >
            {loading ? 'Guardando...' : 'Guardar Lista'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
