import { Link } from 'react-router-dom'
import { BookOpen, Trash2, Play, LogOut } from 'lucide-react'
import type { Pack } from '../types'
import { countDueToday, avgMasteryPercent } from '../utils/deck'

interface PackCardProps {
  pack: Pack
  isOwner: boolean
  onDelete: (id: string) => void
  onUnsubscribe: (id: string) => void
}

export function PackCard({ pack, isOwner, onDelete, onUnsubscribe }: PackCardProps) {
  const due     = countDueToday(pack.cards)
  const mastery = avgMasteryPercent(pack.cards)

  return (
    <div className="pack-card card">
      <div className="pack-card__info">
        <div className="pack-card__icon">
          <BookOpen size={20} color="var(--primary)" />
        </div>
        <div className="pack-card__text">
          <Link to={`/packs/${pack.id}`} className="pack-card__name">{pack.name}</Link>
          <div className="pack-card__meta">
            <span>{pack.cards.length} слов</span>
            {due > 0 && <span className="pack-card__due">{due} к повторению</span>}
            {pack.cards.length > 0 && (
              <span className="pack-card__learned">{mastery}% освоено</span>
            )}
          </div>
        </div>
      </div>
      <div className="pack-card__actions">
        <Link to={`/study/${pack.id}`}>
          <button className="btn btn--primary btn--sm">
            <Play size={14} />
            Учить
          </button>
        </Link>
        {isOwner ? (
          <button
            className="btn-icon btn-icon--danger"
            onClick={() => onDelete(pack.id)}
            title="Удалить пак"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <button
            className="btn-icon btn-icon--danger"
            onClick={() => onUnsubscribe(pack.id)}
            title="Отписаться"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
