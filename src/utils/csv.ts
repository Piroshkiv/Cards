import Papa from 'papaparse'
import type { Pack, Card } from '../types'
import { defaultProgress } from './progress'

function newCard(word: string, translation: string): Card {
  return {
    id: crypto.randomUUID(),
    word: word.trim(),
    translation: translation.trim(),
    flashcard: defaultProgress(),
    quiz: { de_ru: defaultProgress(), ru_de: defaultProgress() },
    writing: defaultProgress(),
  }
}

export interface ImportResult {
  created: string[]
  updated: string[]
  added: number
  errors: string[]
}

export function parseCSV(
  csvText: string,
  existingPacks: Pack[]
): { packs: Pack[]; result: ImportResult } {
  const packs = existingPacks.map(p => ({ ...p, cards: [...p.cards] }))
  const result: ImportResult = { created: [], updated: [], added: 0, errors: [] }

  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true })

  if (parsed.errors.length > 0) {
    result.errors = parsed.errors.map(e => e.message)
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]
    if (row.length < 3) {
      result.errors.push(`Строка ${i + 1}: недостаточно столбцов`)
      continue
    }
    const [packName, word, translation] = row.map(s => s.trim())
    if (!packName || !word || !translation) {
      result.errors.push(`Строка ${i + 1}: пустые значения`)
      continue
    }

    let pack = packs.find(p => p.name.toLowerCase() === packName.toLowerCase())
    if (!pack) {
      const now = new Date().toISOString()
      pack = { id: crypto.randomUUID(), name: packName, cards: [], createdAt: now, updatedAt: now, version: 1 }
      packs.push(pack)
      result.created.push(packName)
    }

    const exists = pack.cards.some(c => c.word.trim().toLowerCase() === word.toLowerCase())
    if (!exists) {
      pack.cards.push(newCard(word, translation))
      result.added++
      if (!result.created.includes(packName) && !result.updated.includes(packName)) {
        result.updated.push(packName)
      }
    }
  }

  return { packs, result }
}
