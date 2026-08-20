import type { AppState, InvoiceDraft, Settings } from '../types'

const today = new Date()

export const defaultSettings: Settings = {
  issuer: {
    name: '',
    street: '',
    postalCode: '',
    city: '',
    email: '',
    phone: '',
  },
  accountHolder: '',
  iban: '',
  bic: '',
  bankName: '',
  privateRate: 30,
  duoRate: 20,
  numberPattern: '{YYYY}-{K}-{NNNN}',
  resetNumberAnnually: true,
  paymentTermDays: 14,
  defaultLegalText: 'Umsatzsteuerbefreit gemäß § 19 UStG (Kleinunternehmerregelung).',
  theme: 'system',
  reducedMotion: false,
}

export function emptyState(): AppState {
  return {
    schemaVersion: 2,
    guardians: [],
    students: [],
    invoices: [],
    voidedInvoiceNumbers: [],
    settings: structuredClone(defaultSettings),
    counters: {},
    nextStudentCodeIndex: 0,
    audit: [],
    updatedAt: new Date().toISOString(),
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function createEmptyInvoiceDraft(settings: Settings): InvoiceDraft {
  const invoiceDate = new Date()
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + settings.paymentTermDays)
  const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(invoiceDate)

  return {
    invoiceDate: isoDate(invoiceDate),
    dueDate: isoDate(dueDate),
    period: monthName,
    guardianIds: [],
    studentIds: [],
    recipientStrategy: 'joint',
    items: [],
    introText: 'Hiermit stelle ich die Unterrichtseinheiten im Fach Gitarre für den genannten Zeitraum in Rechnung.',
    freeText: '',
    legalText: settings.defaultLegalText,
  }
}

export function createDemoState(): AppState {
  const now = new Date().toISOString()
  const year = today.getFullYear()
  const guardianA = {
    id: 'guardian-demo-a',
    name: 'Claudia Winter',
    email: 'claudia.winter@example.de',
    phone: '',
    address: { street: 'Lindenweg 8', postalCode: '50667', city: 'Köln' },
    iban: '',
    paymentNote: '',
    createdAt: now,
    updatedAt: now,
  }
  const guardianB = {
    id: 'guardian-demo-b',
    name: 'Daniel Özdemir',
    email: 'daniel.oezdemir@example.de',
    phone: '',
    address: { street: 'Rosenstraße 14', postalCode: '50670', city: 'Köln' },
    iban: '',
    paymentNote: '',
    createdAt: now,
    updatedAt: now,
  }
  const studentA = {
    id: 'student-demo-a',
    name: 'Lina Winter',
    billingCode: 'a',
    guardianIds: [guardianA.id],
    note: 'Einzelunterricht · Mittwoch',
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const studentB = {
    id: 'student-demo-b',
    name: 'Emir Özdemir',
    billingCode: 'b',
    guardianIds: [guardianB.id],
    note: 'Duo-Unterricht · Freitag',
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const settings = structuredClone(defaultSettings)
  settings.issuer = {
    name: 'Mara Beispiel',
    street: 'Gitarrenweg 12',
    postalCode: '50674',
    city: 'Köln',
    email: 'unterricht@example.de',
    phone: '+49 221 123456',
  }
  settings.accountHolder = 'Mara Beispiel'
  settings.iban = 'DE02120300000000202051'
  settings.bic = 'BYLADEM1001'
  settings.bankName = 'Deutsche Kreditbank'

  const mkInvoice = (id: string, number: string, guardianId: string, studentId: string, studentName: string, status: 'sent' | 'paid', amount: number, monthOffset: number) => {
    const date = new Date(year, today.getMonth() - monthOffset, 2)
    const due = new Date(date)
    due.setDate(due.getDate() + 14)
    const lessonType = studentId === studentB.id ? 'duo' as const : 'solo' as const
    const unitPrice = lessonType === 'duo' ? settings.duoRate : settings.privateRate
    return {
      id,
      number,
      sequence: Number(number.split('-').at(-1)),
      year,
      invoiceDate: isoDate(date),
      dueDate: isoDate(due),
      period: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date),
      status,
      guardianIds: [guardianId],
      studentIds: [studentId],
      recipientStrategy: 'joint' as const,
      items: [{
        id: `${id}-item`,
        studentId,
        serviceDate: isoDate(date),
        lessonType,
        description: `${monthOffset === 0 ? 'Gitarrenunterricht · Monatsübersicht' : 'Gitarrenunterricht'} (${lessonType === 'duo' ? 'Duo' : 'Solo'})`,
        quantity: amount / unitPrice,
        unit: 'Std.' as const,
        unitPrice,
      }],
      introText: 'Hiermit stelle ich die Unterrichtseinheiten im Fach Gitarre für den genannten Zeitraum in Rechnung.',
      freeText: '',
      legalText: settings.defaultLegalText,
      snapshot: {
        issuer: settings.issuer,
        guardians: [{
          ...(guardianId === guardianA.id ? guardianA.address : guardianB.address),
          id: guardianId,
          name: guardianId === guardianA.id ? guardianA.name : guardianB.name,
          email: guardianId === guardianA.id ? guardianA.email : guardianB.email,
        }],
        students: [{ id: studentId, name: studentName }],
        accountHolder: settings.accountHolder,
        iban: settings.iban,
        bic: settings.bic,
        bankName: settings.bankName,
        legalText: settings.defaultLegalText,
      },
      sentAt: now,
      ...(status === 'paid' ? { paidAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    }
  }

  return {
    schemaVersion: 2,
    guardians: [guardianA, guardianB],
    students: [studentA, studentB],
    invoices: [
      mkInvoice('invoice-demo-1', `${year}-a-0001`, guardianA.id, studentA.id, studentA.name, 'paid', 120, 2),
      mkInvoice('invoice-demo-2', `${year}-b-0001`, guardianB.id, studentB.id, studentB.name, 'sent', 90, 1),
    ],
    voidedInvoiceNumbers: [],
    settings,
    counters: { [`${year}:a`]: 2, [`${year}:b`]: 2 },
    nextStudentCodeIndex: 2,
    audit: [{ id: crypto.randomUUID(), at: now, label: 'Beispieldaten angelegt', entityType: 'system' }],
    updatedAt: now,
  }
}
