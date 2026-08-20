import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Invoice, Student } from '../src/types'
import changelog from '../src/content/changelog.json'
import { InvoicePrint } from '../src/components/InvoicePrint'
import { defaultSettings, emptyState } from '../src/lib/defaults'
import { type InvoiceMenuAction, runInvoiceMenuAction } from '../src/lib/invoiceMenu'
import { loadLastBackupAt, loadState, parseBackup, recordBackupExport, saveState, serializeBackup } from '../src/lib/storage'
import { applyLessonType, billingPeriodFromItems, buildEpcPayload, calculateDueDate, createLessonItem, effectiveStatus, ensureStudentCodePattern, formatDateLong, formatInvoiceNumber, isValidIban, nextInvoiceAllocation, studentCodeForIndex } from '../src/lib/utils'
import { APP_VERSION } from '../src/version'

const student = (id: string, name: string, billingCode: string): Student => ({
  id,
  name,
  billingCode,
  guardianIds: [],
  note: '',
  active: true,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
})

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'invoice-test',
  number: '2026-a-0001',
  sequence: 1,
  year: 2026,
  invoiceDate: '2026-08-01',
  dueDate: '2026-08-15',
  period: 'August 2026',
  status: 'sent',
  guardianIds: [],
  studentIds: ['student-a'],
  recipientStrategy: 'joint',
  items: [],
  introText: '',
  freeText: '',
  legalText: '',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...overrides,
})

