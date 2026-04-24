import { useState } from 'react'
import type { Card, Grade } from '../types'
import { generateTiles, getTileSize, type Tile } from '../utils/german'
import { LEVEL_LABELS } from '../utils/progress'

interface WritingCardProps {
  card: Card
  onGrade: (grade: Grade) => void
}

export function WritingCard({ card, onGrade }: WritingCardProps) {
  const answer = card.word.toLowerCase()
  const [tiles] = useState<Tile[]>(() => generateTiles(answer))
  const [selected, setSelected] = useState<Tile[]>([])
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)
  const tileSize = getTileSize(answer)

  const current = selected.map(t => t.letter).join('')
  const usedIds = new Set(selected.map(t => t.id))

  function pickTile(tile: Tile) {
    if (checked) return
    setSelected(prev => [...prev, tile])
  }

  function removeLast() {
    if (checked) return
    setSelected(prev => prev.slice(0, -1))
  }

  function checkAnswer() {
    const ok = current === answer
    setCorrect(ok)
    setChecked(true)
  }

  return (
    <div className="writing-card">
      <div className="writing-card__meta">
        <span className="writing-card__direction">RU → DE</span>
        <span className="writing-card__level">{LEVEL_LABELS[card.writing.level]}</span>
      </div>
      <div className="writing-card__question">{card.translation}</div>

      <div className="writing-answer">
        <div className="writing-answer__text">
          {current || <span className="writing-answer__placeholder">_</span>}
        </div>
        {!checked && current.length > 0 && (
          <button className="writing-answer__back" onClick={removeLast}>←</button>
        )}
      </div>

      {checked && (
        <div className={`writing-result ${correct ? 'writing-result--correct' : 'writing-result--wrong'}`}>
          {correct ? 'Правильно!' : `Правильно: ${card.word}`}
        </div>
      )}

      <div className="writing-tiles">
        {tiles.map(tile => (
          <button
            key={tile.id}
            className={`tile ${usedIds.has(tile.id) ? 'tile--used' : ''}`}
            onClick={() => pickTile(tile)}
            disabled={usedIds.has(tile.id) || checked}
            style={{ width: tileSize, height: tileSize }}
          >
            {tile.letter}
          </button>
        ))}
      </div>

      {!checked ? (
        <button
          className="btn btn--primary btn--md"
          onClick={checkAnswer}
          disabled={current.length === 0}
        >
          Проверить
        </button>
      ) : (
        <div className="grade-buttons">
          {correct ? (
            <>
              <button className="grade-btn grade-btn--primary" onClick={() => onGrade(2)}>
                <span className="grade-btn__label">Хорошо</span>
              </button>
              <button className="grade-btn grade-btn--success" onClick={() => onGrade(3)}>
                <span className="grade-btn__label">Легко</span>
              </button>
            </>
          ) : (
            <>
              <button className="grade-btn grade-btn--danger" onClick={() => onGrade(0)}>
                <span className="grade-btn__label">Снова</span>
              </button>
              <button className="grade-btn grade-btn--warning" onClick={() => onGrade(1)}>
                <span className="grade-btn__label">Сложно</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
