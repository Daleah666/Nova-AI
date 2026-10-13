import type { ArtRef } from '../art/resolve'
import { sfx } from '../audio'
import { Portrait } from '../components/Portrait'
import { clearHeroArt } from '../store/art'
import { useGame } from '../store/game'
import { useUi } from '../store/settings'

const PARADE: { sprite: string; art: ArtRef }[] = [
  { sprite: 'fighter', art: { kind: 'class', id: 'fighter' } },
  { sprite: 'wizard', art: { kind: 'class', id: 'wizard' } },
  { sprite: 'rogue', art: { kind: 'class', id: 'rogue' } },
  { sprite: 'cleric', art: { kind: 'class', id: 'cleric' } },
  { sprite: 'slime', art: { kind: 'monster', id: 'slime' } },
  { sprite: 'goblin', art: { kind: 'monster', id: 'goblin' } },
  { sprite: 'wyrmling', art: { kind: 'monster', id: 'wyrmling' } },
]

export function TitleScreen() {
  const party = useGame((s) => s.party)
  const scene = useGame((s) => s.scene)
  const battle = useGame((s) => s.battle)
  const setScreen = useGame((s) => s.setScreen)
  const newGame = useGame((s) => s.newGame)
  const openDesk = useUi((s) => s.openDesk)

  const resume = () => {
    sfx('confirm')
    setScreen(battle ? 'battle' : scene ? 'scene' : 'world')
  }

  return (
    <div className="title-screen">
      <div className="title-stars" aria-hidden />
      <div className="title-logo">
        <h1 className="title-main">NOVA QUEST</h1>
        <p className="title-sub pixel">a D&amp;D x JRPG x visual novel desk</p>
      </div>
      <div className="title-parade" aria-hidden>
        {PARADE.map((p, i) => (
          <div key={p.sprite} className="parade-sprite" style={{ animationDelay: `${i * 0.15}s` }}>
            <Portrait art={p.art} variant="full" sprite={p.sprite} size={i < 4 ? 190 : 120} flip={i >= 4} alt="" />
          </div>
        ))}
      </div>
      <div className="window title-menu col">
        {party.length > 0 && (
          <button className="btn primary" onClick={resume} autoFocus>
            Continue ({party.map((c) => c.name).join(', ')})
          </button>
        )}
        <button
          className="btn"
          autoFocus={party.length === 0}
          onClick={() => {
            if (party.length && !confirm('Start a new adventure? Your current party will be replaced (Quest Board tasks are kept).')) return
            sfx('confirm')
            clearHeroArt()
            newGame()
          }}
        >
          New Adventure
        </button>
        <button className="btn" onClick={() => openDesk('quests')}>
          Open the Vibe Desk
        </button>
      </div>
      <p className="title-foot muted">
        Arrow keys / WASD to move, Enter or Space to talk, Q to toggle the desk. Real dice, real oracle, no hallucinated
        rolls.
      </p>
    </div>
  )
}
