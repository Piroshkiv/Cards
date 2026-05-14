export interface CardProgress {
  n: number                  // float, starts at 0
  last_seen_session: number  // 0 = not yet introduced
}

export interface QuizProgress {
  de_ru: CardProgress
  ru_de: CardProgress
}

export type Article = 'der' | 'die' | 'das' | '-' | ''

export interface Card {
  id: string
  word: string      // singular
  plural: string
  article: Article
  translation: string
  flashcard: CardProgress
  quiz: QuizProgress
  writing: CardProgress
  article_prog: CardProgress
}

export interface Pack {
  id: string
  name: string
  cards: Card[]
  createdAt: string
  updatedAt: string
  version: number
  createdBy: string
}

export type StudyMode = 'flashcard' | 'quiz' | 'writing' | 'article'
export type Direction = 'de_ru' | 'ru_de'

export interface StudySettings {
  mode: StudyMode
  directions: Record<Direction, boolean>
}

// 0=hard, 1=normal, 2=easy, 3=very_easy (maps to WORD_RATINGS)
export type Grade = 0 | 1 | 2 | 3
