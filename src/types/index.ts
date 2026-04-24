// 0 = не введено, 1-5 = лесенка интервалов
export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface CardProgress {
  level: MasteryLevel
  dueDate: string | null  // null если level === 0
}

// Quiz отдельно по направлениям
export interface QuizProgress {
  de_ru: CardProgress
  ru_de: CardProgress
}

export interface Card {
  id: string
  word: string          // немецкое
  translation: string
  flashcard: CardProgress
  quiz: QuizProgress
  writing: CardProgress
}

export interface Pack {
  id: string
  name: string
  cards: Card[]
  createdAt: string
  updatedAt: string
  version: number
}

export type StudyMode = 'flashcard' | 'quiz' | 'writing'
export type Direction = 'de_ru' | 'ru_de'

export interface StudySettings {
  mode: StudyMode
  directions: Record<Direction, boolean>
}

// Grade: 0=Again 1=Hard 2=Good 3=Easy
export type Grade = 0 | 1 | 2 | 3

export interface SessionStats {
  answered: number
  levelsGained: number
}
