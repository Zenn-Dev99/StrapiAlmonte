'use client'

import { Modal, Button } from 'react-bootstrap'

type DeleteConfirmationModalProps = {
  show: boolean
  onHide: () => void
  onConfirm: () => void
  title?: string
  message?: string
  selectedCount?: number
  itemName?: string
}

export default function DeleteConfirmationModal({
  show,
  onHide,
  onConfirm,
  title,
  message,
  selectedCount,
  itemName = 'item',
}: DeleteConfirmationModalProps) {
  const defaultTitle = selectedCount
    ? `Eliminar ${selectedCount} ${itemName}${selectedCount > 1 ? 's' : ''}`
    : title || 'Confirmar eliminación'

  const defaultMessage = selectedCount
    ? `¿Está seguro de que desea eliminar ${selectedCount} ${itemName}${selectedCount > 1 ? 's' : ''}? Esta acción no se puede deshacer.`
    : message || '¿Está seguro de que desea eliminar este elemento? Esta acción no se puede deshacer.'

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{defaultTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{defaultMessage}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Eliminar
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
