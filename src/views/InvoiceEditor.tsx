import { useEffect, useMemo, useState } from 'react'
import { Calendar, CircleDollarSign, FileCheck2, Plus, Save, Send, Trash2 } from 'lucide-react'
import type { Guardian, InvoiceDraft, Settings, Student } from '../types'
import { Modal } from '../components/Modal'
import { euro, itemTotal, uid } from '../lib/utils'

interface InvoiceEditorProps {
  open: boolean
  draft: InvoiceDraft
  guardians: Guardian[]
  students: Student[]
  settings: Settings
  editing: boolean
  finalized: boolean
  invoiceNumber?: string | null
  onClose: () => void
  onSave: (draft: InvoiceDraft, finalize: boolean) => void
}

export function InvoiceEditor({ open, draft, guardians, students, settings, editing, finalized, invoiceNumber, onClose, onSave }: InvoiceEditorProps) {
  const [form, setForm] = useState<InvoiceDraft>(draft)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => setForm(structuredClone(draft)), [draft, open])

  const linkedGuardianIds = useMemo(() => new Set(form.studentIds.flatMap((id) => students.find((student) => student.id === id)?.guardianIds ?? [])), [form.studentIds, students])
  const eligibleGuardians = linkedGuardianIds.size ? guardians.filter((guardian) => linkedGuardianIds.has(guardian.id)) : guardians
  const total = form.items.reduce((sum, item) => sum + itemTotal(item), 0)

  const selectStudent = (student: Student) => {
    setForm((current) => {
      const isSelected = current.studentIds.includes(student.id)
      const studentIds = isSelected ? current.studentIds.filter((id) => id !== student.id) : [...current.studentIds, student.id]
      const guardianIds = isSelected
        ? current.guardianIds.filter((id) => studentIds.some((studentId) => students.find((item) => item.id === studentId)?.guardianIds.includes(id)))
        : [...new Set([...current.guardianIds, ...student.guardianIds])]
      const items = isSelected
        ? current.items.filter((item) => item.studentId !== student.id)
        : current.items.length ? current.items : [newItem(student.id, current.invoiceDate, settings.privateRate)]
      return { ...current, studentIds, guardianIds, items }
    })
  }

  const updateItem = (id: string, key: string, value: string | number) => {
    setForm((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, [key]: value } : item) }))
  }

  const addItem = () => {
    const studentId = form.studentIds[0]
    if (!studentId) {
      setErrors(['Wähle zuerst mindestens ein Kind aus.'])
      return
    }
    setForm((current) => ({ ...current, items: [...current.items, newItem(studentId, current.invoiceDate, settings.privateRate)] }))
  }

  const submit = (finalize: boolean) => {
    const nextErrors: string[] = []
    if (!form.studentIds.length) nextErrors.push('Mindestens ein Kind auswählen.')
    if (!form.guardianIds.length) nextErrors.push('Mindestens eine empfangende Person auswählen.')
    if (!form.invoiceDate || !form.dueDate) nextErrors.push('Rechnungs- und Fälligkeitsdatum angeben.')
    if (!form.period.trim()) nextErrors.push('Leistungszeitraum angeben.')
    if (!form.items.length) nextErrors.push('Mindestens eine Position ergänzen.')
    if (form.items.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0)) nextErrors.push('Alle Positionen vollständig und mit gültigen Werten ausfüllen.')
    setErrors(nextErrors)
    if (!nextErrors.length) onSave(finalized ? { ...form, recipientStrategy: 'joint' } : form, finalize)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={finalized ? `Rechnung ${invoiceNumber ?? ''} bearbeiten` : editing ? 'Entwurf bearbeiten' : 'Neue Rechnung'}
      eyebrow="Rechnungseditor"
      size="large"
      footer={
        <>
          <div className="modal-total"><span>Gesamt</span><strong>{euro.format(total)}</strong></div>
          <button className="button button--text" type="button" onClick={onClose}>Abbrechen</button>
          {finalized ? (
            <button className="button button--primary" type="button" onClick={() => submit(false)}><Save aria-hidden="true" /> Änderungen speichern</button>
          ) : (
            <><button className="button button--tonal" type="button" onClick={() => submit(false)}>Als Entwurf speichern</button><button className="button button--primary" type="button" onClick={() => submit(true)}><Send aria-hidden="true" /> Finalisieren</button></>
          )}
        </>
      }
    >
      <form className="invoice-form" onSubmit={(event) => event.preventDefault()}>
        {finalized && <div className="revision-banner"><FileCheck2 aria-hidden="true" /><div><strong>Finalisierte Rechnung</strong><p>Die Rechnungsnummer bleibt erhalten. Änderungen werden im lokalen Verlauf protokolliert und die Druckansicht wird aktualisiert.</p></div></div>}
        {errors.length > 0 && <div className="form-errors" role="alert"><strong>Bitte noch prüfen:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

        <section className="form-section">
          <div className="form-section__heading"><span>1</span><div><h3>Für wen?</h3><p>Kinder und Rechnungsempfänger auswählen.</p></div></div>
          <fieldset className="chip-fieldset"><legend>Kind(er)</legend><div className="choice-chips">{students.filter((student) => student.active).map((student) => <label className={form.studentIds.includes(student.id) ? 'choice-chip is-selected' : 'choice-chip'} key={student.id}><input type="checkbox" checked={form.studentIds.includes(student.id)} onChange={() => selectStudent(student)} /><span className="avatar">{student.name.slice(0, 1)}</span>{student.name}</label>)}</div>{!students.length && <p className="field-hint field-hint--warning">Lege zuerst unter „Familien“ ein Kind an.</p>}</fieldset>
          <fieldset className="chip-fieldset"><legend>Empfänger</legend><div className="choice-chips">{eligibleGuardians.map((guardian) => <label className={form.guardianIds.includes(guardian.id) ? 'choice-chip is-selected' : 'choice-chip'} key={guardian.id}><input type="checkbox" checked={form.guardianIds.includes(guardian.id)} onChange={() => setForm((current) => ({ ...current, guardianIds: current.guardianIds.includes(guardian.id) ? current.guardianIds.filter((id) => id !== guardian.id) : [...current.guardianIds, guardian.id] }))} /><span className="avatar avatar--warm">{guardian.name.slice(0, 1)}</span>{guardian.name}</label>)}</div></fieldset>
          {form.guardianIds.length > 1 && (finalized ? <p className="field-hint">Die vorhandene Rechnungsnummer bleibt eine gemeinsame Rechnung für die ausgewählten Empfänger:innen.</p> : <fieldset className="segmented-field"><legend>Bei mehreren Empfänger:innen</legend><div className="segmented-control"><label className={form.recipientStrategy === 'joint' ? 'is-selected' : ''}><input type="radio" name="recipient-strategy" checked={form.recipientStrategy === 'joint'} onChange={() => setForm({ ...form, recipientStrategy: 'joint' })} />Eine gemeinsame Rechnung</label><label className={form.recipientStrategy === 'separate' ? 'is-selected' : ''}><input type="radio" name="recipient-strategy" checked={form.recipientStrategy === 'separate'} onChange={() => setForm({ ...form, recipientStrategy: 'separate' })} />Je Person eine Rechnung</label></div><p className="field-hint">Bei getrennten Rechnungen entstehen eigenständige Entwürfe bzw. fortlaufende Nummern.</p></fieldset>)}
        </section>

        <section className="form-section">
          <div className="form-section__heading"><span>2</span><div><h3>Zeitraum & Fälligkeit</h3><p>Die formalen Angaben der Rechnung.</p></div></div>
          <div className="form-grid form-grid--3">
            <label className="field"><span>Rechnungsdatum</span><div className="input-with-icon"><Calendar aria-hidden="true" /><input type="date" value={form.invoiceDate} onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })} /></div></label>
            <label className="field"><span>Fällig am</span><div className="input-with-icon"><Calendar aria-hidden="true" /><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div></label>
            <label className="field"><span>Leistungszeitraum</span><input type="text" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} placeholder="z. B. 3. Quartal 2026" /></label>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__heading form-section__heading--action"><span>3</span><div><h3>Positionen</h3><p>Unterricht, Pauschalen oder sonstige Leistungen.</p></div><button className="button button--tonal" type="button" onClick={addItem}><Plus aria-hidden="true" /> Position</button></div>
          <div className="editor-items">
            {form.items.map((item, index) => (
              <div className="editor-item" key={item.id}>
                <span className="editor-item__number">{String(index + 1).padStart(2, '0')}</span>
                <label className="field field--date"><span>Datum</span><input type="date" value={item.serviceDate} onChange={(event) => updateItem(item.id, 'serviceDate', event.target.value)} /></label>
                <label className="field field--description"><span>Beschreibung</span><input type="text" value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} placeholder="z. B. Akkordwechsel (Einzel)" /></label>
                {form.studentIds.length > 1 && <label className="field"><span>Kind</span><select value={item.studentId} onChange={(event) => updateItem(item.id, 'studentId', event.target.value)}>{form.studentIds.map((id) => <option key={id} value={id}>{students.find((student) => student.id === id)?.name}</option>)}</select></label>}
                <label className="field field--quantity"><span>Menge</span><input type="number" min="0.01" step="0.25" value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', Number(event.target.value))} /></label>
                <label className="field field--unit"><span>Einheit</span><select value={item.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)}><option>Std.</option><option>Pauschale</option><option>Stück</option></select></label>
                <label className="field field--price"><span>Einzelpreis</span><div className="input-with-suffix"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, 'unitPrice', Number(event.target.value))} /><span>€</span></div></label>
                <div className="editor-item__total"><span>Betrag</span><strong>{euro.format(itemTotal(item))}</strong></div>
                <button className="icon-button icon-button--small editor-item__delete" type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }))} aria-label={`Position ${index + 1} löschen`}><Trash2 aria-hidden="true" /></button>
              </div>
            ))}
            {!form.items.length && <button className="add-position-placeholder" type="button" onClick={addItem}><CircleDollarSign aria-hidden="true" /><strong>Erste Position ergänzen</strong><span>Datum, Thema, Menge und Preis erfassen</span></button>}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__heading"><span>4</span><div><h3>Textbausteine</h3><p>Individuelle Hinweise für diese Rechnung.</p></div></div>
          <div className="form-grid form-grid--2">
            <label className="field"><span>Einleitung</span><textarea rows={4} value={form.introText} onChange={(event) => setForm({ ...form, introText: event.target.value })} /></label>
            <label className="field"><span>Freitext / Hinweis</span><textarea rows={4} value={form.freeText} onChange={(event) => setForm({ ...form, freeText: event.target.value })} placeholder="Optional" /></label>
            <label className="field field--full"><span>Rechtstext</span><textarea rows={2} value={form.legalText} onChange={(event) => setForm({ ...form, legalText: event.target.value })} /></label>
          </div>
        </section>
      </form>
    </Modal>
  )
}

function newItem(studentId: string, date: string, rate: number) {
  return {
    id: uid('item'),
    studentId,
    serviceDate: date,
    description: 'Gitarrenunterricht (Einzel)',
    quantity: 1,
    unit: 'Std.' as const,
    unitPrice: rate,
  }
}
