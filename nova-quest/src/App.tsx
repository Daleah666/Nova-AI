import { useEffect } from 'react'
import { sfx, startAmbient, stopAmbient } from './audio'
import { Toasts } from './components/Toasts'
import { Desk } from './desk/Desk'
import { FocusBadge } from './desk/FocusTimer'
import { BattleScreen } from './screens/BattleScreen'
import { CreateParty } from './screens/CreateParty'
import { Overworld } from './screens/Overworld'
import { SceneScreen } from './screens/SceneScreen'
import { TitleScreen } from './screens/TitleScreen'
import { useGame } from './store/game'
import { useSettings, useUi } from './store/settings'

function useAmbient() {
  const ambient = useSettings((s) => s.ambient)
  useEffect(() => {
    if (!ambient) {
      stopAmbient()
      return
    }
    // Browsers block audio until a user gesture, so a restored "on" setting waits for the first click.
    const start = () => startAmbient()
    start()
    window.addEventListener('pointerdown', start, { once: true })
    return () => window.removeEventListener('pointerdown', start)
  }, [ambient])
}

export default function App() {
  const screen = useGame((s) => s.screen)
  const gold = useGame((s) => s.gold)
  const partySize = useGame((s) => s.party.length)
  const setScreen = useGame((s) => s.setScreen)
  const deskOpen = useUi((s) => s.deskOpen)
  const toggleDesk = useUi((s) => s.toggleDesk)
  const ambient = useSettings((s) => s.ambient)
  const update = useSettings((s) => s.update)
  useAmbient()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault()
        sfx('select')
        toggleDesk()
      } else if (e.key === 'Escape' && useUi.getState().deskOpen) {
        toggleDesk()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleDesk])

  return (
    <div className={`app ${deskOpen ? 'desk-open' : ''}`}>
      <header className="topbar">
        <button className="logo pixel" onClick={() => setScreen('title')} title="Title screen">
          NOVA QUEST
        </button>
        <div className="grow" />
        <FocusBadge />
        {partySize > 0 && screen !== 'title' && <span className="pixel tiny gold">{gold} G</span>}
        <button
          className={`btn small ${ambient ? 'primary' : ''}`}
          onClick={() => update({ ambient: !ambient })}
          title="Lo-fi tavern ambience"
        >
          {ambient ? 'Vibes: on' : 'Vibes: off'}
        </button>
        <button className={`btn small ${deskOpen ? 'primary' : ''}`} onClick={toggleDesk} title="Vibe Desk (Q)">
          Desk [Q]
        </button>
      </header>
      <main className="stage">
        {screen === 'title' && <TitleScreen />}
        {screen === 'create' && <CreateParty />}
        {screen === 'world' && <Overworld />}
        {screen === 'scene' && <SceneScreen />}
        {screen === 'battle' && <BattleScreen />}
      </main>
      <Desk />
      <Toasts />
    </div>
  )
}
