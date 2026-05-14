import { useState, useEffect } from 'react'
import type { Card, Article } from '../types'
import { speakGerman } from '../utils/tts'

interface ArticleCardProps {
  card: Card
  onAnswer: (correct: boolean) => void
}

const ARTICLES: Article[] = ['der', 'die', 'das']

export function ArticleCard({ card, onAnswer }: ArticleCardProps) {
  const [selected, setSelected] = useState<Article | null>(null)

  useEffect(() => {
    speakGerman(card.word)
    return () => { setSelected(null) }
  }, [card.id])

  function handleSelect(art: Article) {
    if (selected !== null) return
    setSelected(art)
    const correct = art === card.article
    speakGerman(`${card.article} ${card.word}`)
    setTimeout(() => {
      setSelected(null)
      onAnswer(correct)
    }, 1800)
  }

  function optionClass(art: Article): string {
    if (selected === null) return ''
    if (art === card.article) return 'quiz-option--correct'
    if (art === selected)     return 'quiz-option--wrong'
    return 'quiz-option--dim'
  }

  const displayWord = card.plural
    ? `${card.word} / ${card.plural}`
    : card.word

  return (
    <div className="quiz-card">
      <div className="quiz-card__meta">
        <span className="quiz-card__direction">Артикль</span>
      </div>
      <div className="quiz-card__question">{displayWord}</div>
      {card.translation && (
        <div className="quiz-card__sub">{card.translation}</div>
      )}
      <div className="quiz-options">
        {ARTICLES.map(art => (
          <button
            key={art}
            className={`quiz-option quiz-option--article ${optionClass(art)}`}
            onClick={() => handleSelect(art)}
            disabled={selected !== null}
          >
            {art}
          </button>
        ))}
      </div>
    </div>
  )
}
