import { useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Copy, Download, Edit3, FilePlus2, Mail, MoreHorizontal, Printer, Search, Send, Trash2 } from 'lucide-react'
import type { AppState, Invoice, InvoiceStatus } from '../types'
import { EmptyState } from '../components/EmptyState'
import { createReminder, effectiveStatus, euro, formatDate, formatDateLong, guardianName, invoiceTotal, mailtoUrl, statusLabel, studentName } from '../lib/utils'

interface InvoicesProps {
  state: AppState
  selectedId: string | null
  onSelect: (id: string | null) => void
  onNew: () => void
  onEdit: (invoice: Invoice) => void
  onDuplicate: (invoice: Invoice) => void
  onDelete: (invoice: Invoice) => void
  onSetStatus: (invoice: Invoice, status: InvoiceStatus) => void
  onPrint: (invoice: Invoice) => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}

export function Invoices({ state, selectedId, onSelect, onNew, onEdit, onDuplicate, onDelete, onSetStatus, onPrint, onToast }: InvoicesProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | InvoiceStatus>('all')
  const [year, setYear] = useState('all')
  const selected = state.invoices.find((invoice) => invoice.id === selectedId) ?? null
  const years = [...new Set(state.invoices.map((invoice) => String(invoice.year)))].sort().reverse()

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE')
    return [...state.invoices]
      .filter((invoice) => {
        const actualStatus = effectiveStatus(invoice)
        if (status !== 'all' && actualStatus !== status) return false
        if (year !== 'all' && String(invoice.year) !== year) return false
        if (!needle) return true
        const haystack = [invoice.number, invoice.period, guardianName(invoice, state.guardians), studentName(invoice, state.students), ...invoice.items.map((item) => item.description)].join(' ').toLocaleLowerCase('de-DE')
        return haystack.includes(needle)
      })
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.createdAt.localeCompare(a.createdAt))
  }, [search, state.guardians, state.invoices, state.students, status, year])

  return (
    <div className="page invoice-page">
      <header className="page-header">
        <div><p className="eyebrow">Verwaltung</p><h1>Rechnungen</h1><p>{state.invoices.length} Vorgänge · {euro.format(state.invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0))} Gesamtvolumen</p></div>
        <button className="button button--primary button--large" onClick={onNew}><FilePlus2 aria-hidden="true" /> Neue Rechnung</button>
      </header>

      <section className="filter-bar" aria-label="Rechnungen filtern">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Rechnungen durchsuchen</span>
          <input id="invoice-search" type="search" placeholder="Nummer, Familie, Kind oder Thema …" value={search} onChange={(event) => setSearch(event.target.value)} />
          <kbd>/</kbd>
        </label>
        <label className="select-field select-field--compact"><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Alle Status</option>{Object.entries(statusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" /></label>
        <label className="select-field select-field--compact"><span className="sr-only">Jahr</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Alle Jahre</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown aria-hidden="true" /></label>
      </section>

      {!state.invoices.length ? (
        <section className="surface">
          <EmptyState icon={FilePlus2} title="Die erste Rechnung wartet" description="Sobald eine Familie angelegt ist, kannst du Unterrichtspositionen erfassen und die Rechnung finalisieren." action={<button className="button button--primary" onClick={onNew}>Rechnung anlegen</button>} />
        </section>
      ) : (
        <div className={`invoice-workspace ${selected ? 'invoice-workspace--detail' : ''}`}>
          <section className="surface invoice-list-card">
            <div className="invoice-list-summary"><span>{filtered.length} Ergebnisse</span>{(search || status !== 'all' || year !== 'all') && <button className="button button--text" onClick={() => { setSearch(''); setStatus('all'); setYear('all') }}>Filter zurücksetzen</button>}</div>
            <div className="table-scroll">
              <table className="data-table invoice-list-table">
                <thead><tr><th>Rechnung</th><th>Familie / Kind</th><th>Zeitraum</th><th>Status</th><th className="align-right">Betrag</th><th><span className="sr-only">Aktion</span></th></tr></thead>
                <tbody>{filtered.map((invoice) => {
                  const actualStatus = effectiveStatus(invoice)
                  return (
                    <tr className={invoice.id === selectedId ? 'is-selected' : ''} key={invoice.id} onClick={() => onSelect(invoice.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onSelect(invoice.id)}>
                      <td><strong>{invoice.number ?? 'Entwurf'}</strong><small>{formatDate(invoice.invoiceDate)}</small></td>
                      <td>{guardianName(invoice, state.guardians)}<small>{studentName(invoice, state.students)}</small></td>
                      <td>{invoice.period}</td>
                      <td><span className={`status-chip status-chip--${actualStatus}`}><i />{statusLabel[actualStatus]}</span></td>
                      <td className="align-right"><strong>{euro.format(invoiceTotal(invoice))}</strong></td>
                      <td><button className="icon-button icon-button--small" onClick={(event) => { event.stopPropagation(); onSelect(invoice.id) }} aria-label={`${invoice.number ?? 'Entwurf'} öffnen`}><MoreHorizontal aria-hidden="true" /></button></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            {!filtered.length && <EmptyState icon={Search} title="Nichts gefunden" description="Passe Suche oder Filter an, um andere Rechnungen zu sehen." />}
          </section>

          {selected && (
            <InvoiceDetail
              invoice={selected}
              state={state}
              onClose={() => onSelect(null)}
              onEdit={() => onEdit(selected)}
              onDuplicate={() => onDuplicate(selected)}
              onDelete={() => onDelete(selected)}
              onSetStatus={(next) => onSetStatus(selected, next)}
              onPrint={() => onPrint(selected)}
              onToast={onToast}
            />
          )}
        </div>
      )}
    </div>
  )
}

function InvoiceDetail({ invoice, state, onClose, onEdit, onDuplicate, onDelete, onSetStatus, onPrint, onToast }: {
  invoice: Invoice
  state: AppState
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSetStatus: (status: InvoiceStatus) => void
  onPrint: () => void
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void
}) {
  const status = effectiveStatus(invoice)
  const reminder = createReminder(invoice, state.guardians, state.students)
  const canRemind = status === 'sent' || status === 'overdue'

  const copyReminder = async () => {
    await navigator.clipboard.writeText(`${reminder.subject}\n\n${reminder.body}`)
    onToast('Erinnerungstext kopiert.', 'success')
  }

  return (
    <aside className="surface invoice-detail" aria-label={`Details zu ${invoice.number ?? 'Entwurf'}`}>
      <header className="invoice-detail__header">
        <div><p className="eyebrow">Rechnung</p><h2>{invoice.number ?? 'Entwurf'}</h2><p>{guardianName(invoice, state.guardians)}</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Detailansicht schließen">×</button>
      </header>
      <div className="invoice-detail__amount"><strong>{euro.format(invoiceTotal(invoice))}</strong><span className={`status-chip status-chip--${status}`}><i />{statusLabel[status]}</span></div>
      <dl className="detail-list">
        <div><dt><CalendarDays aria-hidden="true" /> Leistungszeitraum</dt><dd>{invoice.period}</dd></div>
        <div><dt>Rechnungsdatum</dt><dd>{formatDateLong(invoice.invoiceDate)}</dd></div>
        <div><dt>Fällig am</dt><dd>{formatDateLong(invoice.dueDate)}</dd></div>
        <div><dt>Unterricht für</dt><dd>{studentName(invoice, state.students)}</dd></div>
        <div><dt>Positionen</dt><dd>{invoice.items.length}</dd></div>
      </dl>

      <div className="detail-actions">
        {invoice.status === 'draft' ? (
          <><button className="button button--primary" onClick={() => onSetStatus('sent')}><Send aria-hidden="true" /> Finalisieren</button><button className="button button--tonal" onClick={onEdit}><Edit3 aria-hidden="true" /> Bearbeiten</button></>
        ) : (
          <button className="button button--primary" onClick={onPrint}><Printer aria-hidden="true" /> PDF / Drucken</button>
        )}
        {status !== 'paid' && invoice.status !== 'draft' && <button className="button button--tonal" onClick={() => onSetStatus('paid')}><Check aria-hidden="true" /> Als bezahlt markieren</button>}
        {status === 'paid' && <button className="button button--tonal" onClick={() => onSetStatus('sent')}>Zahlung zurücknehmen</button>}
      </div>

      {canRemind && (
        <section className="reminder-panel">
          <div><Mail aria-hidden="true" /><div><strong>Zahlungserinnerung</strong><p>Fertig formuliert, ohne automatischen Versand.</p></div></div>
          <div className="button-row"><a className="button button--text" href={mailtoUrl(invoice, state.guardians, state.students)}><Mail aria-hidden="true" /> E-Mail öffnen</a><button className="button button--text" onClick={copyReminder}><Copy aria-hidden="true" /> Text kopieren</button></div>
        </section>
      )}

      <section className="position-summary">
        <h3>Positionen</h3>
        {invoice.items.map((item) => <div key={item.id}><span>{item.description}<small>{formatDate(item.serviceDate)} · {item.quantity.toLocaleString('de-DE')} {item.unit}</small></span><strong>{euro.format(item.quantity * item.unitPrice)}</strong></div>)}
      </section>

      <footer className="invoice-detail__footer">
        <button className="button button--text" onClick={onDuplicate}><Copy aria-hidden="true" /> Duplizieren</button>
        {invoice.status === 'draft' && <button className="button button--text button--danger-text" onClick={onDelete}><Trash2 aria-hidden="true" /> Löschen</button>}
        {invoice.status !== 'draft' && <button className="button button--text" onClick={onPrint}><Download aria-hidden="true" /> Vorschau</button>}
      </footer>
    </aside>
  )
}
