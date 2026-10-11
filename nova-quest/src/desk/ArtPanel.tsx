import { useMemo, useRef, useState } from 'react'
import type { CharacterCard } from '../art/card'
import { matchTarget, normalizeName, type ArtTarget } from '../art/match'
import { processArtFile, readCardJson, removeBackgroundFromUrl } from '../art/process'
import { heroRef, type ArtRef } from '../art/resolve'
import { sfx } from '../audio'
import { Portrait } from '../components/Portrait'
import { CLASS_LIST, CLASSES } from '../content/classes'
import { MONSTERS } from '../content/monsters'
import { NPCS } from '../content/npcs'
import { assignScores, createCharacter, rollScores } from '../engine/character'
import type { Character, ClassId } from '../engine/types'
import { useArt } from '../store/art'
import { MAX_PARTY, useGame } from '../store/game'
import { useSettings } from '../store/settings'

interface Slot extends ArtTarget {
  ref: ArtRef
  sprite: string
  sub: string
}

const GROUPS: Slot['group'][] = ['Party', 'Characters', 'Hero classes', 'Monsters']

/** Order matters for ties: a file named "wyrmling.png" goes to the scene character before the monster. */
function buildSlots(party: Character[]): Slot[] {
  return [
    ...party.map<Slot>((c) => ({
      key: `hero:${c.id}`,
      label: c.name,
      group: 'Party',
      names: [c.name],
      ref: heroRef(c),
      sprite: CLASSES[c.classId].sprite,
      sub: `Lv${c.level} ${CLASSES[c.classId].name}`,
    })),
    ...Object.values(NPCS).map<Slot>((n) => ({
      key: `npc:${n.id}`,
      label: n.name,
      group: 'Characters',
      names: [n.id, n.name],
      ref: { kind: 'npc', id: n.id },
      sprite: n.sprite,
      sub: n.title,
    })),
    ...CLASS_LIST.map<Slot>((c) => ({
      key: `class:${c.id}`,
      label: c.name,
      group: 'Hero classes',
      names: [c.id, c.name],
      ref: { kind: 'class', id: c.id },
      sprite: c.sprite,
      sub: 'Default look for heroes without their own art',
    })),
    ...Object.values(MONSTERS).map<Slot>((m) => ({
      key: `monster:${m.id}`,
      label: m.name,
      group: 'Monsters',
      names: [m.id, m.name],
      ref: { kind: 'monster', id: m.id },
      sprite: m.sprite,
      sub: `Battle sprite`,
    })),
  ]
}

interface Imported {
  id: string
  fileName: string
  url: string
  card: CharacterCard | null
  backgroundRemoved: boolean
  /** Art key the image was applied to, if any. */
  key?: string
}

const stem = (name: string) => normalizeName(name).replace(/\b(character|card|chara|v2|v3|spec)\b/g, '').trim()

/** Finds a sidecar JSON card for an image: same filename stem, or a card whose name is the stem. */
function pairCard(file: File, cards: { file: File; card: CharacterCard }[]) {
  const s = stem(file.name)
  return cards.find((c) => stem(c.file.name) === s || normalizeName(c.card.name) === s)?.card ?? null
}

function SlotRow({ slot }: { slot: Slot }) {
  const custom = useArt((s) => s.art[slot.key])
  const hasOriginal = useArt((s) => !!s.original[slot.key])
  const { setArt, removeArt, restoreOriginal } = useArt.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await job()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="art-slot">
      <button className="portrait-drop" onClick={() => fileRef.current?.click()} title={`Upload art for ${slot.label}`}>
        <Portrait art={slot.ref} sprite={slot.sprite} size={64} alt={slot.label} />
      </button>
      <div className="col tight grow">
        <span className="pixel tiny">
          {slot.label} {custom && <span className="tag">custom</span>}
        </span>
        <span className="muted small-text">{slot.sub}</span>
        {error && <span className="danger-text small-text">{error}</span>}
        <div className="row wrap">
          <button className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? '...' : 'Upload'}
          </button>
          {custom && !hasOriginal && (
            <button
              className="btn small ghost"
              disabled={busy}
              onClick={() => void run(async () => setArt(slot.key, await removeBackgroundFromUrl(custom), custom))}
            >
              Remove background
            </button>
          )}
          {hasOriginal && (
            <button className="btn small ghost" onClick={() => restoreOriginal(slot.key)}>
              Restore original
            </button>
          )}
          {custom && (
            <button className="btn small ghost" onClick={() => removeArt(slot.key)}>
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        aria-label={`Upload art for ${slot.label}`}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f)
            void run(async () => {
              const art = await processArtFile(f)
              setArt(slot.key, art.url, art.original)
            })
        }}
      />
    </div>
  )
}

