import test from 'node:test'
import assert from 'node:assert/strict'
import type { Invoice, Student } from '../src/types'
import { defaultSettings, emptyState } from '../src/lib/defaults'
import { parseBackup, serializeBackup } from '../src/lib/storage'
import { buildEpcPayload, effectiveStatus, ensureStudentCodePattern, formatInvoiceNumber, isValidIban, nextInvoiceAllocation, studentCodeForIndex } from '../src/lib/utils'
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

test('sichtbare App-Version ist 1.0.2', () => {
  assert.equal(APP_VERSION, '1.0.2')
})

test('nicht unterstütztes Backup wird abgelehnt', () => {
  assert.throws(() => parseBackup('{"schemaVersion":99}'), /unterstütztes Backup-Format/)
})
