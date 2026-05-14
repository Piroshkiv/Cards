import { useState } from 'react'
import type { Card, Grade, Direction } from '../types'

interface FlashCardProps {
  card: Card
  direction: Direction
  onGrade: (grade: Grade) => void
}

const gradeLabels: Record<Grade, string>    = { 0: 'Сложно', 1: 'Нормально', 2: 'Легко', 3: 'Очень легко' }
const gradeVariants: Record<Grade, string>  = { 0: 'danger', 1: 'warning',   2: 'primary', 3: 'success' }

export function FlashCard({ card, direction, onGrade }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  const front = direction === 'de_ru' ? card.word : card.translation
  const back  = direction === 'de_ru' ? card.translation : card.word

  function handleGrade(grade: Grade) {
    setFlipped(false)
    onGrade(grade)
  }

  return (
    <div className="flashcard-container">
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
