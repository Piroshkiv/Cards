import { useState, useEffect } from 'react'
import type { Card, Article } from '../types'
import { speakGerman } from '../utils/tts'

interface ArticleCardProps {
  card: Card
  onAnswer: (correct: boolean) => void
}

const ARTICLES: Article[] = ['der', 'die', 'das']

type Phase = 'quiz' | 'flash' | 'correcting'

export function ArticleCard({ card, onAnswer }: ArticleCardProps) {
  const [phase, setPhase] = useState<Phase>('quiz')
  const [wasWrong, setWasWrong] = useState(false)

  useEffect(() => {
    speakGerman(card.word)
    setPhase('quiz')
    setWasWrong(false)
  }, [card.id])

  function handleSelect(art: Article) {
    if (phase !== 'quiz') return
    const correct = art === card.article
    speakGerman(`${card.article} ${card.word}`)

    if (correct) {
      setPhase('flash')
      setTimeout(() => onAnswer(!wasWrong), 1000)
    } else {
      setWasWrong(true)
      setPhase('correcting')
    }
  }

  function handleOK() {
    setPhase('quiz')
    speakGerman(card.word)
  }

  const displayWord = card.plural ? `${card.word} / ${card.plural}` : card.word
  const speakCurrent = () => speakGerman(phase === 'correcting' ? `${card.article} ${card.word}` : card.word)

  if (phase === 'correcting') {
    return (
      <div className="quiz-card">
        <div className="quiz-card__meta">
          <span className="quiz-card__direction">Артикль</span>
        </div>
        <button className="quiz-card__question quiz-card__question--speak" onClick={speakCurrent} title="Произнести">
          {displayWord} 🔊
        </button>
        {card.translation && <div className="quiz-card__sub">{card.translation}</div>}
        <div className="article-correction">
          <span className="article-correction__article">{card.article}</span>
          <span className="article-correction__word">{card.word}</span>
        </div>
        <button className="article-ok-btn" onClick={handleOK}>
          OK — попробую ещё раз
        </button>
      </div>
    )
  }

  return (
    <div className="quiz-card">
      <div className="quiz-card__meta">
        <span className="quiz-card__direction">Артикль</span>
      </div>
      <button className="quiz-card__question quiz-card__question--speak" onClick={speakCurrent} title="Произнести ещё раз">
        {displayWord} 🔊
      </button>
      {card.translation && <div className="quiz-card__sub">{card.translation}</div>}
      <div className="quiz-options">
        {ARTICLES.map(art => (
          <button
            key={art}
            className={`quiz-option quiz-option--article${
              phase === 'flash' && art === card.article ? ' quiz-option--correct' : ''
            }${phase === 'flash' && art !== card.article ? ' quiz-option--dim' : ''}`}
            onClick={() => handleSelect(art)}
            disabled={phase !== 'quiz'}
          >
            {art}
          </button>
        ))}
      </div>
    </div>
  )
}
