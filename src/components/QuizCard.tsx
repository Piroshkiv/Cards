import { useState } from 'react'
import type { Card, Direction } from '../types'
import { LEVEL_LABELS } from '../utils/progress'

interface QuizCardProps {
  card: Card
  direction: Direction
  options: Card[]   // 4 штуки (правильный + 3 неправильных), перемешаны снаружи
  onAnswer: (correct: boolean) => void
}

export function QuizCard({ card, direction, options, onAnswer }: QuizCardProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const question     = direction === 'de_ru' ? card.word : card.translation
  const correctLabel = direction === 'de_ru' ? card.translation : card.word
  const getLabel     = (c: Card) => direction === 'de_ru' ? c.translation : c.word
  const level        = direction === 'de_ru' ? card.quiz.de_ru.level : card.quiz.ru_de.level

  function handleSelect(opt: Card) {
    if (selected !== null) return
    const label   = getLabel(opt)
    const correct = label === correctLabel
    setSelected(label)
    setTimeout(() => {
      setSelected(null)
      onAnswer(correct)
    }, 700)
  }

  function optionClass(opt: Card): string {
    const label = getLabel(opt)
    if (selected === null) return ''
    if (label === correctLabel) return 'quiz-option--correct'
    if (label === selected)     return 'quiz-option--wrong'
    return 'quiz-option--dim'
  }

  return (
    <div className="quiz-card">
      <div className="quiz-card__meta">
        <span className="quiz-card__direction">{direction === 'de_ru' ? 'DE → RU' : 'RU → DE'}</span>
        <span className="quiz-card__level">{LEVEL_LABELS[level]}</span>
      </div>
      <div className="quiz-card__question">{question}</div>
      <div className="quiz-options">
        {options.map(opt => (
          <button
            key={opt.id + direction}
            className={`quiz-option ${optionClass(opt)}`}
            onClick={() => handleSelect(opt)}
            disabled={selected !== null}
          >
            {getLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}
