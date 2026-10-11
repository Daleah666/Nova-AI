import { useRef, useState } from 'react'
import { sfx } from '../audio'
import { savedSize, useGame } from '../store/game'
import { useSettings } from '../store/settings'
import { downloadText } from '../util/image'

const PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
]

export function SettingsPanel() {
  const s = useSettings()
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="col">
      <h3>AI Dungeon Master (optional)</h3>
      <p className="muted">
        Any OpenAI-compatible chat API with tool calling works. The key is stored only in this browser's localStorage and
        sent straight to the API you choose. It is never included in exported saves.
      </p>
      <div className="row wrap">
        {PRESETS.map((p) => (
          <button key={p.label} className="btn small" onClick={() => s.update({ aiBaseUrl: p.baseUrl, aiModel: p.model })}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="col tight">
        <span className="pixel tiny">API base URL</span>
        <input className="input" value={s.aiBaseUrl} onChange={(e) => s.update({ aiBaseUrl: e.target.value })} />
      </label>
      <label className="col tight">
        <span className="pixel tiny">Model</span>
        <input className="input" value={s.aiModel} onChange={(e) => s.update({ aiModel: e.target.value })} />
      </label>
      <label className="col tight">
        <span className="pixel tiny">API key</span>
        <div className="row">
          <input
            className="input grow"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-..."
            value={s.aiKey}
            autoComplete="off"
            onChange={(e) => s.update({ aiKey: e.target.value })}
          />
          <button className="btn small ghost" onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          {s.aiKey && (
            <button className="btn small ghost" onClick={() => s.update({ aiKey: '' })}>
              Clear
            </button>
          )}
        </div>
      </label>

      <h3>Sound</h3>
      <label className="row">
        <input type="checkbox" checked={s.ambient} onChange={(e) => s.update({ ambient: e.target.checked })} />
        Lo-fi tavern ambience
      </label>
      <label className="row">
        <input type="checkbox" checked={s.sfx} onChange={(e) => s.update({ sfx: e.target.checked })} />
        Sound effects
      </label>
      <label className="row">
        Volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => s.update({ volume: Number(e.target.value) })}
          onPointerUp={() => sfx('select')}
          className="grow"
        />
      </label>

      <SaveSection />

      <h3>Story</h3>
      <label className="row">
        Text speed
        <input
          type="range"
          min={10}
          max={120}
          step={5}
          value={s.textSpeed}
          onChange={(e) => s.update({ textSpeed: Number(e.target.value) })}
          className="grow"
        />
        <span className="muted">{s.textSpeed} cps</span>
      </label>
    </div>
  )
}

function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`
}

function SaveSection() {
  const exportSave = useGame((s) => s.exportSave)
  const importSave = useGame((s) => s.importSave)
  const wipeSave = useGame((s) => s.wipeSave)
  const partySize = useGame((s) => s.party.length)
  const savedBytes = useGame(savedSize)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)

  const onExport = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    downloadText(`nova-quest-save-${stamp}.json`, exportSave())
    sfx('confirm')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      importSave(await file.text())
      sfx('levelup')
    } catch (e) {
      setError((e as Error).message)
      sfx('bump')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <h3>Save data</h3>
      <p className="muted">
        Autosaves to this browser after every action ({formatBytes(savedBytes)} used). Export a file to back up your party, quests,
        journal, and art, or to move them to another device.
      </p>
      <div className="row wrap">
        <button className="btn small" onClick={onExport} disabled={partySize === 0}>
          Export save
        </button>
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          Import save
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Import save file"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        {confirmWipe ? (
          <>
            <button
              className="btn small danger"
              onClick={() => {
                wipeSave()
                setConfirmWipe(false)
                sfx('defeat')
              }}
            >
              Really wipe everything?
            </button>
            <button className="btn small ghost" onClick={() => setConfirmWipe(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="btn small ghost" onClick={() => setConfirmWipe(true)}>
            Wipe save
          </button>
        )}
      </div>
      {error && <div className="danger-text">{error}</div>}
    </>
  )
}
