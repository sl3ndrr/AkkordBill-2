import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import type { ToastMessage } from '../types'

interface ToastRegionProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastRegion({ messages, onDismiss }: ToastRegionProps) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {messages.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? TriangleAlert : Info
        return (
          <div className={`toast toast--${toast.tone}`} key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}>
            <Icon aria-hidden="true" />
            <span>{toast.message}</span>
            <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Meldung schließen"><X aria-hidden="true" /></button>
          </div>
        )
      })}
    </div>
  )
}
