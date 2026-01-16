'use client'

import { useState } from 'react'
import { Card, CardBody, CardHeader, Alert, Button, Badge, Table } from 'react-bootstrap'
import { TbEye, TbPlus, TbUpload, TbFileSpreadsheet, TbFilePdf, TbCopy } from 'react-icons/tb'
import Link from 'next/link'
import ListaUtilesModal from './ListaUtilesModal'
import ImportarExcelModal from './ImportarExcelModal'
import ImportarPDFModal from './ImportarPDFModal'
import DeleteConfirmationModal from '@/components/table/DeleteConfirmationModal'

type ListaUtiles = {
  id: number
  nombre?: string
  nivel?: 'Basica' | 'Media'
  grado?: number
  descripcion?: string
  materiales?: any[]
  activo?: boolean
  cursosUsando?: number
}

type ListasUtilesListProps = {
  listas: any[]
  error: string | null
}

export default function ListasUtilesList({ listas, error }: ListasUtilesListProps) {
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [editingLista, setEditingLista] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const handleEdit = (lista: any) => {
    setEditingLista(lista)
    setShowModal(true)
  }

  const handleDuplicate = async (lista: any) => {
    try {
      const response = await fetch(`/api/crm/listas-utiles/${lista.id}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        const listaData = data.data.attributes || data.data
        const nuevaLista = {
          nombre: `${listaData.nombre} (Copia)`,
          nivel: listaData.nivel,
          grado: listaData.grado,
          descripcion: listaData.descripcion,
          materiales: listaData.materiales || [],
          activo: true,
        }
        
        setEditingLista(nuevaLista)
        setShowModal(true)
      }
    } catch (err) {
      console.error('Error al duplicar lista:', err)
      alert('Error al duplicar lista')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/crm/listas-utiles/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        window.location.reload()
      } else {
        alert(data.error || 'Error al eliminar lista')
      }
    } catch (err) {
      console.error('Error al eliminar lista:', err)
      alert('Error al eliminar lista')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingLista(null)
    window.location.reload()
  }

  const handleExcelImportClose = () => {
    setShowExcelModal(false)
    window.location.reload()
  }

  const handlePDFImportClose = () => {
    setShowPDFModal(false)
    window.location.reload()
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    )
  }

  // Transformar datos de Strapi
  const transformedListas: ListaUtiles[] = listas.map((lista: any) => {
    const attrs = lista.attributes || lista
    return {
      id: lista.id || lista.documentId,
      nombre: attrs.nombre,
      nivel: attrs.nivel,
      grado: attrs.grado,
      descripcion: attrs.descripcion,
      materiales: attrs.materiales || [],
      activo: attrs.activo !== false,
    }
  })

  return (
    <>
      <Card>
        <CardHeader className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Listado de Listas de Útiles</h4>
          <div className="d-flex gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={() => setShowExcelModal(true)}
            >
              <TbFileSpreadsheet className="me-1" />
              Importar Excel
            </Button>
            <Button
              variant="info"
              size="sm"
              onClick={() => setShowPDFModal(true)}
            >
              <TbFilePdf className="me-1" />
              Importar PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
            >
              <TbPlus className="me-1" />
              Nueva Lista
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {transformedListas.length === 0 ? (
            <Alert variant="info">No hay listas de útiles registradas</Alert>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Nivel</th>
                    <th>Grado</th>
                    <th># Materiales</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {transformedListas.map((lista) => (
                    <tr key={lista.id}>
                      <td>{lista.nombre || '-'}</td>
                      <td>
                        <Badge bg={lista.nivel === 'Basica' ? 'primary' : 'success'}>
                          {lista.nivel || '-'}
                        </Badge>
                      </td>
                      <td>{lista.grado || '-'}°</td>
                      <td>{lista.materiales?.length || 0}</td>
                      <td>
                        <Badge bg={lista.activo ? 'success' : 'secondary'}>
                          {lista.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link href={`/crm/listas-utiles/${lista.id}`}>
                            <Button variant="outline-primary" size="sm">
                              <TbEye />
                            </Button>
                          </Link>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => handleEdit(lista)}
                          >
                            <TbEye />
                          </Button>
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => handleDuplicate(lista)}
                          >
                            <TbCopy />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => setDeleteTarget(lista.id)}
                          >
                            <TbEye />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <ListaUtilesModal
        show={showModal}
        onHide={handleModalClose}
        lista={editingLista}
      />

      <ImportarExcelModal
        show={showExcelModal}
        onHide={handleExcelImportClose}
      />

      <ImportarPDFModal
        show={showPDFModal}
        onHide={handlePDFImportClose}
      />

      <DeleteConfirmationModal
        show={deleteTarget !== null}
        onHide={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            handleDelete(deleteTarget)
            setDeleteTarget(null)
          }
        }}
        title="Eliminar Lista de Útiles"
        message="¿Está seguro de que desea eliminar esta lista? Esta acción no se puede deshacer."
      />
    </>
  )
}
