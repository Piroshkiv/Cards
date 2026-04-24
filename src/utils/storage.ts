import type { Pack, StudySettings, CardProgress } from '../types'

const PACKS_KEY = 'cards_packs'
const SETTINGS_KEY = 'cards_study_settings'
const USERNAME_KEY = 'cards_username'
const SYNC_QUEUE_KEY = 'cards_sync_queue'

const EMPTY_PROGRESS: CardProgress = { level: 0, dueDate: null }

// Миграция: старый формат quiz был плоским CardProgress, новый — { de_ru, ru_de }
function migratePack(raw: unknown): Pack {
  const pack = raw as Pack
  const migrated: Pack = {
    ...pack,
    version: pack.version ?? 1,
    updatedAt: pack.updatedAt ?? pack.createdAt,
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
  return migrated
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
  const now = new Date().toISOString()
  if (idx >= 0) {
    packs[idx] = { ...pack, version: (pack.version ?? 1) + 1, updatedAt: now }
  } else {
    packs.push({ ...pack, version: pack.version ?? 1, updatedAt: pack.updatedAt ?? now })
  }
  savePacks(packs)
  addToSyncQueue(pack.id)
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

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY)
}

export function saveUsername(name: string): void {
  localStorage.setItem(USERNAME_KEY, name.trim())
}

export function getSyncQueue(): string[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addToSyncQueue(packId: string): void {
  const q = getSyncQueue()
  if (!q.includes(packId)) {
    q.push(packId)
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q))
  }
}

export function removeFromSyncQueue(packId: string): void {
  const q = getSyncQueue().filter(id => id !== packId)
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q))
}
