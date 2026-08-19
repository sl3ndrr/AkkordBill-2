import type { AppState } from '../types'
import { emptyState } from './defaults'

const STORAGE_KEY = 'gitarrenrechnungen-state-v2'
const DB_NAME = 'gitarrenrechnungen-handles'
const HANDLE_KEY = 'backup-directory'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.guardians) || !Array.isArray(parsed.students)) {
      return emptyState()
    }
    return {
      ...emptyState(),
      ...parsed,
      voidedInvoiceNumbers: Array.isArray(parsed.voidedInvoiceNumbers) ? parsed.voidedInvoiceNumbers : [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function serializeBackup(state: AppState): string {
  return JSON.stringify({
    app: 'gitarrenrechnungen',
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
  const voidedInvoiceNumbers = Array.isArray(data.voidedInvoiceNumbers) ? data.voidedInvoiceNumbers : []
  const numbers = [...data.invoices.map((invoice) => invoice.number), ...voidedInvoiceNumbers.map((invoice) => invoice.number)].filter(Boolean)
  if (new Set(numbers).size !== numbers.length) {
    throw new Error('Das Backup enthält doppelte Rechnungsnummern.')
  }
  return { ...emptyState(), ...data, voidedInvoiceNumbers, updatedAt: new Date().toISOString() }
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
  const fileHandle = await handle.getFileHandle('gitarrenrechnungen-backup.json', { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(serializeBackup(state))
  await writable.close()
}
