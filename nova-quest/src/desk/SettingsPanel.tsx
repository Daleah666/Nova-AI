import { sfx } from '../audio'
import { useSettings } from '../store/settings'

export function SettingsPanel() {
  const s = useSettings()

  return (
    <div className="col">
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
