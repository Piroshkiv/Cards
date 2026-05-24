import { useState, useEffect } from 'react'
import type { Card, Direction } from '../types'
import { speakGerman, cancelSpeech } from '../utils/tts'
import { germanText } from '../utils/german'

interface QuizCardProps {
  card: Card
  direction: Direction
  options: Card[]
  onAnswer: (correct: boolean) => void
}

export function QuizCard({ card, direction, options, onAnswer }: QuizCardProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const deWord       = germanText(card)
  const question     = direction === 'de_ru' ? deWord : card.translation
  const correctLabel = direction === 'de_ru' ? card.translation : card.word
  const getLabel     = (c: Card) => direction === 'de_ru' ? c.translation : c.word
  const getDisplay   = (c: Card) => direction === 'de_ru' ? c.translation : germanText(c)

  useEffect(() => {
    if (direction === 'de_ru') speakGerman(deWord)
    return () => cancelSpeech()
  }, [card.id, direction])

  async function handleSelect(opt: Card) {
    if (selected !== null) return
    const label   = getLabel(opt)
    const correct = label === correctLabel
    setSelected(label)
    if (direction === 'ru_de') {
      await speakGerman(deWord)
      setSelected(null)
      onAnswer(correct)
    } else {
      setTimeout(() => {
        setSelected(null)
        onAnswer(correct)
      }, 1500)
    }
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
            {getDisplay(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}
