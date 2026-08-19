import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Bestätigen', danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="small"
      footer={
        <>
          <button className="button button--text" type="button" onClick={onCancel}>Abbrechen</button>
          <button className={`button ${danger ? 'button--danger' : 'button--primary'}`} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <div className="confirm-message">
        <span className={`confirm-icon ${danger ? 'confirm-icon--danger' : ''}`}><AlertTriangle aria-hidden="true" /></span>
        <p>{message}</p>
      </div>
    </Modal>
  )
}
