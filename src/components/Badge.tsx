import type { MasteryLevel } from '../types'
import { LEVEL_LABELS } from '../utils/progress'

interface BadgeProps {
  level: MasteryLevel
}

export function Badge({ level }: BadgeProps) {
  const cls = level === 0 ? 'new' : level <= 2 ? 'learning' : 'review'
  return (
    <span className={`badge badge--${cls}`}>
      {LEVEL_LABELS[level]}
    </span>
  )
}
