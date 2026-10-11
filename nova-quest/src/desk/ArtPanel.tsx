import { useRef, useState } from 'react'
import { Portrait } from '../components/Portrait'
import { CLASSES } from '../content/classes'
import { NPCS } from '../content/npcs'
import { useGame } from '../store/game'
import { fileToPortrait } from '../util/image'

function UploadSlot({
  label,
  sub,
  image,
  sprite,
  onSet,
}: {
  label: string
  sub: string
  image?: string
  sprite: string
  onSet: (url: string | undefined) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  return (
    <div className="art-slot">
      <button className="portrait-drop" onClick={() => ref.current?.click()} title={`Upload art for ${label}`}>
        <Portrait image={image} sprite={sprite} size={64} alt={label} />
      </button>
      <div className="col tight grow">
        <span className="pixel tiny">{label}</span>
        <span className="muted small-text">{sub}</span>
        {error && <span className="danger-text small-text">{error}</span>}
        <div className="row">
          <button className="btn small" onClick={() => ref.current?.click()}>
            Upload
          </button>
          {image && (
            <button className="btn small ghost" onClick={() => onSet(undefined)}>
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            onSet(await fileToPortrait(f))
            setError('')
          } catch (err) {
            setError((err as Error).message)
          }
        }}
      />
    </div>
  )
}

export function ArtPanel() {
  const party = useGame((s) => s.party)
  const npcArt = useGame((s) => s.npcArt)
  const setPortrait = useGame((s) => s.setPortrait)
  const setNpcArt = useGame((s) => s.setNpcArt)

  return (
    <div className="col">
      <p className="muted">
        Bring your own avatars. Uploaded art replaces the pixel sprites in the overworld, visual-novel scenes, and battles.
        Images are resized and stored only in this browser.
      </p>
      <h3>Party</h3>
      {party.length === 0 && <p className="muted">No party yet.</p>}
      {party.map((c) => (
        <UploadSlot
          key={c.id}
          label={c.name}
          sub={`Lv${c.level} ${CLASSES[c.classId].name}`}
          image={c.portrait}
          sprite={CLASSES[c.classId].sprite}
          onSet={(url) => setPortrait(c.id, url)}
        />
      ))}
      <h3>Characters</h3>
      {Object.values(NPCS).map((n) => (
        <UploadSlot key={n.id} label={n.name} sub={n.title} image={npcArt[n.id]} sprite={n.sprite} onSet={(url) => setNpcArt(n.id, url)} />
      ))}
    </div>
  )
}
