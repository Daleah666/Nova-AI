import { useMemo, useRef, useState } from 'react'
import { sfx } from '../audio'
import { Portrait } from '../components/Portrait'
import { CLASS_LIST, CLASSES, SKILLS } from '../content/classes'
import { assignScores, createCharacter, deriveStats } from '../engine/character'
import { roll } from '../engine/dice'
import { ABILITIES, abilityMod, formatMod } from '../engine/rules'
import type { Character, ClassId } from '../engine/types'
import { useGame } from '../store/game'
import { fileToPortrait } from '../util/image'

const MAX_PARTY = 4
const NAMES: Record<ClassId, string[]> = {
  fighter: ['Sven', 'Brunhild', 'Rook', 'Kael'],
  wizard: ['Elowen', 'Fizzwick', 'Orrin', 'Nyx'],
  rogue: ['Pip', 'Vex', 'Shade', 'Juniper'],
  cleric: ['Aurelia', 'Brother Tam', 'Sol', 'Maren'],
}

function rollSix(): number[] {
  return Array.from({ length: 6 }, () => roll('4d6kh3').total)
}

export function CreateParty() {
  const beginAdventure = useGame((s) => s.beginAdventure)
  const setScreen = useGame((s) => s.setScreen)
  const [party, setParty] = useState<Character[]>([])
  const [classId, setClassId] = useState<ClassId>('fighter')
  const [name, setName] = useState('')
  const [rolled, setRolled] = useState<number[]>(rollSix)
  const [portrait, setPortrait] = useState<string | undefined>()
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cls = CLASSES[classId]
  const abilities = useMemo(() => assignScores(rolled, cls), [rolled, cls])
  const stats = deriveStats({ abilities, level: 1 }, cls)
  const placeholder = NAMES[classId][party.length % 4]

  const addHero = () => {
    if (party.length >= MAX_PARTY) return
    sfx('confirm')
    setParty([...party, createCharacter(name || placeholder, cls, abilities, portrait)])
    setName('')
    setPortrait(undefined)
    setRolled(rollSix())
  }

  const quickParty = () => {
    sfx('confirm')
    const ids: ClassId[] = ['fighter', 'wizard', 'rogue', 'cleric']
    setParty(ids.map((id, i) => createCharacter(NAMES[id][i % 4], CLASSES[id], assignScores(rollSix(), CLASSES[id]))))
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setPortrait(await fileToPortrait(f))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="create-screen">
      <div className="create-head row">
        <button className="btn ghost small" onClick={() => setScreen('title')}>
          Back
        </button>
        <h1 className="grow">Assemble your party</h1>
        <span className="muted">{party.length}/{MAX_PARTY} heroes</span>
      </div>

      <div className="create-grid">
        <section className="window col">
          <h2>1. Choose a class</h2>
          <div className="class-grid">
            {CLASS_LIST.map((c) => (
              <button
                key={c.id}
                className={`class-card ${c.id === classId ? 'selected' : ''}`}
                onClick={() => {
                  sfx('select')
                  setClassId(c.id)
                }}
              >
                <Portrait sprite={c.sprite} size={56} alt={c.name} />
                <span className="pixel class-name">{c.name}</span>
                <span className="muted small-text">{c.tagline}</span>
              </button>
            ))}
          </div>

          <h2>2. Name &amp; portrait</h2>
          <div className="row">
            <div className="portrait-drop" onClick={() => fileRef.current?.click()} title="Upload your own portrait">
              <Portrait image={portrait} sprite={cls.sprite} size={80} alt="portrait" />
              <span className="pixel tiny">{portrait ? 'change' : 'upload'}</span>
            </div>
            <div className="col grow">
              <input
                className="input"
                placeholder={placeholder}
                value={name}
                maxLength={20}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHero()}
                aria-label="Hero name"
              />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              {portrait && (
                <button className="btn small ghost" onClick={() => setPortrait(undefined)}>
                  Use pixel sprite instead
                </button>
              )}
              {error && <span className="danger-text">{error}</span>}
            </div>
          </div>

          <h2>3. Roll stats (4d6, drop lowest)</h2>
          <div className="stat-grid">
            {ABILITIES.map((a) => (
              <div key={a} className={`stat ${cls.priority[0] === a ? 'primary-stat' : ''}`}>
                <span className="pixel tiny">{a}</span>
                <span className="stat-val">{abilities[a]}</span>
                <span className="muted">{formatMod(abilityMod(abilities[a]))}</span>
              </div>
            ))}
          </div>
          <div className="row wrap">
            <button
              className="btn small"
              onClick={() => {
                sfx('dice')
                setRolled(rollSix())
              }}
            >
              Reroll
            </button>
            <span className="muted">
              HP {stats.maxHp} | MP {stats.maxMp} | AC {stats.ac} | {cls.weaponName} {formatMod(stats.attackBonus)} ({stats.damage})
            </span>
          </div>
          <div className="muted small-text">Skills: {cls.skills.map((s) => SKILLS[s].name).join(', ')}</div>
          <button className="btn primary" onClick={addHero} disabled={party.length >= MAX_PARTY}>
            Add {name || placeholder} to the party
          </button>
        </section>

        <section className="window col">
          <h2>Your party</h2>
          {party.length === 0 && <p className="muted">No heroes yet. Build one, or roll a quick party of four.</p>}
          <div className="col">
            {party.map((c) => {
              const s = deriveStats(c, CLASSES[c.classId])
              return (
                <div key={c.id} className="party-row">
                  <Portrait image={c.portrait} sprite={CLASSES[c.classId].sprite} size={48} alt={c.name} />
                  <div className="grow">
                    <div className="pixel tiny">{c.name}</div>
                    <div className="muted">
                      {CLASSES[c.classId].name} | HP {s.maxHp} | MP {s.maxMp} | AC {s.ac}
                    </div>
                  </div>
                  <button className="btn small ghost" onClick={() => setParty(party.filter((p) => p.id !== c.id))}>
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
          <div className="grow" />
          <button className="btn" onClick={quickParty}>
            Quick party (one of each class)
          </button>
          <button
            className="btn primary"
            disabled={party.length === 0}
            onClick={() => {
              sfx('confirm')
              beginAdventure(party)
            }}
          >
            Begin the adventure
          </button>
        </section>
      </div>
    </div>
  )
}
