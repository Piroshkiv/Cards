import { useState, useEffect } from 'react'
import type { Card, Article } from '../types'
import { speakGerman, cancelSpeech } from '../utils/tts'

interface ArticleCardProps {
  card: Card
  isNew: boolean
  onAnswer: (correct: boolean) => void
}

const ARTICLES: Article[] = ['der', 'die', 'das']

type Phase = 'intro' | 'quiz' | 'flash' | 'wrong-flash' | 'correcting'

export function ArticleCard({ card, isNew, onAnswer }: ArticleCardProps) {
  const [phase, setPhase] = useState<Phase>(isNew ? 'intro' : 'quiz')
  const [wasWrong, setWasWrong] = useState(false)
  const [wrongArt, setWrongArt] = useState<Article | null>(null)

  useEffect(() => {
    setPhase(isNew ? 'intro' : 'quiz')
    setWasWrong(false)
    speakGerman(isNew ? `${card.article} ${card.word}` : card.word)
    return () => cancelSpeech()
  }, [card.id])

  async function handleSelect(art: Article) {
    if (phase !== 'quiz') return
    const correct = art === card.article
    if (correct) {
      setPhase('flash')
      await speakGerman(`${card.article} ${card.word}`)
      onAnswer(!wasWrong)
    } else {
      setWasWrong(true)
      setWrongArt(art)
      setPhase('wrong-flash')
      await speakGerman(`${card.article} ${card.word}`)
      setPhase('correcting')
    }
  }

  function handleOK() {
    setPhase('quiz')
    speakGerman(card.word)
  }

  const displayWord = card.plural ? `${card.word} / ${card.plural}` : card.word
  const speakCurrent = () =>
    speakGerman(phase === 'quiz' || phase === 'flash' ? card.word : `${card.article} ${card.word}`)

  const fullForm = (
    <div className="article-correction">
      <span className="article-correction__article">{card.article}</span>
      <span className="article-correction__word">{card.word}</span>
    </div>
  )

  if (phase === 'intro' || phase === 'correcting') {
    return (
      <div className="quiz-card">
        <div className="quiz-card__meta">
          <span className={`quiz-card__direction ${phase === 'intro' ? 'article-new-badge' : ''}`}>
            {phase === 'intro' ? 'Новое слово' : 'Артикль'}
          </span>
        </div>
        <button className="quiz-card__question quiz-card__question--speak" onClick={speakCurrent} title="Произнести">
          {displayWord} 🔊
        </button>
        {card.translation && <div className="quiz-card__sub">{card.translation}</div>}
        {fullForm}
        <button className="article-ok-btn" onClick={handleOK}>OK</button>
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
        {ARTICLES.map(art => {
          let extra = ''
          if (phase === 'flash') {
            extra = art === card.article ? ' quiz-option--correct' : ' quiz-option--dim'
          } else if (phase === 'wrong-flash') {
            if (art === wrongArt)       extra = ' quiz-option--wrong'
            else if (art === card.article) extra = ' quiz-option--correct'
            else                           extra = ' quiz-option--dim'
          }
          return (
            <button
              key={art}
              className={`quiz-option quiz-option--article${extra}`}
              onClick={() => handleSelect(art)}
              disabled={phase !== 'quiz'}
            >
              {art}
            </button>
          )
        })}
      </div>
    </div>
  )
}
