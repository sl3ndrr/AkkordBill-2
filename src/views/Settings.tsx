import { useEffect, useState } from 'react'
import { ArchiveRestore, CheckCircle2, CloudOff, Download, FileJson, FolderSync, HardDrive, History, Moon, Palette, Save, ShieldCheck, Sun, Upload } from 'lucide-react'
import type { AppState, Settings as SettingsType, ThemeMode } from '../types'
import { formatInvoiceNumber, formatIban, isValidIban } from '../lib/utils'

interface SettingsProps {
  state: AppState
  folderSupported: boolean
  folderConnected: boolean
  folderName: string
  onSave: (settings: SettingsType) => void
  onExport: () => void
  onImport: (file: File) => void
  onConnectFolder: () => void
  onDisconnectFolder: () => void
  onBackupNow: () => void
  onReset: () => void
}

export function Settings({ state, folderSupported, folderConnected, folderName, onSave, onExport, onImport, onConnectFolder, onDisconnectFolder, onBackupNow, onReset }: SettingsProps) {
  const [form, setForm] = useState<SettingsType>(state.settings)
  const [saved, setSaved] = useState(false)
  useEffect(() => setForm(state.settings), [state.settings])

  const save = () => {
    onSave(form)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }
  const setTheme = (theme: ThemeMode) => {
    const next = { ...form, theme }
    setForm(next)
    onSave(next)
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div><p className="eyebrow">Konfiguration</p><h1>Einstellungen</h1><p>Absender, Konto, Nummernkreis, Darstellung und Datensicherung.</p></div>
        <button className={`button ${saved ? 'button--success' : 'button--primary'} button--large`} onClick={save}>{saved ? <CheckCircle2 aria-hidden="true" /> : <Save aria-hidden="true" />}{saved ? 'Gespeichert' : 'Änderungen speichern'}</button>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Einstellungsbereiche"><a href="#profile">Rechnungssteller</a><a href="#payment">Bankverbindung</a><a href="#numbering">Rechnungen</a><a href="#appearance">Darstellung</a><a href="#backup">Backup & Import</a><a href="#history">Änderungsverlauf</a></nav>
        <div className="settings-content">
          <section id="profile" className="surface settings-section">
            <div className="settings-section__heading"><span><ShieldCheck aria-hidden="true" /></span><div><h2>Rechnungssteller</h2><p>Diese Angaben erscheinen im Briefkopf und werden beim Finalisieren eingefroren.</p></div></div>
            <div className="form-grid form-grid--2">
              <label className="field field--full"><span>Name / Geschäftsbezeichnung</span><input value={form.issuer.name} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, name: event.target.value } })} /></label>
              <label className="field field--full"><span>Straße & Hausnummer</span><input value={form.issuer.street} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, street: event.target.value } })} /></label>
              <label className="field"><span>PLZ</span><input value={form.issuer.postalCode} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, postalCode: event.target.value } })} /></label>
              <label className="field"><span>Ort</span><input value={form.issuer.city} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, city: event.target.value } })} /></label>
              <label className="field"><span>E-Mail</span><input type="email" value={form.issuer.email} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, email: event.target.value } })} /></label>
              <label className="field"><span>Telefon</span><input type="tel" value={form.issuer.phone} onChange={(event) => setForm({ ...form, issuer: { ...form.issuer, phone: event.target.value } })} /></label>
            </div>
          </section>

          <section id="payment" className="surface settings-section">
            <div className="settings-section__heading"><span><HardDrive aria-hidden="true" /></span><div><h2>Bankverbindung & GiroCode</h2><p>Aus diesen Daten entsteht der EPC-QR-Code auf finalisierten Rechnungen.</p></div></div>
            <div className="form-grid form-grid--2">
              <label className="field"><span>Kontoinhaber</span><input value={form.accountHolder} onChange={(event) => setForm({ ...form, accountHolder: event.target.value })} /></label>
              <label className="field"><span>Bank</span><input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label>
              <label className="field field--full"><span>IBAN</span><input className="mono" value={formatIban(form.iban)} onChange={(event) => setForm({ ...form, iban: event.target.value })} aria-invalid={Boolean(form.iban && !isValidIban(form.iban))} />{form.iban && !isValidIban(form.iban) && <small className="field-error">Die IBAN-Prüfsumme ist nicht gültig.</small>}</label>
              <label className="field"><span>BIC (optional im EPC-QR)</span><input className="mono" value={form.bic} onChange={(event) => setForm({ ...form, bic: event.target.value.toUpperCase() })} /></label>
            </div>
            <div className="info-banner"><ShieldCheck aria-hidden="true" /><p>Der QR-Code füllt eine SEPA-Überweisung in unterstützten Banking-Apps aus. Ob sie als Echtzeitüberweisung ausgeführt wird, entscheidet die Banking-App bzw. die zahlende Person.</p></div>
          </section>

          <section id="numbering" className="surface settings-section">
            <div className="settings-section__heading"><span><FileJson aria-hidden="true" /></span><div><h2>Rechnungsvorgaben</h2><p>Nummern werden erst beim Finalisieren vergeben und danach nicht erneut verwendet.</p></div></div>
            <div className="form-grid form-grid--3">
              <label className="field field--wide"><span>Nummernmuster</span><input className="mono" value={form.numberPattern} onChange={(event) => setForm({ ...form, numberPattern: event.target.value })} /><small>Platzhalter: {'{YYYY}'}, {'{YY}'}, {'{NNNN}'}</small></label>
              <label className="field"><span>Zahlungsziel (Tage)</span><input type="number" min="0" value={form.paymentTermDays} onChange={(event) => setForm({ ...form, paymentTermDays: Number(event.target.value) })} /></label>
              <div className="number-preview"><span>Vorschau</span><strong>{formatInvoiceNumber(form, 23, new Date().getFullYear())}</strong></div>
              <label className="field"><span>Stundensatz Einzel</span><div className="input-with-suffix"><input type="number" min="0" step="0.5" value={form.privateRate} onChange={(event) => setForm({ ...form, privateRate: Number(event.target.value) })} /><span>€</span></div></label>
              <label className="field"><span>Stundensatz Duo</span><div className="input-with-suffix"><input type="number" min="0" step="0.5" value={form.duoRate} onChange={(event) => setForm({ ...form, duoRate: Number(event.target.value) })} /><span>€</span></div></label>
              <label className="switch-row switch-row--compact"><span><strong>Jährlich neu zählen</strong><small>Je Kalenderjahr bei 1 beginnen</small></span><input type="checkbox" checked={form.resetNumberAnnually} onChange={(event) => setForm({ ...form, resetNumberAnnually: event.target.checked })} /><i /></label>
              <label className="field field--full"><span>Standard-Rechtstext</span><textarea rows={3} value={form.defaultLegalText} onChange={(event) => setForm({ ...form, defaultLegalText: event.target.value })} /><small>Voreingestellt ist § 19 UStG ohne Umsatzsteuerausweis. Bitte an deine tatsächliche steuerliche Situation anpassen.</small></label>
            </div>
          </section>

          <section id="appearance" className="surface settings-section">
            <div className="settings-section__heading"><span><Palette aria-hidden="true" /></span><div><h2>Darstellung</h2><p>Das Rechnungs-PDF bleibt unabhängig davon immer hell.</p></div></div>
            <fieldset className="theme-picker"><legend>Farbschema</legend>{([['system', Palette, 'System'], ['light', Sun, 'Hell'], ['dark', Moon, 'Dunkel']] as const).map(([value, Icon, label]) => <label className={form.theme === value ? 'is-selected' : ''} key={value}><input type="radio" name="theme" checked={form.theme === value} onChange={() => setTheme(value)} /><Icon aria-hidden="true" /><span>{label}</span></label>)}</fieldset>
            <label className="switch-row"><span><strong>Bewegungen reduzieren</strong><small>Expressive Übergänge auf kurze Überblendungen begrenzen</small></span><input type="checkbox" checked={form.reducedMotion} onChange={(event) => { const next = { ...form, reducedMotion: event.target.checked }; setForm(next); onSave(next) }} /><i /></label>
          </section>

          <section id="backup" className="surface settings-section settings-section--backup">
            <div className="settings-section__heading"><span><FolderSync aria-hidden="true" /></span><div><h2>Backup & Import</h2><p>Eine vollständige JSON-Datei ist dein unabhängiger Reset- und Restore-Weg.</p></div></div>
            <div className="backup-grid">
              <article><span className="backup-icon"><Download aria-hidden="true" /></span><h3>Manuelles Backup</h3><p>Alle Familien, Rechnungen, Einstellungen und der Änderungsverlauf in einer Datei.</p><button className="button button--tonal" onClick={onExport}><Download aria-hidden="true" /> JSON exportieren</button></article>
              <article><span className="backup-icon"><Upload aria-hidden="true" /></span><h3>Backup wiederherstellen</h3><p>Ersetzt den aktuellen Datenstand nach einer Sicherheitsabfrage vollständig.</p><label className="button button--tonal file-button"><Upload aria-hidden="true" /> JSON importieren<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} /></label></article>
              <article className={folderConnected ? 'is-connected' : ''}><span className="backup-icon">{folderConnected ? <FolderSync aria-hidden="true" /> : <CloudOff aria-hidden="true" />}</span><h3>Lokaler Auto-Backup-Ordner</h3><p>{!folderSupported ? 'Dieser Browser unterstützt die Ordnerauswahl nicht.' : folderConnected ? `Verbunden: ${folderName}. Bei Änderungen wird die Backup-Datei aktualisiert.` : 'Chromium kann nach deiner Auswahl bei jeder Änderung lokal schreiben.'}</p>{folderSupported && (folderConnected ? <div className="button-row"><button className="button button--tonal" onClick={onBackupNow}>Backup jetzt</button><button className="button button--text" onClick={onDisconnectFolder}>Trennen</button></div> : <button className="button button--tonal" onClick={onConnectFolder}><FolderSync aria-hidden="true" /> Ordner wählen</button>)}</article>
            </div>
            <div className="info-banner"><HardDrive aria-hidden="true" /><p>Die App spricht keine Cloud-API an. Wählst du einen lokal synchronisierten Drive-Ordner, übernimmt ausschließlich die installierte Desktop-Synchronisation das spätere Hochladen. Die Ordnerfunktion ist derzeit vor allem in Chromium-Browsern verfügbar.</p></div>
          </section>

          <section id="history" className="surface settings-section">
            <div className="settings-section__heading"><span><History aria-hidden="true" /></span><div><h2>Änderungsverlauf</h2><p>Die letzten lokalen Aktionen helfen dabei, Änderungen nachzuvollziehen.</p></div></div>
            <div className="history-list">
              {state.audit.slice(0, 12).map((event) => <div key={event.id}><span><i /><strong>{event.label}</strong></span><time dateTime={event.at}>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(event.at))}</time></div>)}
              {!state.audit.length && <p>Noch keine Änderungen protokolliert.</p>}
            </div>
          </section>

          <section className="danger-zone"><div><ArchiveRestore aria-hidden="true" /><span><strong>Alle lokalen Daten zurücksetzen</strong><p>Löscht Stammdaten, Rechnungen und Einstellungen in diesem Browser.</p></span></div><button className="button button--danger-outline" onClick={onReset}>Daten zurücksetzen</button></section>
        </div>
      </div>
    </div>
  )
}
