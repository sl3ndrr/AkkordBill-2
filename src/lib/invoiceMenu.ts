import type { Invoice } from '../types'

export type InvoiceMenuAction = 'edit' | 'pdf' | 'duplicate' | 'delete'

export interface InvoiceMenuHandlers {
  onEdit: (invoice: Invoice) => void
  onPrint: (invoice: Invoice) => void
  onDuplicate: (invoice: Invoice) => void
  onDelete: (invoice: Invoice) => void
}

export function runInvoiceMenuAction(action: InvoiceMenuAction, invoice: Invoice, handlers: InvoiceMenuHandlers): void {
  if (action === 'edit') handlers.onEdit(invoice)
  if (action === 'pdf') handlers.onPrint(invoice)
  if (action === 'duplicate') handlers.onDuplicate(invoice)
  if (action === 'delete') handlers.onDelete(invoice)
}
