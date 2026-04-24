import type { Pack, StudySettings, CardProgress } from '../types'

const PACKS_KEY = 'cards_packs'
const SETTINGS_KEY = 'cards_study_settings'

const EMPTY_PROGRESS: CardProgress = { level: 0, dueDate: null }

// Миграция: старый формат quiz был плоским CardProgress, новый — { de_ru, ru_de }
function migratePack(pack: Pack): Pack {
  return {
    ...pack,
    cards: pack.cards.map(card => {
      const quiz = card.quiz as unknown as Record<string, unknown>
      // Если quiz это плоский прогресс (старый формат) — конвертируем
      if (quiz && 'level' in quiz && !('de_ru' in quiz)) {
        return {
          ...card,
          quiz: { de_ru: EMPTY_PROGRESS, ru_de: EMPTY_PROGRESS },
        }
      }
      // Если quiz.de_ru или quiz.ru_de отсутствует — подставляем дефолт
      return {
        ...card,
        quiz: {
          de_ru: (card.quiz as any)?.de_ru ?? EMPTY_PROGRESS,
          ru_de: (card.quiz as any)?.ru_de ?? EMPTY_PROGRESS,
        },
      }
    }),
  }
}

export function getPacks(): Pack[] {
  try {
    const raw = localStorage.getItem(PACKS_KEY)
    const packs: Pack[] = raw ? JSON.parse(raw) : []
    return packs.map(migratePack)
  } catch { return [] }
}

export function savePacks(packs: Pack[]): void {
  localStorage.setItem(PACKS_KEY, JSON.stringify(packs))
}

export function getPack(id: string): Pack | undefined {
  return getPacks().find(p => p.id === id)
}

export function savePack(pack: Pack): void {
  const packs = getPacks()
  const idx = packs.findIndex(p => p.id === pack.id)
  if (idx >= 0) packs[idx] = pack
  else packs.push(pack)
  savePacks(packs)
}

export function deletePack(id: string): void {
  savePacks(getPacks().filter(p => p.id !== id))
}

export function getStudySettings(packId: string): StudySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[packId] ?? defaultStudySettings()
  } catch { return defaultStudySettings() }
}

export function saveStudySettings(packId: string, settings: StudySettings): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[packId] = settings
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(all))
  } catch { }
}

function defaultStudySettings(): StudySettings {
  return { mode: 'flashcard', directions: { de_ru: true, ru_de: true } }
}
