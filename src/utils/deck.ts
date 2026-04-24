import type { Card, CardProgress, StudyMode, Direction, Pack } from '../types'
import { isDue, introduceCard } from './progress'
import { getPacks, savePack } from './storage'

export interface QueueItem {
  card: Card
  direction: Direction
}

const INTRODUCE_THRESHOLD = 3

// Все due-элементы из хранилища, отсортированные по dueDate (давнишние первые)
export function buildDueQueue(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>
): QueueItem[] {
  const items: QueueItem[] = []

  if (mode === 'flashcard') {
    for (const card of pack.cards) {
      if (isDue(card.flashcard))
        items.push({ card, direction: pickDir(directions) })
    }
  } else if (mode === 'quiz') {
    for (const card of pack.cards) {
      if (directions.de_ru && isDue(card.quiz.de_ru))
        items.push({ card, direction: 'de_ru' })
      if (directions.ru_de && isDue(card.quiz.ru_de))
        items.push({ card, direction: 'ru_de' })
    }
  } else {
    for (const card of pack.cards) {
      if (isDue(card.writing))
        items.push({ card, direction: 'ru_de' })
    }
  }

  return items.sort((a, b) =>
    new Date(getProgress(a, mode).dueDate!).getTime() -
    new Date(getProgress(b, mode).dueDate!).getTime()
  )
}

// Вводит одно новое слово и возвращает его как QueueItem[].
// Мутирует pack и сохраняет.
export function introduceToQueue(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>
): QueueItem[] {
  if (mode === 'flashcard') {
    const card = pack.cards.find(c => c.flashcard.level === 0)
    if (!card) return []
    card.flashcard = introduceCard()
    savePack(pack)
    return [{ card, direction: pickDir(directions) }]
  } else if (mode === 'quiz') {
    const card = pack.cards.find(c =>
      (directions.de_ru && c.quiz.de_ru.level === 0) ||
      (directions.ru_de && c.quiz.ru_de.level === 0)
    )
    if (!card) return []
    const added: QueueItem[] = []
    if (directions.de_ru && card.quiz.de_ru.level === 0) {
      card.quiz.de_ru = introduceCard()
      added.push({ card, direction: 'de_ru' })
    }
    if (directions.ru_de && card.quiz.ru_de.level === 0) {
      card.quiz.ru_de = introduceCard()
      added.push({ card, direction: 'ru_de' })
    }
    savePack(pack)
    return added
  } else {
    const card = pack.cards.find(c => c.writing.level === 0)
    if (!card) return []
    card.writing = introduceCard()
    savePack(pack)
    return [{ card, direction: 'ru_de' }]
  }
}

function itemKey(item: QueueItem) {
  return `${item.card.id}::${item.direction}`
}

/**
 * Перестройка очереди после ответа.
 *
 * Порядок результирующей очереди:
 *   1. due-карточки из хранилища, которых ещё нет в очереди (вставляются спереди)
 *   2. существующие элементы очереди (remaining после удаления текущего)
 *   3. если grade === 0 (Again): текущая карточка помещается в конец
 *   4. новое слово в конец если итого < 3
 *
 * Параметры:
 *   pack      — свежий пак из хранилища (ПОСЛЕ сохранения ответа)
 *   remaining — очередь без первого элемента (queue.slice(1))
 *   againItem — передать если grade === 0
 */
export function refreshQueueState(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>,
  remaining: QueueItem[],
  againItem?: QueueItem
): QueueItem[] {
  // Ключи уже присутствующих в очереди (+ Again если есть)
  const inQueue = new Set([
    ...remaining.map(itemKey),
    ...(againItem ? [itemKey(againItem)] : []),
  ])

  // Новые due-карточки из хранилища которых ещё нет в очереди
  const newDue = buildDueQueue(pack, mode, directions)
    .filter(i => !inQueue.has(itemKey(i)))

  // Собираем: [newDue..., remaining..., again?]
  let result: QueueItem[] = [
    ...newDue,
    ...remaining,
    ...(againItem ? [againItem] : []),
  ]

  // Добавляем новое слово в конец если очередь < порога
  if (result.length < INTRODUCE_THRESHOLD) {
    const introduced = introduceToQueue(pack, mode, directions)
    result = [...result, ...introduced]
  }

  return result
}

