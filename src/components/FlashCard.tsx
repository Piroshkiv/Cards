import { useState } from 'react'
import type { Card, Grade, Direction } from '../types'
import { LEVEL_LABELS, formatMinutes } from '../utils/progress'

interface FlashCardProps {
  card: Card
  direction: Direction
  onGrade: (grade: Grade) => void
  intervals: Record<Grade, number>
}

const gradeLabels: Record<Grade, string> = { 0: 'Снова', 1: 'Сложно', 2: 'Хорошо', 3: 'Легко' }
const gradeVariants: Record<Grade, string> = { 0: 'danger', 1: 'warning', 2: 'primary', 3: 'success' }

export function FlashCard({ card, direction, onGrade, intervals }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  const front = direction === 'de_ru' ? card.word : card.translation
  const back  = direction === 'de_ru' ? card.translation : card.word

  function handleGrade(grade: Grade) {
    setFlipped(false)
    onGrade(grade)
  }

  return (
    <div className="flashcard-container">
      <div className="flashcard-level">
        {LEVEL_LABELS[card.flashcard.level]}
      </div>

      <div
        className={`flashcard ${flipped ? 'flashcard--flipped' : ''}`}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className="flashcard__face flashcard__front">
          <span className="flashcard__word">{front}</span>
          <span className="flashcard__hint">нажмите чтобы перевернуть</span>
        </div>
        <div className="flashcard__face flashcard__back">
          <span className="flashcard__label">{direction === 'de_ru' ? 'DE' : 'RU'}</span>
          <span className="flashcard__word">{front}</span>
          <div className="flashcard__divider" />
          <span className="flashcard__translation">{back}</span>
        </div>
      </div>

      {flipped && (
        <div className="grade-buttons">
          {([0, 1, 2, 3] as Grade[]).map(grade => (
            <button
              key={grade}
              className={`grade-btn grade-btn--${gradeVariants[grade]}`}
              onClick={() => handleGrade(grade)}
            >
              <span className="grade-btn__label">{gradeLabels[grade]}</span>
              <span className="grade-btn__interval">{formatMinutes(intervals[grade])}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