function withMockLocalStorage(run: () => void): void {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const entries = new Map<string, string>()
  const localStorageMock: Storage = {
    get length() { return entries.size },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock })

  try {
    run()
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

test('konfigurierbare Rechnungsnummern werden korrekt formatiert', () => {
  assert.equal(formatInvoiceNumber(defaultSettings, 23, 2026, 'a'), '2026-a-0023')
  assert.equal(formatInvoiceNumber({ ...defaultSettings, numberPattern: 'RG-{YY}-{NNN}' }, 7, 2026, 'b'), 'RG-26-b-007')
  assert.equal(formatInvoiceNumber({ ...defaultSettings, numberPattern: 'RG-{YYYY}' }, 7, 2026, 'c'), 'RG-2026-c-0007')
  assert.equal(ensureStudentCodePattern('{YYYY}-{NNNN}'), '{YYYY}-{K}-{NNNN}')
  assert.equal(studentCodeForIndex(0), 'a')
  assert.equal(studentCodeForIndex(26), 'aa')
})

test('jedes Kind erhält einen eigenen fortlaufenden Nummernkreis', () => {
  const state = emptyState()
  state.students = [student('student-a', 'Anna', 'a'), student('student-b', 'Ben', 'b')]
  state.invoices = [invoice()]
  state.counters = { '2026:a': 2 }
  assert.deepEqual(nextInvoiceAllocation(state, '2026-08-01', ['student-a']), { number: '2026-a-0002', sequence: 2, counterKey: '2026:a' })
  assert.deepEqual(nextInvoiceAllocation(state, '2026-08-01', ['student-b']), { number: '2026-b-0001', sequence: 1, counterKey: '2026:b' })
  assert.deepEqual(nextInvoiceAllocation(state, '2026-08-01', ['student-b', 'student-a']), { number: '2026-ab-0001', sequence: 1, counterKey: '2026:ab' })
})

test('gelöschte finalisierte Rechnungsnummern bleiben reserviert', () => {
  const state = emptyState()
  state.students = [student('student-a', 'Anna', 'a')]
  state.counters = { '2026:a': 1 }
  state.voidedInvoiceNumbers = [{
    number: '2026-a-0001',
    sequence: 1,
    year: 2026,
    invoiceDate: '2026-08-01',
    deletedAt: '2026-08-20T12:00:00.000Z',
    amount: 120,
    recipient: 'Testfamilie',
  }]
  assert.equal(nextInvoiceAllocation(state, '2026-08-21', ['student-a']).number, '2026-a-0002')
})

test('IBAN-Prüfsumme wird validiert', () => {
  assert.equal(isValidIban('DE02 1203 0000 0000 2020 51'), true)
  assert.equal(isValidIban('DE02 1203 0000 0000 2020 52'), false)
})

test('EPC-Payload enthält Version, Betrag und Rechnungsnummer', () => {
  const settings = { ...defaultSettings, accountHolder: 'Mara Beispiel', iban: 'DE02120300000000202051', bic: 'BYLADEM1001' }
  const payload = buildEpcPayload(invoice(), settings, 125.5)
  assert.deepEqual(payload.split('\n').slice(0, 4), ['BCD', '002', '1', 'SCT'])
  assert.match(payload, /EUR125\.50/)
  assert.match(payload, /Rechnung 2026-a-0001/)
})

test('versendete Rechnung wird nach Fälligkeit als überfällig erkannt', () => {
  assert.equal(effectiveStatus(invoice(), new Date('2026-08-20T12:00:00')), 'overdue')
  assert.equal(effectiveStatus(invoice({ status: 'paid' }), new Date('2026-08-20T12:00:00')), 'paid')
})

test('Solo- und Duo-Positionen übernehmen die aktuell konfigurierten Standardpreise', () => {
  assert.equal(defaultSettings.privateRate, 30)
  assert.equal(defaultSettings.duoRate, 20)
  const settings = { ...defaultSettings, privateRate: 34, duoRate: 22 }
  const solo = createLessonItem('student-a', '2026-08-05', settings, 'item-test')
  assert.equal(solo.lessonType, 'solo')
  assert.equal(solo.description, 'Gitarrenunterricht (Solo)')
  assert.equal(solo.unitPrice, 34)

  const duo = applyLessonType({ ...solo, description: 'Akkordwechsel (Solo)' }, 'duo', settings)
  assert.equal(duo.lessonType, 'duo')
  assert.equal(duo.description, 'Akkordwechsel (Duo)')
  assert.equal(duo.unitPrice, 22)

  const manuallyOverridden = { ...duo, unitPrice: 27 }
  const changedSettings = { ...settings, privateRate: 40, duoRate: 25 }
  assert.equal(manuallyOverridden.unitPrice, 27)
  assert.equal(createLessonItem('student-a', '2026-08-12', changedSettings, 'item-new').unitPrice, 40)
})

test('Abrechnungszeitraum und Fälligkeit werden aus Positions- und Rechnungsdaten berechnet', () => {
  assert.equal(billingPeriodFromItems([{ serviceDate: '2026-08-02' }, { serviceDate: '2026-08-28' }]), 'August 2026')
  assert.equal(billingPeriodFromItems([{ serviceDate: '2026-08-28' }, { serviceDate: '2026-10-02' }]), 'August bis Oktober 2026')
  assert.equal(billingPeriodFromItems([{ serviceDate: '2026-12-28' }, { serviceDate: '2027-01-08' }]), 'Dezember 2026 bis Januar 2027')
  assert.equal(calculateDueDate('2026-08-01', 14), '2026-08-15')
})

test('Rechnungsdokument druckt automatisch berechneten Zeitraum und Fälligkeit', () => {
  const item = createLessonItem('student-a', '2026-08-05', defaultSettings, 'item-print')
  const testInvoice = invoice({
    dueDate: calculateDueDate('2026-08-01', defaultSettings.paymentTermDays),
    period: 'Nicht verwenden',
    items: [item],
  })
  assert.equal(billingPeriodFromItems(testInvoice.items, testInvoice.invoiceDate), 'August 2026')
  assert.equal(formatDateLong(testInvoice.dueDate), '15. August 2026')
})

test('Druck-Testrechnung mit 24 Positionen nutzt mehrseitige Schutzregeln', () => {
  const items = Array.from({ length: 24 }, (_, index) => createLessonItem(
    'student-a',
    index < 12 ? `2026-08-${String(index + 1).padStart(2, '0')}` : `2026-09-${String(index - 11).padStart(2, '0')}`,
    defaultSettings,
    `item-print-${index}`,
  ))
  assert.equal(items.length, 24)
  assert.equal(billingPeriodFromItems(items), 'August bis September 2026')

  const markup = renderToStaticMarkup(createElement(InvoicePrint, {
    invoice: invoice({ items }),
    guardians: [],
    students: [student('student-a', 'Anna', 'a')],
    settings: defaultSettings,
  }))
  assert.equal(markup.match(/class="invoice-item-row(?:\s|")/g)?.length, 24)
  assert.match(markup, /August bis September 2026/)
  assert.match(markup, /August 2026/)
  assert.match(markup, /September 2026/)
  assert.ok(markup.indexOf('invoice-footer') > markup.lastIndexOf('</table>'))
  assert.doesNotMatch(markup, /Seite 1 von 1/)

  const stylesheet = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(stylesheet, /\.invoice-table tr \{ break-inside: avoid; page-break-inside: avoid; \}/)
  assert.match(stylesheet, /@page \{ size: A4 portrait; margin: 16mm 20mm 14mm; \}/)
  assert.match(stylesheet, /\.invoice-footer \{ position: static;/)
  assert.doesNotMatch(stylesheet, /page-break-after: always/)
  assert.doesNotMatch(stylesheet, /\.invoice-footer \{ position: fixed;/)
})

test('alle Kebab-Menü-Aktionen werden an den vorgesehenen Handler weitergeleitet', () => {
  const calls: string[] = []
  const handlers = {
    onEdit: (value: Invoice) => calls.push(`edit:${value.id}`),
    onPrint: (value: Invoice) => calls.push(`pdf:${value.id}`),
    onDuplicate: (value: Invoice) => calls.push(`duplicate:${value.id}`),
    onDelete: (value: Invoice) => calls.push(`delete:${value.id}`),
  }
  const actions: InvoiceMenuAction[] = ['edit', 'pdf', 'duplicate', 'delete']
  actions.forEach((action) => runInvoiceMenuAction(action, invoice(), handlers))
  assert.deepEqual(calls, ['edit:invoice-test', 'pdf:invoice-test', 'duplicate:invoice-test', 'delete:invoice-test'])
})

test('vollständiges Backup lässt sich wiederherstellen', () => {
  const state = emptyState()
  state.settings.issuer.name = 'Test Unterricht'
  state.students.push(student('student-a', 'Anna', 'a'))
  state.nextStudentCodeIndex = 1
  state.voidedInvoiceNumbers.push({ number: '2026-a-0004', sequence: 4, year: 2026, invoiceDate: '2026-08-01', deletedAt: '2026-08-20T12:00:00.000Z', amount: 90, recipient: 'Testfamilie' })
  const restored = parseBackup(serializeBackup(state))
  assert.equal(restored.schemaVersion, 2)
  assert.equal(restored.settings.issuer.name, 'Test Unterricht')
  assert.equal(restored.students[0]?.billingCode, 'a')
  assert.equal(restored.voidedInvoiceNumbers[0]?.number, '2026-a-0004')
})

test('ältere Backups erhalten stabile Kinderkennzeichen in Speicherreihenfolge', () => {
  const legacy = JSON.parse(serializeBackup(emptyState()))
  legacy.data.students = [student('student-a', 'Anna', ''), student('student-b', 'Ben', '')]
  legacy.data.settings.numberPattern = '{YYYY}-{NNNN}'
  delete legacy.data.nextStudentCodeIndex
  const restored = parseBackup(JSON.stringify(legacy))
  assert.deepEqual(restored.students.map((item) => item.billingCode), ['a', 'b'])
  assert.equal(restored.nextStudentCodeIndex, 2)
  assert.equal(restored.settings.numberPattern, '{YYYY}-{K}-{NNNN}')
})

test('ältere Rechnungspositionen erhalten einen Typ ohne Preis- oder Titeländerung', () => {
  const state = emptyState()
  state.invoices = [invoice({
    items: [{
      ...createLessonItem('student-a', '2026-08-05', defaultSettings, 'legacy-item'),
      lessonType: 'duo',
      description: 'Gitarrenunterricht (Duo)',
      unitPrice: 17,
    }],
  })]
  const legacy = JSON.parse(serializeBackup(state))
  delete legacy.data.invoices[0].items[0].lessonType
  const restoredItem = parseBackup(JSON.stringify(legacy)).invoices[0]?.items[0]
  assert.equal(restoredItem?.lessonType, 'duo')
  assert.equal(restoredItem?.description, 'Gitarrenunterricht (Duo)')
  assert.equal(restoredItem?.unitPrice, 17)
})

test('manuelle Theme-Auswahl bleibt nach einem Reload erhalten', () => {
  withMockLocalStorage(() => {
    const state = emptyState()
    state.settings.theme = 'dark'
    saveState(state)
    assert.equal(loadState().settings.theme, 'dark')
  })
})

test('Zeitpunkt des letzten Backup-Exports wird persistiert', () => {
  withMockLocalStorage(() => {
    assert.equal(loadLastBackupAt(), null)
    const exportedAt = recordBackupExport(new Date('2026-08-20T12:32:00.000Z'))
    assert.equal(exportedAt, '2026-08-20T12:32:00.000Z')
    assert.equal(loadLastBackupAt(), exportedAt)
  })
})

test('sichtbare App-Version und neuester Changelog-Eintrag sind 1.0.3', () => {
  assert.equal(APP_VERSION, '1.0.3')
  assert.ok(Array.isArray(changelog))
  assert.equal(changelog[0]?.version, APP_VERSION)
  assert.ok((changelog[0]?.changes.length ?? 0) >= 2)
  assert.ok(changelog.length >= 2)
})

test('nicht unterstütztes Backup wird abgelehnt', () => {
  assert.throws(() => parseBackup('{"schemaVersion":99}'), /unterstütztes Backup-Format/)
})