// Ближайшее время когда станет due карточка (для waiting state)
export function getNextDueTime(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>
): Date | null {
  const dates: Date[] = []
  for (const card of pack.cards) {
    if (mode === 'flashcard' && card.flashcard.level > 0 && card.flashcard.dueDate)
      dates.push(new Date(card.flashcard.dueDate))
    else if (mode === 'quiz') {
      if (directions.de_ru && card.quiz.de_ru.level > 0 && card.quiz.de_ru.dueDate)
        dates.push(new Date(card.quiz.de_ru.dueDate))
      if (directions.ru_de && card.quiz.ru_de.level > 0 && card.quiz.ru_de.dueDate)
        dates.push(new Date(card.quiz.ru_de.dueDate))
    } else if (mode === 'writing' && card.writing.level > 0 && card.writing.dueDate)
      dates.push(new Date(card.writing.dueDate))
  }
  const future = dates.filter(d => d > new Date())
  if (future.length === 0) return null
  return new Date(Math.min(...future.map(d => d.getTime())))
}

// Статус для шапки сессии
export interface SessionStatus {
  due: number
  cooldown: number
  notStarted: number
}

export function getSessionStatus(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>
): SessionStatus {
  let due = 0, cooldown = 0, notStarted = 0
  for (const c of pack.cards) {
    if (mode === 'flashcard') {
      if (c.flashcard.level === 0) notStarted++
      else if (isDue(c.flashcard)) due++
      else cooldown++
    } else if (mode === 'quiz') {
      if (directions.de_ru) {
        if (c.quiz.de_ru.level === 0) notStarted++
        else if (isDue(c.quiz.de_ru)) due++
        else cooldown++
      }
      if (directions.ru_de) {
        if (c.quiz.ru_de.level === 0) notStarted++
        else if (isDue(c.quiz.ru_de)) due++
        else cooldown++
      }
    } else {
      if (c.writing.level === 0) notStarted++
      else if (isDue(c.writing)) due++
      else cooldown++
    }
  }
  return { due, cooldown, notStarted }
}

// Quiz: 3 неправильных варианта
export function getWrongOptions(
  correct: Card,
  packCards: Card[],
  direction: Direction
): Card[] {
  const getLabel = (c: Card) => direction === 'de_ru' ? c.translation : c.word
  const correctLabel = getLabel(correct)
  const pool = shuffle(packCards.filter(c => c.id !== correct.id && getLabel(c) !== correctLabel))
  if (pool.length >= 3) return pool.slice(0, 3)
  const allCards = getPacks().flatMap(p => p.cards)
  const fallback = shuffle(
    allCards.filter(c => c.id !== correct.id && getLabel(c) !== correctLabel && !pool.find(p => p.id === c.id))
  )
  return [...pool, ...fallback].slice(0, 3)
}

// Статистика для главной
export function countDueToday(cards: Card[]): number {
  const ids = new Set<string>()
  for (const c of cards) {
    if (isDue(c.flashcard) || isDue(c.quiz.de_ru) || isDue(c.quiz.ru_de) || isDue(c.writing))
      ids.add(c.id)
  }
  return ids.size
}

export function avgMasteryPercent(cards: Card[]): number {
  if (cards.length === 0) return 0
  const total = cards.reduce((sum, c) => {
    const flash = c.flashcard.level / 5
    const quiz  = (c.quiz.de_ru.level + c.quiz.ru_de.level) / 2 / 5
    const write = c.writing.level / 5
    return sum + (flash + quiz + write) / 3
  }, 0)
  return Math.round((total / cards.length) * 100)
}

// Хелперы
function pickDir(directions: Record<Direction, boolean>): Direction {
  if (directions.de_ru && directions.ru_de) return Math.random() < 0.5 ? 'de_ru' : 'ru_de'
  return directions.de_ru ? 'de_ru' : 'ru_de'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getProgress(item: QueueItem, mode: StudyMode): CardProgress {
  if (mode === 'flashcard') return item.card.flashcard
  if (mode === 'quiz') return item.direction === 'de_ru' ? item.card.quiz.de_ru : item.card.quiz.ru_de
  return item.card.writing
}
