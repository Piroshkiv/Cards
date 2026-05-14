import type { CardProgress, Grade } from '../types'

export interface RatingConfig {
  label: string
  target: number
  alpha: number
}

export const WORD_RATINGS: RatingConfig[] = [
  { label: 'hard',      target: 0,  alpha: 0.5 },
  { label: 'normal',    target: 3,  alpha: 0.3 },
  { label: 'easy',      target: 6,  alpha: 0.3 },
  { label: 'very easy', target: 15, alpha: 0.4 },
]

export const ARTICLE_RATINGS: RatingConfig[] = [
  { label: 'wrong',     target: 0,  alpha: 0.6 },
  { label: 'hesitated', target: 3,  alpha: 0.3 },
  { label: 'correct',   target: 8,  alpha: 0.4 },
]

export const ACTIVE_THRESHOLD = 2
export const MIN_ACTIVE = 8

export function defaultProgress(): CardProgress {
  return { n: 0, last_seen_session: 0 }
}

export function introduceCard(currentSession: number): CardProgress {
  return { n: 0, last_seen_session: currentSession }
}

export function applyWordGrade(
  progress: CardProgress,
  grade: Grade,
  currentSession: number,
): CardProgress {
  const { target, alpha } = WORD_RATINGS[grade]
  return {
    n: progress.n * (1 - alpha) + target * alpha,
    last_seen_session: currentSession,
  }
}

export function applyQuizResult(
  progress: CardProgress,
  correct: boolean,
  currentSession: number,
): CardProgress {
  return applyWordGrade(progress, correct ? 2 : 0, currentSession)
}

export function applyArticleResult(
  progress: CardProgress,
  correct: boolean,
  currentSession: number,
): CardProgress {
  const { target, alpha } = ARTICLE_RATINGS[correct ? 2 : 0]
  return {
    n: progress.n * (1 - alpha) + target * alpha,
    last_seen_session: currentSession,
  }
}

export function cardWeight(
  progress: CardProgress,
  currentSession: number,
  deckSize: number,
): number {
  const scale = Math.max(1, Math.log10(deckSize / 50))
  return (
    Math.pow(2, (-progress.n * scale) / 2) *
    (1 + 0.1 * (currentSession - progress.last_seen_session))
  )
}

export function isIntroduced(progress: CardProgress): boolean {
  return progress.last_seen_session > 0
}

export function isActive(progress: CardProgress): boolean {
  return isIntroduced(progress) && progress.n <= ACTIVE_THRESHOLD
}
