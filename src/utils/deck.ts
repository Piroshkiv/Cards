import type { Card, StudyMode, Direction, Pack } from '../types'
import {
  isIntroduced, isActive, cardWeight, introduceCard,
  MIN_ACTIVE,
} from './progress'
import { getPacks, savePack } from './storage'

export interface QueueItem {
  card: Card
  direction: Direction
}

function itemKey(card: Card, mode: StudyMode, direction: Direction): string {
  if (mode === 'quiz') return `${card.id}::${direction}`
  return card.id
}

function isArticleCard(card: Card): boolean {
  return card.article === 'der' || card.article === 'die' || card.article === 'das'
}

function countActive(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>,
): number {
  let count = 0
  for (const card of pack.cards) {
    if (mode === 'flashcard') {
      if (isActive(card.flashcard)) count++
    } else if (mode === 'quiz') {
      if (directions.de_ru && isActive(card.quiz.de_ru)) count++
      if (directions.ru_de && isActive(card.quiz.ru_de)) count++
    } else if (mode === 'article') {
      if (isArticleCard(card) && isActive(card.article_prog)) count++
    } else {
      if (isActive(card.writing)) count++
    }
  }
  return count
}

// Introduce one new card if active count < MIN_ACTIVE. Mutates pack and saves.
export function ensureMinActive(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>,
  currentSession: number,
): void {
  if (countActive(pack, mode, directions) >= MIN_ACTIVE) return

  if (mode === 'flashcard') {
    const card = pack.cards.find(c => !isIntroduced(c.flashcard))
    if (!card) return
    card.flashcard = introduceCard(currentSession)
    savePack(pack)
  } else if (mode === 'quiz') {
    const card = pack.cards.find(c =>
      (directions.de_ru && !isIntroduced(c.quiz.de_ru)) ||
      (directions.ru_de && !isIntroduced(c.quiz.ru_de)),
    )
    if (!card) return
    if (directions.de_ru && !isIntroduced(card.quiz.de_ru))
      card.quiz.de_ru = introduceCard(currentSession)
    if (directions.ru_de && !isIntroduced(card.quiz.ru_de))
      card.quiz.ru_de = introduceCard(currentSession)
    savePack(pack)
  } else if (mode === 'article') {
    const card = pack.cards.find(c => isArticleCard(c) && !isIntroduced(c.article_prog))
    if (!card) return
    card.article_prog = introduceCard(currentSession)
    savePack(pack)
  } else {
    const card = pack.cards.find(c => !isIntroduced(c.writing))
    if (!card) return
    card.writing = introduceCard(currentSession)
    savePack(pack)
  }
}

// Weighted random pick from all introduced cards (excluding excludeKey to avoid immediate repeat)
export function pickNextItem(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>,
  currentSession: number,
  excludeKey?: string,
): QueueItem | null {
  const candidates: Array<{ item: QueueItem; weight: number }> = []
  const deckSize = pack.cards.length

  for (const card of pack.cards) {
    if (mode === 'flashcard') {
      if (!isIntroduced(card.flashcard)) continue
      const dir = pickDir(directions)
      const key = itemKey(card, mode, dir)
      if (key === excludeKey) continue
      candidates.push({
        item: { card, direction: dir },
        weight: cardWeight(card.flashcard, currentSession, deckSize),
      })
    } else if (mode === 'quiz') {
      for (const dir of (['de_ru', 'ru_de'] as Direction[])) {
        if (!directions[dir]) continue
        const prog = dir === 'de_ru' ? card.quiz.de_ru : card.quiz.ru_de
        if (!isIntroduced(prog)) continue
        const key = itemKey(card, mode, dir)
        if (key === excludeKey) continue
        candidates.push({
          item: { card, direction: dir },
          weight: cardWeight(prog, currentSession, deckSize),
        })
      }
    } else if (mode === 'article') {
      if (!isArticleCard(card) || !isIntroduced(card.article_prog)) continue
      const key = itemKey(card, mode, 'de_ru')
      if (key === excludeKey) continue
      candidates.push({
        item: { card, direction: 'de_ru' },
        weight: cardWeight(card.article_prog, currentSession, deckSize),
      })
    } else {
      if (!isIntroduced(card.writing)) continue
      const key = itemKey(card, mode, 'ru_de')
      if (key === excludeKey) continue
      candidates.push({
        item: { card, direction: 'ru_de' },
        weight: cardWeight(card.writing, currentSession, deckSize),
      })
    }
  }

  if (candidates.length === 0) return null

  const total = candidates.reduce((s, c) => s + c.weight, 0)
  let rand = Math.random() * total
  for (const c of candidates) {
    rand -= c.weight
    if (rand <= 0) return c.item
  }
  return candidates[candidates.length - 1].item
}

export interface SessionStatus {
  active: number
  newCards: number
}

export function getSessionStatus(
  pack: Pack,
  mode: StudyMode,
  directions: Record<Direction, boolean>,
): SessionStatus {
  let active = 0
  let newCards = 0

  for (const c of pack.cards) {
    if (mode === 'flashcard') {
      if (isActive(c.flashcard)) active++
      else if (!isIntroduced(c.flashcard)) newCards++
    } else if (mode === 'quiz') {
      if (directions.de_ru) {
        if (isActive(c.quiz.de_ru)) active++
        else if (!isIntroduced(c.quiz.de_ru)) newCards++
      }
      if (directions.ru_de) {
        if (isActive(c.quiz.ru_de)) active++
        else if (!isIntroduced(c.quiz.ru_de)) newCards++
      }
    } else if (mode === 'article') {
      if (!isArticleCard(c)) continue
      if (isActive(c.article_prog)) active++
      else if (!isIntroduced(c.article_prog)) newCards++
    } else {
      if (isActive(c.writing)) active++
      else if (!isIntroduced(c.writing)) newCards++
    }
  }
  return { active, newCards }
}

// Quiz: 3 wrong options
export function getWrongOptions(
  correct: Card,
  packCards: Card[],
  direction: Direction,
): Card[] {
  const getLabel = (c: Card) => direction === 'de_ru' ? c.translation : c.word
  const correctLabel = getLabel(correct)
  const pool = shuffle(packCards.filter(c => c.id !== correct.id && getLabel(c) !== correctLabel))
  if (pool.length >= 3) return pool.slice(0, 3)
  const allCards = getPacks().flatMap(p => p.cards)
  const fallback = shuffle(
    allCards.filter(c => c.id !== correct.id && getLabel(c) !== correctLabel && !pool.find(p => p.id === c.id)),
  )
  return [...pool, ...fallback].slice(0, 3)
}

// "Active" cards for home screen: introduced AND n ≤ ACTIVE_THRESHOLD in any mode
export function countActiveCards(cards: Card[]): number {
  const ids = new Set<string>()
  for (const c of cards) {
    if (isActive(c.flashcard) || isActive(c.quiz.de_ru) || isActive(c.quiz.ru_de) || isActive(c.writing) || isActive(c.article_prog))
      ids.add(c.id)
  }
  return ids.size
}

export function avgMasteryPercent(cards: Card[]): number {
  if (cards.length === 0) return 0
  const MAX_N = 15
  const total = cards.reduce((sum, c) => {
    const flash = Math.min(c.flashcard.n / MAX_N, 1)
    const quiz  = Math.min((c.quiz.de_ru.n + c.quiz.ru_de.n) / 2 / MAX_N, 1)
    const write = Math.min(c.writing.n / MAX_N, 1)
    return sum + (flash + quiz + write) / 3
  }, 0)
  return Math.round((total / cards.length) * 100)
}

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
