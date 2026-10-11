import { useCallback, useEffect, useMemo, useState } from 'react'
import { heroRef } from '../art/resolve'
import { sfx } from '../audio'
import { DieRoll } from '../components/DieRoll'
import { Portrait } from '../components/Portrait'
import { CLASSES } from '../content/classes'
import { NPCS } from '../content/npcs'
import { SCENES } from '../content/scenes'
import { abilityMod, ABILITY_NAMES, formatMod, type CheckResult } from '../engine/rules'
import { choiceAffordable, choiceVisible, interpolate, type Check } from '../engine/scene'
import { bestAt, leadOf } from '../game/party'
import { useGame } from '../store/game'
import { useSettings } from '../store/settings'

interface PendingCheck {
  check: Check
  choiceIndex: number
  text: string
  rollerId: string
  result?: CheckResult
  landed?: boolean
}

export function SceneScreen() {
  const sceneRef = useGame((s) => s.scene)
  const party = useGame((s) => s.party)
  const gold = useGame((s) => s.gold)
  const flags = useGame((s) => s.flags)
  const advance = useGame((s) => s.advance)
  const choose = useGame((s) => s.choose)
  const rollCheck = useGame((s) => s.rollCheck)
  const gotoNode = useGame((s) => s.gotoNode)
  const textSpeed = useSettings((s) => s.textSpeed)

  const scene = sceneRef ? SCENES[sceneRef.sceneId] : undefined
  const node = scene?.nodes[sceneRef?.nodeId ?? '']
  const lead = leadOf(party)
  const text = useMemo(
    () => (node ? interpolate(node.text, { lead: lead?.name ?? 'hero', gold }) : ''),
    [node, lead?.name, gold],
  )

  const nodeKey = `${sceneRef?.sceneId}/${sceneRef?.nodeId}`
  const [shownKey, setShownKey] = useState(nodeKey)
  const [shown, setShown] = useState(0)
  const [pending, setPending] = useState<PendingCheck | null>(null)
  if (shownKey !== nodeKey) {
    setShownKey(nodeKey)
    setShown(0)
    setPending(null)
  }
  const done = shown >= text.length

  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n % 3 === 0) sfx('type')
        return Math.min(text.length, n + 1)
      })
    }, 1000 / Math.max(5, textSpeed))
    return () => window.clearInterval(id)
  }, [done, text, textSpeed])

  const visibleChoices = (node?.choices ?? []).map((c, i) => ({ c, i })).filter(({ c }) => choiceVisible(c, flags))

  const startCheck = useCallback(
    (index: number) => {
      const choice = node?.choices?.[index]
      if (!choice?.check) return
      const roller = bestAt(party.filter((p) => p.hp > 0), choice.check.ability) ?? party[0]
      sfx('select')
      setPending({ check: choice.check, choiceIndex: index, text: choice.text, rollerId: roller.id })
    },
    [node, party],
  )

  const pickChoice = useCallback(
    (index: number) => {
      const choice = node?.choices?.[index]
      if (!choice || !choiceAffordable(choice, gold)) return
      if (choice.check) return startCheck(index)
      sfx('confirm')
      choose(index)
    },
    [node, gold, choose, startCheck],
  )

  const onAdvance = useCallback(() => {
    if (pending) return
    if (!done) return setShown(text.length)
    if (node?.choices?.length) return
    sfx('select')
    advance()
  }, [pending, done, text.length, node, advance])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        onAdvance()
      } else if (done && !pending && /^[1-9]$/.test(e.key)) {
        const vc = visibleChoices[Number(e.key) - 1]
        if (vc) pickChoice(vc.i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAdvance, done, pending, visibleChoices, pickChoice])

  if (!scene || !node) return null

  const rightId = node.speaker && node.speaker !== 'lead' ? node.speaker : node.show
  const rightNpc = rightId ? NPCS[rightId] : undefined
  const speakerName = node.speaker === 'lead' ? lead?.name : node.speaker ? NPCS[node.speaker]?.name : undefined
  const roller = pending ? party.find((p) => p.id === pending.rollerId) : undefined

  return (
    <div className={`scene-screen bg-${scene.bg}`}>
      <div className="scene-title pixel">{scene.title}</div>
      <div className="scene-stage" onClick={onAdvance}>
        {lead && (
          <div className={`vn-portrait left ${node.speaker === 'lead' ? 'speaking' : ''}`}>
            <Portrait art={heroRef(lead)} variant="full" sprite={CLASSES[lead.classId].sprite} size={480} alt={lead.name} />
          </div>
        )}
        {rightNpc && (
          <div key={rightNpc.id} className={`vn-portrait right ${node.speaker === rightNpc.id ? 'speaking' : ''}`}>
            <Portrait art={{ kind: 'npc', id: rightNpc.id }} variant="full" sprite={rightNpc.sprite} size={480} alt={rightNpc.name} flip />
          </div>
        )}
      </div>

      <div className="vn-box window" onClick={onAdvance}>
        {speakerName && (
          <div className="vn-name pixel">
            {speakerName}
            {rightNpc && node.speaker === rightNpc.id && <span className="vn-title">{rightNpc.title}</span>}
          </div>
        )}
        <p className={`vn-text ${speakerName ? '' : 'narration'}`}>
          {text.slice(0, shown)}
          {done && !node.choices?.length && <span className="vn-caret"> ▼</span>}
        </p>

        {done && !pending && visibleChoices.length > 0 && (
          <div className="vn-choices" onClick={(e) => e.stopPropagation()}>
            {visibleChoices.map(({ c, i }, n) => {
              const affordable = choiceAffordable(c, gold)
              return (
                <button key={i} className="btn" disabled={!affordable} onClick={() => pickChoice(i)} autoFocus={n === 0}>
                  <span className="muted">{n + 1}.</span> {c.text}
                  {c.check && (
                    <span className="check-tag">
                      {c.check.label} ({c.check.ability}) DC {c.check.dc}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {done && !pending && node.battle && (
          <div className="vn-choices" onClick={(e) => e.stopPropagation()}>
            <button className="btn primary" onClick={onAdvance} autoFocus>
              Fight!{node.battle.ambush ? ' (you strike first with advantage)' : ''}
            </button>
          </div>
        )}
      </div>

      {pending && roller && (
        <div className="check-overlay">
          <div className="window check-window col">
            <h2>
              {pending.check.label} check
            </h2>
            <p className="muted">
              "{pending.text}" {ABILITY_NAMES[pending.check.ability]} vs DC {pending.check.dc}
            </p>
            {!pending.result ? (
              <>
                <div className="pixel tiny">Who rolls?</div>
                <div className="roller-list">
                  {party
                    .filter((p) => p.hp > 0)
                    .map((p) => {
                      const mod = abilityMod(p.abilities[pending.check.ability])
                      return (
                        <button
                          key={p.id}
                          className={`roller ${p.id === pending.rollerId ? 'selected' : ''}`}
                          onClick={() => {
                            sfx('select')
                            setPending({ ...pending, rollerId: p.id })
                          }}
                        >
                          <Portrait art={heroRef(p)} sprite={CLASSES[p.classId].sprite} size={40} alt={p.name} />
                          <span>{p.name}</span>
                          <span className="pixel tiny">{formatMod(mod)}</span>
                        </button>
                      )
                    })}
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={() => setPending(null)}>
                    Back
                  </button>
                  <button
                    className="btn primary grow"
                    autoFocus
                    onClick={() => setPending({ ...pending, result: rollCheck(pending.check, roller.id, pending.choiceIndex) })}
                  >
                    Roll the d20!
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="check-roll">
                  <DieRoll
                    key={pending.choiceIndex + pending.rollerId}
                    value={pending.result.roll.natural ?? 0}
                    size={120}
                    onDone={() => {
                      setPending((p) => (p ? { ...p, landed: true } : p))
                      sfx(pending.result!.success ? 'heal' : 'miss')
                    }}
                  />
                </div>
                {pending.landed && (
                  <>
                    <div className={`check-result pixel ${pending.result.success ? 'ok' : 'bad'}`}>
                      {pending.result.roll.crit ? 'NATURAL 20! ' : pending.result.roll.fumble ? 'NATURAL 1! ' : ''}
                      {pending.result.success ? 'SUCCESS' : 'FAILURE'}
                    </div>
                    <p className="center">
                      {roller.name}: {pending.result.roll.natural} {formatMod(pending.result.modifier)} ={' '}
                      <b>{pending.result.total}</b> vs DC {pending.result.dc}
                    </p>
                    <button
                      className="btn primary"
                      autoFocus
                      onClick={() => {
                        sfx('confirm')
                        gotoNode(pending.result!.success ? pending.check.success : pending.check.failure)
                      }}
                    >
                      Continue
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
