import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Play } from 'lucide-react'
import { getPack, savePack } from '../utils/storage'
import { defaultProgress } from '../utils/progress'
import { Modal } from '../components/Modal'
import type { Card, Pack, MasteryLevel } from '../types'

// Точка уровня: 0=серый, 1-2=жёлтый, 3=синий, 4-5=зелёный
function LevelDot({ level }: { level: MasteryLevel }) {
  const color =
    level === 0 ? 'var(--border)' :
    level <= 2  ? 'var(--warning)' :
    level === 3 ? 'var(--primary)' :
    'var(--success)'
  return (
    <span
      title={`уровень ${level}`}
      style={{
        display: 'inline-block',
        width: 8, height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  )
}

// Мини-индикатор 4 точек для карточки: F / Q-DE / Q-RU / W
function CardLevels({ card }: { card: Card }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <LevelDot level={card.flashcard.level} />
      <LevelDot level={card.quiz.de_ru.level} />
      <LevelDot level={card.quiz.ru_de.level} />
      <LevelDot level={card.writing.level} />
    </div>
  )
}

export function PackDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pack, setPack] = useState<Pack | null>(() => getPack(id!) ?? null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newTranslation, setNewTranslation] = useState('')

  if (!pack) {
    return <div className="page"><p>Пак не найден. <Link to="/">На главную</Link></p></div>
  }

  function save(updated: Pack) {
    savePack(updated)
    setPack(updated)
  }

  function handleAddCard() {
    const word        = newWord.trim()
    const translation = newTranslation.trim()
    if (!word || !translation) return
    if (pack!.cards.some(c => c.word.trim().toLowerCase() === word.toLowerCase())) {
      alert('Такое слово уже есть в паке')
      return
    }
    const card: Card = {
      id: crypto.randomUUID(),
      word,
      translation,
      flashcard: defaultProgress(),
      quiz: { de_ru: defaultProgress(), ru_de: defaultProgress() },
      writing: defaultProgress(),
    }
    save({ ...pack!, cards: [...pack!.cards, card] })
    setNewWord('')
    setNewTranslation('')
    setShowAddModal(false)
  }

  function handleDeleteCard(cardId: string) {
    save({ ...pack!, cards: pack!.cards.filter(c => c.id !== cardId) })
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1>{pack.name}</h1>
        <Link to={`/study/${pack.id}`}>
          <button className="btn btn--primary btn--sm"><Play size={14} />Учить</button>
        </Link>
        <button className="btn btn--primary btn--sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />Слово
        </button>
      </div>

      <div className="pack-detail-meta">
        {pack.cards.length} слов
        <span style={{ marginLeft: 16, fontSize: 12, color: 'var(--muted)' }}>
          ● Карточки &nbsp;● Квиз DE→RU &nbsp;● Квиз RU→DE &nbsp;● Написание
        </span>
      </div>

      {pack.cards.length === 0 ? (
        <div className="empty-state"><h3>Нет карточек</h3><p>Добавьте первое слово</p></div>
      ) : (
        <div className="card-list">
          {pack.cards.map(card => (
            <div key={card.id} className="card-row">
              <div className="card-row__words">
                <span className="card-row__word">{card.word}</span>
                <span className="card-row__sep">—</span>
                <span className="card-row__translation">{card.translation}</span>
              </div>
              <CardLevels card={card} />
              <button
                className="btn-icon btn-icon--danger"
                onClick={() => handleDeleteCard(card.id)}
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal title="Новое слово" onClose={() => setShowAddModal(false)}>
          <div className="modal-form">
            <input
              className="input" type="text" placeholder="Немецкое слово"
              value={newWord} onChange={e => setNewWord(e.target.value)} autoFocus
            />
            <input
              className="input" type="text" placeholder="Перевод"
              value={newTranslation} onChange={e => setNewTranslation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCard()}
            />
            <div className="modal-form__actions">
              <button className="btn btn--secondary btn--md" onClick={() => setShowAddModal(false)}>Отмена</button>
              <button className="btn btn--primary btn--md" onClick={handleAddCard}
                disabled={!newWord.trim() || !newTranslation.trim()}>Добавить</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
