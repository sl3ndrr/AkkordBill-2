import type { AppState, Student } from '../types'
import { emptyState } from './defaults'
import { ensureStudentCodePattern, studentCodeForIndex, studentCodeIndex } from './utils'

const STORAGE_KEY = 'gitarrenrechnungen-state-v2'
const DB_NAME = 'gitarrenrechnungen-handles'
const HANDLE_KEY = 'backup-directory'

function normalizeStudents(students: Student[], declaredNextIndex = 0): { students: Student[]; nextStudentCodeIndex: number } {
  const used = new Set<string>()
  let cursor = 0
  let highestIndex = -1
  const normalized = students.map((student) => {
    const requestedCode = typeof student.billingCode === 'string' ? student.billingCode.trim().toLowerCase() : ''
    let billingCode = requestedCode
    if (studentCodeIndex(billingCode) < 0 || used.has(billingCode)) {
      while (used.has(studentCodeForIndex(cursor))) cursor += 1
      billingCode = studentCodeForIndex(cursor)
    }
    used.add(billingCode)
    const index = studentCodeIndex(billingCode)
    highestIndex = Math.max(highestIndex, index)
    cursor = Math.max(cursor, index + 1)
    return { ...student, billingCode }
  })
  return {
    students: normalized,
    nextStudentCodeIndex: Math.max(0, declaredNextIndex, highestIndex + 1),
  }
}

function normalizeState(data: Partial<AppState>): AppState {
  const base = emptyState()
  const normalizedStudents = normalizeStudents(Array.isArray(data.students) ? data.students : [], data.nextStudentCodeIndex)
  const incomingSettings = data.settings ?? base.settings
  return {
    ...base,
    ...data,
    guardians: Array.isArray(data.guardians) ? data.guardians : [],
    students: normalizedStudents.students,
    invoices: Array.isArray(data.invoices) ? data.invoices : [],
    voidedInvoiceNumbers: Array.isArray(data.voidedInvoiceNumbers) ? data.voidedInvoiceNumbers : [],
    settings: {
      ...base.settings,
      ...incomingSettings,
      issuer: { ...base.settings.issuer, ...incomingSettings.issuer },
      numberPattern: ensureStudentCodePattern(incomingSettings.numberPattern),
    },
    counters: data.counters ?? {},
    nextStudentCodeIndex: normalizedStudents.nextStudentCodeIndex,
    audit: Array.isArray(data.audit) ? data.audit : [],
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.guardians) || !Array.isArray(parsed.students)) {
      return emptyState()
    }
    return normalizeState(parsed)
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function serializeBackup(state: AppState): string {
  return JSON.stringify({
    app: 'riffrechnung',
    exportedAt: new Date().toISOString(),
    schemaVersion: state.schemaVersion,
    data: state,
  }, null, 2)
}

export function parseBackup(text: string): AppState {
  const parsed = JSON.parse(text) as { app?: string; schemaVersion?: number; data?: AppState } | AppState
  const data = 'data' in parsed && parsed.data ? parsed.data : parsed as AppState
  if (data.schemaVersion !== 2 || !Array.isArray(data.guardians) || !Array.isArray(data.students) || !Array.isArray(data.invoices)) {
    throw new Error('Die Datei hat kein unterstütztes Backup-Format.')
  }
  const normalized = normalizeState(data)
  const voidedInvoiceNumbers = normalized.voidedInvoiceNumbers
  const numbers = [...data.invoices.map((invoice) => invoice.number), ...voidedInvoiceNumbers.map((invoice) => invoice.number)].filter(Boolean)
  if (new Set(numbers).size !== numbers.length) {
    throw new Error('Das Backup enthält doppelte Rechnungsnummern.')
  }
  return { ...normalized, updatedAt: new Date().toISOString() }
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('handles')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function readDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb()
    const value = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly')
      const request = tx.objectStore('handles').get(HANDLE_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return value
  } catch {
    return null
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openHandleDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    tx.objectStore('handles').delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function ensureWritePermission(handle: FileSystemDirectoryHandle, request = false): Promise<boolean> {
  const options = { mode: 'readwrite' as const }
  if (await handle.queryPermission?.(options) === 'granted') return true
  if (request && await handle.requestPermission?.(options) === 'granted') return true
  return false
}

export async function writeBackupToDirectory(handle: FileSystemDirectoryHandle, state: AppState): Promise<void> {
  const fileHandle = await handle.getFileHandle('riffrechnung-backup.json', { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(serializeBackup(state))
  await writable.close()
}
