import type { ReactNode } from 'react'
import { sfx } from '../audio'
import { useGame } from '../store/game'
import { useUi, type DeskTab } from '../store/settings'
import { ArtPanel } from './ArtPanel'
import { DiceTray } from './DiceTray'
import { DmChat } from './DmChat'
import { FocusBadge, FocusTimer } from './FocusTimer'
import { useFocusTicker } from './focusHooks'
import { Journal } from './Journal'
import { OraclePanel } from './OraclePanel'
import { QuestBoard } from './QuestBoard'
import { SettingsPanel } from './SettingsPanel'

const TABS: { id: DeskTab; label: string; render: () => ReactNode }[] = [
  { id: 'quests', label: 'Quests', render: () => <QuestBoard /> },
  { id: 'focus', label: 'Focus', render: () => <FocusTimer /> },
  { id: 'dice', label: 'Dice', render: () => <DiceTray /> },
  { id: 'oracle', label: 'Oracle', render: () => <OraclePanel /> },
  { id: 'dm', label: 'DM', render: () => <DmChat /> },
  { id: 'journal', label: 'Journal', render: () => <Journal /> },
  { id: 'art', label: 'Art', render: () => <ArtPanel /> },
  { id: 'settings', label: 'Settings', render: () => <SettingsPanel /> },
]

export function Desk() {
  useFocusTicker()
  const open = useUi((s) => s.deskOpen)
  const tab = useUi((s) => s.deskTab)
  const openDesk = useUi((s) => s.openDesk)
  const toggleDesk = useUi((s) => s.toggleDesk)
  const openQuests = useGame((s) => s.quests.filter((q) => !q.done).length)
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <aside className={`desk ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Vibe Desk">
      <div className="desk-head">
        <h2>Vibe Desk</h2>
        <FocusBadge />
        <div className="grow" />
        <button className="btn small ghost" onClick={toggleDesk} aria-label="Close desk">
          Close
        </button>
      </div>
      <nav className="desk-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            className={`desk-tab ${t.id === tab ? 'active' : ''}`}
            onClick={() => {
              sfx('select')
              openDesk(t.id)
            }}
          >
            {t.label}
            {t.id === 'quests' && openQuests > 0 && <span className="tab-badge">{openQuests}</span>}
          </button>
        ))}
      </nav>
      <div className="desk-body">{open && current.render()}</div>
    </aside>
  )
}
