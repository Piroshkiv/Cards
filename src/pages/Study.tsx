import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { X, ArrowLeft } from 'lucide-react'
import {
  getPack, saveStudySettings, getStudySettings, savePack,
  getCurrentSession, incrementSession,
} from '../utils/storage'
import { applyWordGrade, applyQuizResult } from '../utils/progress'
import {
  ensureMinActive, pickNextItem, getSessionStatus, getWrongOptions, isArticleCard,
  type QueueItem,
} from '../utils/deck'
import { FlashCard } from '../components/FlashCard'
import { QuizCard } from '../components/QuizCard'
import { WritingCard } from '../components/WritingCard'
import { ArticleCard } from '../components/ArticleCard'
import type { StudyMode, Direction, Grade, StudySettings } from '../types'
import { applyArticleResult } from '../utils/progress'

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

  const [phase, setPhase] = useState<Phase>('setup')
  const [settings, setSettings] = useState<StudySettings>(() => {
    const s = getStudySettings(id!)
    const pack = getPack(id!)
    if (s.mode === 'quiz' && (pack?.cards.length ?? 0) < 4) return { ...s, mode: 'flashcard' }
    return s
  })

  const [queue, setQueue]       = useState<QueueItem[]>([])
  const [answered, setAnswered] = useState(0)
  const [currentSession, setCurrentSession] = useState(getCurrentSession)

  // Cards truly new (last_seen_session===0 before introduction this session)
  const brandNewIds = useRef(new Set<string>())

  // Quiz batch: 10 cards per direction before switching
  const BATCH_SIZE = 10
  const [batchDir, setBatchDir]     = useState<Direction>('de_ru')
  const [batchCount, setBatchCount] = useState(0)

  const activeDirs = useMemo((): Record<Direction, boolean> => {
    if (settings.mode !== 'quiz' || !settings.directions.de_ru || !settings.directions.ru_de)
      return settings.directions
    return { de_ru: batchDir === 'de_ru', ru_de: batchDir === 'ru_de' }
  }, [settings.mode, settings.directions, batchDir])

  const pack = getPack(id!)

  const current = queue[0] ?? null

  const quizOptions = useMemo(() => {
    if (settings.mode !== 'quiz' || !current || !pack) return []
    const wrong = getWrongOptions(current.card, pack.cards, current.direction)
    return shuffle([current.card, ...wrong])
  }, [current?.card.id, current?.direction, settings.mode])

  if (!pack) {
    return <div className="page"><p>Пак не найден. <Link to="/">На главную</Link></p></div>
  }

  function pickNext(
    freshPack: NonNullable<typeof pack>,
    dirs: Record<Direction, boolean>,
    session: number,
    excludeKey?: string,
  ): void {
    if (settings.mode === 'article') {
      // Snapshot which article cards are truly unseen before ensureMinActive introduces one
      const neverSeen = new Set(
        freshPack.cards
          .filter(c => isArticleCard(c) && c.article_prog.last_seen_session === 0)
          .map(c => c.id)
      )
      ensureMinActive(freshPack, settings.mode, dirs, session)
      // Whatever card was just introduced (last_seen_session flipped from 0) is brand new
      for (const c of freshPack.cards) {
        if (neverSeen.has(c.id) && c.article_prog.last_seen_session > 0) {
          brandNewIds.current.add(c.id)
        }
      }
    } else {
      ensureMinActive(freshPack, settings.mode, dirs, session)
    }
    const next = pickNextItem(freshPack, settings.mode, dirs, session, excludeKey)
    setQueue(next ? [next] : [])
  }

  function cardKey(item: QueueItem): string {
    return settings.mode === 'quiz' ? `${item.card.id}::${item.direction}` : item.card.id
  }

  // ─── Flashcard & Writing answer ───────────────────────────────────────────

  function applyAnswer(grade: Grade) {
    if (!current) return

    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!

    if (settings.mode === 'flashcard') {
      card.flashcard = applyWordGrade(card.flashcard, grade, currentSession)
    } else {
      card.writing = applyWordGrade(card.writing, grade, currentSession)
    }
    savePack(fresh)
    setAnswered(n => n + 1)
    pickNext(fresh, activeDirs, currentSession, cardKey(current))
  }

  // ─── Article intro (new word shown, user clicks OK) ───────────────────────

  function handleArticleIntro() {
    if (!current) return
    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!
    // Assign small starting n so word comes back for review but isn't looped immediately
    card.article_prog = { n: 0, last_seen_session: currentSession }
    savePack(fresh)
    setAnswered(n => n + 1)
    brandNewIds.current.delete(current.card.id)
    pickNext(fresh, activeDirs, currentSession, cardKey(current))
  }

  // ─── Article answer ───────────────────────────────────────────────────────

  function handleArticleAnswer(correct: boolean) {
    if (!current) return
    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!
    card.article_prog = applyArticleResult(card.article_prog, correct, currentSession)
    savePack(fresh)
    setAnswered(n => n + 1)
    pickNext(fresh, activeDirs, currentSession, cardKey(current))
  }

  // ─── Quiz answer ─────────────────────────────────────────────────────────

  function handleQuizAnswer(correct: boolean) {
    if (!current) return

    const fresh = getPack(id!)!
    const card  = fresh.cards.find(c => c.id === current.card.id)!

    const prog = current.direction === 'de_ru' ? card.quiz.de_ru : card.quiz.ru_de
    const updated = applyQuizResult(prog, correct, currentSession)
    if (current.direction === 'de_ru') card.quiz.de_ru = updated
    else card.quiz.ru_de = updated
    savePack(fresh)
    setAnswered(n => n + 1)

    const bothDirs = settings.directions.de_ru && settings.directions.ru_de
    let nextDirs = activeDirs
    if (bothDirs) {
      const newCount = batchCount + 1
      if (newCount >= BATCH_SIZE) {
        const newDir: Direction = batchDir === 'de_ru' ? 'ru_de' : 'de_ru'
        nextDirs = { de_ru: newDir === 'de_ru', ru_de: newDir === 'ru_de' }
        setBatchDir(newDir)
        setBatchCount(0)
      } else {
        setBatchCount(newCount)
      }
    }

    pickNext(fresh, nextDirs, currentSession, cardKey(current))
  }

  // ─── SETUP ───────────────────────────────────────────────────────────────

  function handleStart() {
    saveStudySettings(id!, settings)
    setAnswered(0)
    brandNewIds.current = new Set()
    setPhase('session')

    const session = incrementSession()
    setCurrentSession(session)

    const startDir: Direction = Math.random() < 0.5 ? 'de_ru' : 'ru_de'
    setBatchDir(startDir)
    setBatchCount(0)

    const startDirs: Record<Direction, boolean> =
      settings.mode === 'quiz' && settings.directions.de_ru && settings.directions.ru_de
        ? { de_ru: startDir === 'de_ru', ru_de: startDir === 'ru_de' }
        : settings.directions

    const fresh = getPack(id!)!
    pickNext(fresh, startDirs, session)
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
            {(['flashcard', 'quiz', 'writing', 'article'] as StudyMode[]).map(mode => {
              const canArticle = pack.cards.filter(c => c.article === 'der' || c.article === 'die' || c.article === 'das').length >= 3
              const disabled = (mode === 'quiz' && !canQuiz) || (mode === 'article' && !canArticle)
              const titles: Record<StudyMode, string> = { flashcard: 'Карточки', quiz: 'Квиз', writing: 'Написание', article: 'Артикль' }
              const descs:  Record<StudyMode, string>  = {
                flashcard: 'Переворот + оценка',
                quiz:      canQuiz ? '4 варианта ответа' : 'Нужно ≥ 4 слов',
                writing:   'Собери слово из букв',
                article:   canArticle ? 'der / die / das' : 'Нужно ≥ 3 слов с артиклем',
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
          <div className="results__grid results__grid--1">
            <div className="results__item results__item--primary">
              <span className="results__value">{answered}</span>
              <span className="results__label">ответов</span>
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
  const status = getSessionStatus(freshPack, settings.mode, settings.directions)

  return (
    <div className="page">
      <div className="study-header">
        <button className="btn-icon" onClick={() => setPhase('results')} title="Завершить">
          <X size={20} />
        </button>
        {settings.mode !== 'article' && (
          <div className="session-status">
            <span className="session-status__item session-status__item--due">{status.active} активных</span>
            <span className="session-status__item session-status__item--new">{status.newCards} новых</span>
          </div>
        )}
        <span className="study-counter">{answered}</span>
      </div>

      <div className="study-content">
        {current ? (
          <>
            {settings.mode === 'flashcard' && (
              <FlashCard
                key={`${current.card.id}-${current.direction}`}
                card={current.card}
                direction={current.direction}
                onGrade={applyAnswer}
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
            {settings.mode === 'article' && (
              <ArticleCard
                key={current.card.id}
                card={current.card}
                isNew={brandNewIds.current.has(current.card.id)}
                onAnswer={handleArticleAnswer}
                onIntro={handleArticleIntro}
              />
            )}
          </>
        ) : (
          <div className="waiting-state card">
            <h3>Нет слов для изучения</h3>
            <p>Добавьте слова в пак</p>
            <button className="btn btn--secondary btn--md" onClick={() => setPhase('results')}>
              Завершить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
