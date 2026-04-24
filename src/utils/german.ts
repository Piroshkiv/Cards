const GERMAN_ALPHABET = 'aäbcdefghijklmnoöpqrsßtuüvwxyz'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface Tile {
  id: string
  letter: string
}

// Returns shuffled tiles: correct answer letters + ~6 random extras
export function generateTiles(answer: string): Tile[] {
  const answerLetters = answer.toLowerCase().split('')
  const extraCount = 6
  const extras: string[] = []

  for (let i = 0; i < extraCount; i++) {
    extras.push(GERMAN_ALPHABET[Math.floor(Math.random() * GERMAN_ALPHABET.length)])
  }

  const all = [...answerLetters, ...extras]
  const shuffled = shuffle(all)

  return shuffled.map((letter, idx) => ({
    id: `${letter}-${idx}`,
    letter,
  }))
}

// For display: small tiles if word is long
export function getTileSize(answer: string): number {
  return answer.length > 12 ? 36 : 44
}
