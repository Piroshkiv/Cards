import type { CardProgress, MasteryLevel, Grade } from '../types'

// Фактические интервалы в минутах
export const LEVEL_INTERVALS: Record<MasteryLevel, number | null> = {
  0: null,
  1: 0.5,    // 30 сек  — «< 1 мин»
  2: 3,      //          — «< 3 мин»
  3: 10,     //          — «< 10 мин»
  4: 1440,   // 1 день  — «< 1 д»
  5: 14400,  // 10 дней — «< 10 д»
}

export const LEVEL_LABELS: Record<MasteryLevel, string> = {
  0: '—',
  1: '< 1 мин',
  2: '< 3 мин',
  3: '< 10 мин',
  4: '< 1 д',
  5: '< 10 д',
}

export function defaultProgress(): CardProgress {
  return { level: 0, dueDate: null }
}

export function introduceCard(): CardProgress {
  return { level: 1, dueDate: new Date().toISOString() }
}

export function applyGrade(progress: CardProgress, grade: Grade): CardProgress {
  const cur = progress.level === 0 ? 1 : progress.level
  let newLevel: MasteryLevel

  switch (grade) {
    case 0: newLevel = 1; break                                        // Again → уровень 1  (< 1 мин)
    case 1: newLevel = Math.max(2, cur) as MasteryLevel; break         // Hard  → мин уровень 2 (5 мин), не отступает
    case 2: newLevel = Math.min(5, cur + 2) as MasteryLevel; break     // Good  → +2 уровня (10 мин с уровня 1)
    case 3: newLevel = Math.min(5, cur + 3) as MasteryLevel; break     // Easy  → +3 уровня (1 день с уровня 1)
  }

  return {
    level: newLevel,
    dueDate: addMinutes(LEVEL_INTERVALS[newLevel]!),
  }
}

// Quiz: правильно = Good (+2), неправильно = сброс на 1
export function applyQuizResult(progress: CardProgress, correct: boolean): CardProgress {
  return applyGrade(progress, correct ? 2 : 0)
}

export function isDue(progress: CardProgress): boolean {
  if (progress.level === 0 || !progress.dueDate) return false
  return new Date(progress.dueDate) <= new Date()
}

export function nextDueDate(progress: CardProgress): Date | null {
  if (!progress.dueDate) return null
  return new Date(progress.dueDate)
}

// Интервалы для кнопок на основе текущего уровня карточки
export function gradeIntervals(progress: CardProgress): Record<Grade, number> {
  const cur = progress.level === 0 ? 1 : progress.level
  return {
    0: LEVEL_INTERVALS[1]!,
    1: LEVEL_INTERVALS[Math.max(2, cur) as MasteryLevel]!,
    2: LEVEL_INTERVALS[Math.min(5, cur + 2) as MasteryLevel]!,
    3: LEVEL_INTERVALS[Math.min(5, cur + 3) as MasteryLevel]!,
  }
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} с`
  if (minutes < 60) return `${minutes} мин`
  if (minutes < 1440) return `${Math.round(minutes / 60)} ч`
  return `${Math.round(minutes / 1440)} д`
}

function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}
