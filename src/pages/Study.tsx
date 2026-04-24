import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { X, ArrowLeft } from 'lucide-react'
import { getPack, saveStudySettings, getStudySettings, savePack } from '../utils/storage'
import { applyGrade, applyQuizResult, gradeIntervals } from '../utils/progress'
import {
  refreshQueueState,
  getNextDueTime, getSessionStatus, getWrongOptions,
  type QueueItem,
} from '../utils/deck'
import { FlashCard } from '../components/FlashCard'
import { QuizCard } from '../components/QuizCard'
import { WritingCard } from '../components/WritingCard'
import type { StudyMode, Direction, Grade, StudySettings } from '../types'

type Phase = 'setup' | 'session' | 'results'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Study() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [phase, setPhase]   = useState<Phase>('setup')
  const [settings, setSettings] = useState<StudySettings>(() => {
    const s = getStudySettings(id!)
    const pack = getPack(id!)
    if (s.mode === 'quiz' && (pack?.cards.length ?? 0) < 4) return { ...s, mode: 'flashcard' }
    return s
  })

  // Session queue — основная структура данных сессии
  const [queue, setQueue]           = useState<QueueItem[]>([])
  const [answered, setAnswered]     = useState(0)
  const [levelsGained, setLevelsGained] = useState(0)
  const [waiting, setWaiting]       = useState(false)
  const [nextDue, setNextDue]       = useState<Date | null>(null)
  const [countdown, setCountdown]   = useState('')

  const pack = getPack(id!)

  // Когда ждём — тикаем и автопроверяем появление due карточек
  useEffect(() => {
    if (!waiting) return
    const tick = () => {
      const fresh = getPack(id!)
      if (!fresh) return
      const q = refreshQueueState(fresh, settings.mode, settings.directions, [])
      if (q.length > 0) {
        setWaiting(false)
        setQueue(q)
        return
      }
      const nd = getNextDueTime(fresh, settings.mode, settings.directions)
      setNextDue(nd)
      if (nd) {
        const diff = nd.getTime() - Date.now()
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setCountdown(mins > 0 ? `${mins} мин ${secs} с` : `${secs} с`)
      }
    }
    tick()
    const iv = setInterval(tick, 500)
    return () => clearInterval(iv)
  }, [waiting])

  // Все хуки должны быть до любых условных return
  const current = queue[0] ?? null

  const currentIntervals = useMemo(() => {
    if (!current) return { 0: 0.5, 1: 3, 2: 10, 3: 1440 } as Record<Grade, number>
    const prog = settings.mode === 'flashcard'
      ? current.card.flashcard
      : settings.mode === 'quiz'
        ? (current.direction === 'de_ru' ? current.card.quiz.de_ru : current.card.quiz.ru_de)
        : current.card.writing
    return gradeIntervals(prog)
  }, [current?.card.id, current?.direction, settings.mode])

  const quizOptions = useMemo(() => {
    if (settings.mode !== 'quiz' || !current || !pack) return []
    const wrong = getWrongOptions(current.card, pack.cards, current.direction)
    return shuffle([current.card, ...wrong])
  }, [current?.card.id, current?.direction, settings.mode])

  if (!pack) {
    return <div className="page"><p>Пак не найден. <Link to="/">На главную</Link></p></div>
  }

  // ─── Применить ответ и обновить очередь ──────────────────────────────────

  function applyAnswer(grade: Grade) {
    const current = queue[0]
    if (!current) return

    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!
    const remaining = queue.slice(1)

    if (grade === 0) {
      // Again: не сохраняем в storage, двигаем карточку в конец очереди
      setAnswered(n => n + 1)
      const newQ = refreshQueueState(fresh, settings.mode, settings.directions, remaining, current)
      setQueue(newQ)
      return
    }

    // Hard / Good / Easy: обновляем прогресс в storage
    let levelBefore: number
    if (settings.mode === 'flashcard') {
      levelBefore = card.flashcard.level
      card.flashcard = applyGrade(card.flashcard, grade)
      if (card.flashcard.level > levelBefore) setLevelsGained(n => n + 1)
    } else if (settings.mode === 'quiz') {
      const prog = current.direction === 'de_ru' ? card.quiz.de_ru : card.quiz.ru_de
      levelBefore = prog.level
      const updated = applyGrade(prog, grade)
      if (updated.level > levelBefore) setLevelsGained(n => n + 1)
      if (current.direction === 'de_ru') card.quiz.de_ru = updated
      else card.quiz.ru_de = updated
    } else {
      levelBefore = card.writing.level
      card.writing = applyGrade(card.writing, grade)
      if (card.writing.level > levelBefore) setLevelsGained(n => n + 1)
    }
    savePack(fresh)

    setAnswered(n => n + 1)

    const newQ = refreshQueueState(fresh, settings.mode, settings.directions, remaining)
    if (newQ.length === 0) {
      setWaiting(true)
    } else {
      setQueue(newQ)
    }
  }

  function handleQuizAnswer(correct: boolean) {
    const current = queue[0]
    if (!current) return
    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!
    const remaining = queue.slice(1)
    const prog = current.direction === 'de_ru' ? card.quiz.de_ru : card.quiz.ru_de
    const levelBefore = prog.level
    const updated = applyQuizResult(prog, correct)
    if (updated.level > levelBefore) setLevelsGained(n => n + 1)
    if (current.direction === 'de_ru') card.quiz.de_ru = updated
    else card.quiz.ru_de = updated
    savePack(fresh)
    setAnswered(n => n + 1)

    if (!correct) {
      // Неправильно в квизе = Again (двигаем в конец, уровень уже обновлён в storage)
      const newQ = refreshQueueState(fresh, settings.mode, settings.directions, remaining, current)
      setQueue(newQ)
    } else {
      const newQ = refreshQueueState(fresh, settings.mode, settings.directions, remaining)
      if (newQ.length === 0) setWaiting(true)
      else setQueue(newQ)
    }
  }

  // ─── SETUP ───────────────────────────────────────────────────────────────

  function handleStart() {
    saveStudySettings(id!, settings)
    setAnswered(0)
    setLevelsGained(0)
    setWaiting(false)
    setPhase('session')

    const fresh = getPack(id!)!
    const q = refreshQueueState(fresh, settings.mode, settings.directions, [])
    if (q.length === 0) {
      setWaiting(true)
      setNextDue(getNextDueTime(fresh, settings.mode, settings.directions))
    } else {
      setQueue(q)
    }
  }

  function toggleDir(dir: Direction) {
    setSettings(s => {
      const d = { ...s.directions, [dir]: !s.directions[dir] }
      if (!d.de_ru && !d.ru_de) return s
      return { ...s, directions: d }
    })
  }

  if (phase === 'setup') {
    const canQuiz = pack.cards.length >= 4
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h1>{pack.name}</h1>
        </div>
        <div className="setup card">
          <h2>Режим</h2>
          <div className="setup__modes">
            {(['flashcard', 'quiz', 'writing'] as StudyMode[]).map(mode => {
              const disabled = mode === 'quiz' && !canQuiz
              const titles: Record<StudyMode, string> = { flashcard: 'Карточки', quiz: 'Квиз', writing: 'Написание' }
              const descs:  Record<StudyMode, string>  = {
                flashcard: 'Переворот + оценка',
                quiz:      canQuiz ? '4 варианта ответа' : 'Нужно ≥ 4 слов',
                writing:   'Собери слово из букв',
              }
              return (
                <button key={mode}
                  className={`mode-btn ${settings.mode === mode ? 'mode-btn--active' : ''} ${disabled ? 'mode-btn--disabled' : ''}`}
                  onClick={() => !disabled && setSettings(s => ({ ...s, mode }))}
                  disabled={disabled}
                >
                  <span className="mode-btn__title">{titles[mode]}</span>
                  <span className="mode-btn__desc">{descs[mode]}</span>
                </button>
              )
            })}
          </div>

          {(settings.mode === 'flashcard' || settings.mode === 'quiz') && (
            <>
              <div className="divider" />
              <h2>Направление</h2>
              <div className="setup__directions">
                <label className="toggle-label">
                  <input type="checkbox" checked={settings.directions.de_ru} onChange={() => toggleDir('de_ru')} />
                  DE → RU
                </label>
                <label className="toggle-label">
                  <input type="checkbox" checked={settings.directions.ru_de} onChange={() => toggleDir('ru_de')} />
                  RU → DE
                </label>
              </div>
            </>
          )}

          <div className="divider" />
          <div className="setup__footer">
            <span className="setup__count">{pack.cards.length} слов в паке</span>
            <button className="btn btn--primary btn--md" onClick={handleStart}>Начать</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── RESULTS ─────────────────────────────────────────────────────────────

  if (phase === 'results') {
    return (
      <div className="page">
        <div className="page-header"><h1>Сессия завершена</h1></div>
        <div className="results card">
          <div className="results__grid results__grid--2">
            <div className="results__item results__item--primary">
              <span className="results__value">{answered}</span>
              <span className="results__label">ответов</span>
            </div>
            <div className="results__item results__item--success">
              <span className="results__value">{levelsGained}</span>
              <span className="results__label">уровней получено</span>
            </div>
          </div>
          <div className="results__actions">
            <button className="btn btn--secondary btn--md" onClick={() => navigate('/')}>На главную</button>
            <button className="btn btn--primary btn--md" onClick={() => setPhase('setup')}>Ещё раз</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── SESSION ─────────────────────────────────────────────────────────────

  const freshPack = getPack(id!)!
  const status    = getSessionStatus(freshPack, settings.mode, settings.directions)

  return (
    <div className="page">
      <div className="study-header">
        <button className="btn-icon" onClick={() => setPhase('results')} title="Завершить">
          <X size={20} />
        </button>
        <div className="session-status">
          <span className="session-status__item session-status__item--due">{status.due} due</span>
          <span className="session-status__item session-status__item--cd">{status.cooldown} кд</span>
          <span className="session-status__item session-status__item--new">{status.notStarted} новых</span>
        </div>
        <span className="study-counter">{answered}</span>
      </div>

      <div className="study-content">
        {waiting ? (
          <div className="waiting-state card">
            <h3>Все слова на паузе</h3>
            {nextDue
              ? <p>Следующее через <strong>{countdown}</strong></p>
              : <p>Нет слов для изучения</p>
            }
            <button className="btn btn--secondary btn--md" onClick={() => setPhase('results')}>
              Завершить
            </button>
          </div>
        ) : current ? (
          <>
            {settings.mode === 'flashcard' && (
              <FlashCard
                key={`${current.card.id}-${current.direction}`}
                card={current.card}
                direction={current.direction}
                onGrade={applyAnswer}
                intervals={currentIntervals}
              />
            )}
            {settings.mode === 'quiz' && (
              <QuizCard
                key={`${current.card.id}-${current.direction}`}
                card={current.card}
                direction={current.direction}
                options={quizOptions}
                onAnswer={handleQuizAnswer}
              />
            )}
            {settings.mode === 'writing' && (
              <WritingCard
                key={current.card.id}
                card={current.card}
                onGrade={applyAnswer}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
