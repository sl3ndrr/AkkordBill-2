import type { AppState, Guardian, Invoice, InvoiceItem, InvoiceStatus, Settings, Student } from '../types'

export const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const dateLong = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
export const dateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })

export function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function formatDate(value: string): string {
  if (!value) return '–'
  const parsed = parseDate(value)
  return Number.isNaN(parsed.getTime()) ? value : dateShort.format(parsed)
}

export function formatDateLong(value: string): string {
  if (!value) return '–'
  const parsed = parseDate(value)
  return Number.isNaN(parsed.getTime()) ? value : dateLong.format(parsed)
}

export function invoiceTotal(invoice: Pick<Invoice, 'items'>): number {
  return invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function itemTotal(item: InvoiceItem): number {
  return item.quantity * item.unitPrice
}

export function effectiveStatus(invoice: Invoice, reference = new Date()): InvoiceStatus {
  if (invoice.status === 'sent' && invoice.dueDate && parseDate(invoice.dueDate).getTime() < reference.getTime()) {
    return 'overdue'
  }
  return invoice.status
}

export const statusLabel: Record<InvoiceStatus, string> = {
  draft: 'Entwurf',
  sent: 'Versendet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
}

export function guardianName(invoice: Invoice, guardians: Guardian[]): string {
  const snapshot = invoice.snapshot?.guardians.map((item) => item.name).filter(Boolean)
  if (snapshot?.length) return snapshot.join(' & ')
  const names = invoice.guardianIds
    .map((id) => guardians.find((guardian) => guardian.id === id)?.name)
    .filter(Boolean)
  return names.join(' & ') || 'Ohne Empfänger'
}

export function studentName(invoice: Invoice, students: Student[]): string {
  const snapshot = invoice.snapshot?.students.map((item) => item.name).filter(Boolean)
  if (snapshot?.length) return snapshot.join(', ')
  const names = invoice.studentIds
    .map((id) => students.find((student) => student.id === id)?.name)
    .filter(Boolean)
  return names.join(', ') || 'Ohne Kind'
}

export function formatInvoiceNumber(settings: Settings, sequence: number, year: number): string {
  const hasSequence = /\{N+\}/.test(settings.numberPattern)
  const formatted = settings.numberPattern
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{YY}', String(year).slice(-2))
    .replace(/\{(N+)\}/g, (_match, digits: string) => String(sequence).padStart(digits.length, '0'))
  return hasSequence ? formatted : `${formatted}-${String(sequence).padStart(4, '0')}`
}

export function nextInvoiceAllocation(state: AppState, invoiceDate: string): { number: string; sequence: number; counterKey: string } {
  const year = parseDate(invoiceDate).getFullYear()
  const counterKey = state.settings.resetNumberAnnually ? String(year) : 'global'
  let sequence = Math.max(1, state.counters[counterKey] ?? 1)
  let candidate = formatInvoiceNumber(state.settings, sequence, year)
  const used = new Set([
    ...state.invoices.map((invoice) => invoice.number),
    ...state.voidedInvoiceNumbers.map((invoice) => invoice.number),
  ].filter(Boolean))
  while (used.has(candidate)) {
    sequence += 1
    candidate = formatInvoiceNumber(state.settings, sequence, year)
  }
  return { number: candidate, sequence, counterKey }
}

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function cleanIban(value: string): string {
  return value.replace(/\s/g, '').toUpperCase()
}

export function formatIban(value: string): string {
  return cleanIban(value).replace(/(.{4})/g, '$1 ').trim()
}

export function isValidIban(input: string): boolean {
  const iban = cleanIban(input)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

function sanitizeEpc(value: string, maxLength: number): string {
  return value.replace(/[\r\n]/g, ' ').trim().slice(0, maxLength)
}

export function buildEpcPayload(invoice: Invoice, settings: Settings, amount: number): string {
  const source = invoice.snapshot
  const name = source?.accountHolder || settings.accountHolder || source?.issuer.name || settings.issuer.name
  const iban = cleanIban(source?.iban || settings.iban)
  const bic = (source?.bic || settings.bic).replace(/\s/g, '').toUpperCase()
  const purpose = invoice.number ? `Rechnung ${invoice.number}` : 'Rechnung Entwurf'
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    sanitizeEpc(bic, 11),
    sanitizeEpc(name, 70),
    iban,
    `EUR${amount.toFixed(2)}`,
    '',
    '',
    sanitizeEpc(purpose, 140),
    '',
  ].join('\n')
}

export function downloadText(filename: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number): string {
  const normalized = String(value).replaceAll('"', '""')
  return `"${normalized}"`
}

export function invoicesToCsv(invoices: Invoice[], guardians: Guardian[], students: Student[]): string {
  const header = ['Rechnungsnummer', 'Datum', 'Zeitraum', 'Empfänger', 'Kind(er)', 'Status', 'Netto/Gesamt EUR', 'Bezahlt am']
  const rows = invoices
    .filter((invoice) => invoice.number)
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
    .map((invoice) => [
      invoice.number ?? '',
      invoice.invoiceDate,
      invoice.period,
      guardianName(invoice, guardians),
      studentName(invoice, students),
      statusLabel[effectiveStatus(invoice)],
      invoiceTotal(invoice).toFixed(2).replace('.', ','),
      invoice.paidAt?.slice(0, 10) ?? '',
    ])
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`
}

export function createReminder(invoice: Invoice, guardians: Guardian[], students: Student[]): { subject: string; body: string; recipients: string[] } {
  const names = guardianName(invoice, guardians)
  const child = studentName(invoice, students)
  const numberText = invoice.number ?? 'Entwurf'
  const snapshotEmails = invoice.snapshot?.guardians.map((guardian) => guardian.email).filter(Boolean) ?? []
  const liveEmails = invoice.guardianIds
    .map((id) => guardians.find((guardian) => guardian.id === id)?.email)
    .filter((email): email is string => Boolean(email))
  const recipients = snapshotEmails.length ? snapshotEmails : liveEmails
  const subject = `Zahlungserinnerung zur Rechnung ${numberText}`
  const body = `Guten Tag ${names},\n\nbei der Durchsicht meiner Unterlagen ist mir aufgefallen, dass die Rechnung ${numberText} für den Gitarrenunterricht von ${child} über ${euro.format(invoiceTotal(invoice))} mit Fälligkeit zum ${formatDateLong(invoice.dueDate)} noch offen ist.\n\nFalls die Zahlung bereits veranlasst wurde, betrachten Sie diese Nachricht bitte als gegenstandslos. Andernfalls freue ich mich über eine zeitnahe Überweisung unter Angabe der Rechnungsnummer.\n\nVielen Dank und freundliche Grüße`
  return { subject, body, recipients }
}

export function mailtoUrl(invoice: Invoice, guardians: Guardian[], students: Student[]): string {
  const reminder = createReminder(invoice, guardians, students)
  return `mailto:${reminder.recipients.join(',')}?subject=${encodeURIComponent(reminder.subject)}&body=${encodeURIComponent(reminder.body)}`
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(new Date(year, month - 1, 1)).replace('.', '')
}

export function groupItemsByStudent(items: InvoiceItem[], studentIds: string[]): Array<[string, InvoiceItem[]]> {
  const known = new Set(studentIds)
  const groups = new Map<string, InvoiceItem[]>()
  for (const item of items) {
    const key = known.has(item.studentId) ? item.studentId : studentIds[0] ?? ''
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()]
}
