interface Props {
  value: number
  max: number
  kind: 'hp' | 'mp' | 'xp'
  label?: boolean
}

export function Bar({ value, max, kind, label = true }: Props) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const color = kind === 'hp' ? (ratio < 0.3 ? 'var(--hp-low)' : 'var(--hp)') : kind === 'mp' ? 'var(--mp)' : 'var(--xp)'
  return (
    <div className="bar-wrap">
      {label && (
        <div className="bar-label">
          <span>{kind.toUpperCase()}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      )}
      <div className="bar" role="meter" aria-valuenow={value} aria-valuemax={max} aria-label={kind}>
        <span style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  )
}