function ImportRow({
  item,
  slots,
  canRecruit,
  onAssign,
  onRecruit,
}: {
  item: Imported
  slots: Slot[]
  canRecruit: boolean
  onAssign: (key: string) => void
  onRecruit: (classId: ClassId) => void
}) {
  const [classId, setClassId] = useState<ClassId>('fighter')
  return (
    <div className="import-row">
      <img src={item.url} alt={item.fileName} className="import-thumb" />
      <div className="col tight grow">
        <span className="small-text">
          <b>{item.card?.name ?? item.fileName}</b>
          {item.card && <span className="tag">card</span>}
          {item.backgroundRemoved && <span className="tag">bg removed</span>}
        </span>
        {item.card?.description && <span className="muted small-text bio-preview">{item.card.description}</span>}
        <div className="row wrap">
          <select
            className="input small"
            value={item.key ?? ''}
            aria-label={`Use ${item.fileName} for`}
            onChange={(e) => onAssign(e.target.value)}
          >
            <option value="">Not used</option>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {slots
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {canRecruit && !item.key?.startsWith('hero:') && (
            <>
              <select
                className="input small"
                value={classId}
                aria-label="Class for recruit"
                onChange={(e) => setClassId(e.target.value as ClassId)}
              >
                {CLASS_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="btn small" onClick={() => onRecruit(classId)}>
                Recruit as hero
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ArtPanel() {
  const party = useGame((s) => s.party)
  const recruitHero = useGame((s) => s.recruitHero)
  const artStyle = useSettings((s) => s.artStyle)
  const updateSettings = useSettings((s) => s.update)
  const hydrated = useArt((s) => s.hydrated)
  const customCount = useArt((s) => Object.keys(s.art).length)
  const slots = useMemo(() => buildSlots(party), [party])
  const fileRef = useRef<HTMLInputElement>(null)
  const [autoBg, setAutoBg] = useState(true)
  const [imported, setImported] = useState<Imported[]>([])
  const [status, setStatus] = useState('')
  const [dragging, setDragging] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const importFiles = async (list: FileList | File[]) => {
    const files = [...list]
    const images = files.filter((f) => /^image\/(png|webp|jpeg|gif)$/.test(f.type))
    const jsons = files.filter((f) => f.name.toLowerCase().endsWith('.json'))
    if (!images.length) {
      setStatus(jsons.length ? 'Character-card JSON needs its PNG alongside it.' : 'No images found in that drop.')
      return
    }
    const cards = (await Promise.all(jsons.map(async (file) => ({ file, card: await readCardJson(file) })))).filter(
      (c): c is { file: File; card: CharacterCard } => !!c.card,
    )
    const { setArt } = useArt.getState()
    const taken = new Set<string>()
    const results: Imported[] = []
    let failed = 0
    for (const [i, f] of images.entries()) {
      setStatus(`Processing ${i + 1}/${images.length}: ${f.name}`)
      try {
        const art = await processArtFile(f, { removeBg: autoBg ? 'auto' : 'never' })
        const card = art.card ?? pairCard(f, cards)
        // First file wins a slot, so a folder of "mira_happy.png, mira_sad.png" keeps the first expression.
        const target = matchTarget(f.name, card?.name, slots.filter((s) => !taken.has(s.key)))
        if (target) {
          taken.add(target.key)
          setArt(target.key, art.url, art.original)
        }
        results.push({
          id: `${Date.now()}-${i}`,
          fileName: f.name,
          url: art.url,
          card,
          backgroundRemoved: art.backgroundRemoved,
          key: target?.key,
        })
      } catch {
        failed++
      }
    }
    setImported((prev) => [...results, ...prev].slice(0, 40))
    const matched = results.filter((r) => r.key).length
    setStatus(
      `Imported ${results.length} image${results.length === 1 ? '' : 's'}: ${matched} matched automatically` +
        (results.length > matched ? `, ${results.length - matched} waiting for you below` : '') +
        (failed ? `, ${failed} couldn't be read` : '') +
        '.',
    )
    sfx(matched ? 'confirm' : 'select')
  }

  const assign = (item: Imported, key: string) => {
    const { setArt, removeArt } = useArt.getState()
    if (item.key) removeArt(item.key)
    if (key) setArt(key, item.url)
    setImported((prev) => prev.map((p) => (p.id === item.id ? { ...p, key: key || undefined } : p)))
  }

  const recruit = (item: Imported, classId: ClassId) => {
    const cls = CLASSES[classId]
    const name = (item.card?.name ?? normalizeName(item.fileName).replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 20)
    const hero = createCharacter(name, cls, assignScores(rollScores(), cls))
    if (item.card?.description) hero.bio = item.card.description.slice(0, 400)
    if (!recruitHero(hero)) return
    if (item.key) useArt.getState().removeArt(item.key)
    useArt.getState().setArt(`hero:${hero.id}`, item.url)
    setImported((prev) => prev.map((p) => (p.id === item.id ? { ...p, key: `hero:${hero.id}` } : p)))
    sfx('levelup')
  }

  const canRecruit = party.length > 0 && party.length < MAX_PARTY

  return (
    <div className="col">
      <div className="row wrap">
        <span className="pixel tiny">Art style</span>
        {(['illustrated', 'pixel'] as const).map((style) => (
          <button
            key={style}
            className={`btn small ${artStyle === style ? 'primary' : 'ghost'}`}
            aria-pressed={artStyle === style}
            onClick={() => updateSettings({ artStyle: style })}
          >
            {style === 'illustrated' ? 'Illustrated' : 'Pixel'}
          </button>
        ))}
      </div>
      <p className="muted">
        Your own art always wins over the built-in look. Images stay in this browser (IndexedDB) and are never uploaded.
      </p>

      <div
        className={`art-drop ${dragging ? 'dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-disabled={!hydrated}
        onClick={() => hydrated && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && hydrated && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (hydrated) void importFiles(e.dataTransfer.files)
        }}
      >
        <span className="pixel tiny">Drop PNGs or character cards here</span>
        <span className="muted small-text">
          Files are matched by name: "mira.png", "old_bram_happy.png", "goblin.webp", or a hero's name. SillyTavern / Tavern
          character cards (PNG, or JSON next to its PNG) are matched by the card's name and can join the party.
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/webp,image/jpeg,image/gif,.json,application/json"
        hidden
        aria-label="Import art files"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <label className="row small-text">
        <input type="checkbox" checked={autoBg} onChange={(e) => setAutoBg(e.target.checked)} />
        Remove flat backgrounds automatically
      </label>
      {status && <div className="muted small-text" role="status">{status}</div>}

      {imported.length > 0 && (
        <>
          <h3>Recent imports</h3>
          {imported.map((item) => (
            <ImportRow
              key={item.id}
              item={item}
              slots={slots}
              canRecruit={canRecruit}
              onAssign={(key) => assign(item, key)}
              onRecruit={(classId) => recruit(item, classId)}
            />
          ))}
        </>
      )}

      {GROUPS.map((g) => {
        const list = slots.filter((s) => s.group === g)
        if (!list.length) return null
        return (
          <div key={g} className="col">
            <h3>{g}</h3>
            {list.map((slot) => (
              <SlotRow key={slot.key} slot={slot} />
            ))}
          </div>
        )
      })}

      {customCount > 0 && (
        <div className="row wrap">
          {confirmClear ? (
            <>
              <button
                className="btn small danger"
                onClick={() => {
                  useArt.getState().clearArt()
                  setImported([])
                  setConfirmClear(false)
                }}
              >
                Really remove all {customCount} custom images?
              </button>
              <button className="btn small ghost" onClick={() => setConfirmClear(false)}>
                Keep them
              </button>
            </>
          ) : (
            <button className="btn small ghost" onClick={() => setConfirmClear(true)}>
              Clear all custom art
            </button>
          )}
        </div>
      )}
    </div>
  )
}
