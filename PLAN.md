# Cards App — Implementation Plan

## Stack
- Vite + React + TypeScript
- React Router v6
- papaparse (CSV)
- lucide-react (icons)
- localStorage (plain get/set utils)
- Plain CSS with CSS variables from DESIGN_MANIFEST.md

## Project Structure
```
src/
  pages/
    Home.tsx            # pack list + global stats
    PackDetail.tsx      # card list, add/delete cards
    Study.tsx           # setup → session → results
  components/
    FlashCard.tsx       # flip card + Anki buttons
    QuizCard.tsx        # 4-choice quiz
    WritingCard.tsx     # letter tiles
    PackCard.tsx        # pack preview on Home
    Button.tsx
    Badge.tsx
    Modal.tsx
  utils/
    sm2.ts              # SM-2 algorithm
    storage.ts          # localStorage get/set
    csv.ts              # papaparse wrapper
    deck.ts             # session queue, shuffle, due logic
    german.ts           # GERMAN_ALPHABET, tile generation
  types/
    index.ts
  styles/
    global.css
  main.tsx
  App.tsx               # Router + routes
```

## Data Model
```typescript
type CardState = 'new' | 'learning' | 'review'

interface CardProgress {
  state: CardState
  learningStep: number  // 0 | 1
  interval: number      // always minutes: 1d=1440, 10d=14400
  easeFactor: number    // min 1.3, default 2.5
  dueDate: string       // ISO datetime
}

interface Card {
  id: string
  word: string          // German
  translation: string   // translation
  flashcard: CardProgress
  quiz: CardProgress
  writing: CardProgress
}

interface Pack {
  id: string
  name: string
  cards: Card[]
  createdAt: string
}

type StudyMode = 'flashcard' | 'quiz' | 'writing'
type Direction = 'de_ru' | 'ru_de'

interface StudySettings {
  mode: StudyMode
  directions: Record<Direction, boolean>
}
// stored per-pack: studySettings[packId]
```

## Intervals (all in minutes)
| Button  | learning step 0 | learning step 1 | review     |
|---------|-----------------|-----------------|------------|
| Again   | step 0, +1min   | step 0, +1min   | step 0, +1min |
| Hard    | step 0, +5min   | step 0, +5min   | ×1.2       |
| Good    | step 1, +10min  | review, +1440   | ×EF        |
| Easy    | review, +1440   | review, +2880   | ×EF×1.3    |

EF = Math.max(1.3, newEF) always.
Display: < 60 → "N min", < 1440 → "N h", else → "N d"

## Session Logic
- Due cards (dueDate ≤ now): max 100, shuffle, first
- New cards (state='new'): max 20, shuffle, after due
- Quiz wrong answers: from same pack first, fallback to other packs
- Quiz with 2 directions: card appears twice (DE→RU, RU→DE as separate questions), SM-2 applied once with worstGrade
- SM-2 applied per-mode independently

## Routes
| URL          | Page       |
|--------------|------------|
| /            | Home       |
| /packs/:id   | PackDetail |
| /study/:id   | Study      |

Study phases (local state): setup → session → results

## Stats (Home)
- Per pack: total cards, due today (sum all modes), % learned (avg interval ≥ 21440 across modes)
- Global: total words, due today total

## CSV Import
- Format: packName,word,translation (no header)
- papaparse for parsing
- Pack exists → add missing words only (compare word.trim().toLowerCase())
- New cards init with defaultProgress() for all 3 modes

---

## Progress

### Phase 1 — Foundation
- [x] Vite + React + TS scaffolding
- [x] Install dependencies (react-router-dom, papaparse, lucide-react)
- [x] types/index.ts
- [x] styles/global.css + styles/components.css
- [x] App.tsx (router)
- [x] utils/storage.ts
- [x] utils/sm2.ts
- [x] utils/german.ts
- [x] utils/deck.ts
- [x] utils/csv.ts

### Phase 2 — Components
- [x] Button.tsx
- [x] Badge.tsx
- [x] Modal.tsx
- [x] PackCard.tsx
- [x] FlashCard.tsx
- [x] QuizCard.tsx
- [x] WritingCard.tsx

### Phase 3 — Pages
- [x] Home.tsx
- [x] PackDetail.tsx
- [x] Study.tsx (setup + session + results)

### Phase 4 — Refactor: level-based progression
- [x] Replace SM-2 with fixed 6-level ladder (null/1m/5m/10m/1d/10d)
- [x] QuizProgress: separate de_ru / ru_de levels per card
- [x] Again/Hard reset to level 1 (never below 1 for introduced cards)
- [x] Infinite sessions: introduce 1 new card when due < 3
- [x] Waiting state with countdown timer
- [x] Session status bar (due / cooldown / new)
- [x] Level dots on PackDetail (F / Q-DE / Q-RU / W)
- [x] results: answered + levelsGained

### Phase 5 — Remaining
- [ ] Responsive layout check
- [ ] Smoke test all 3 modes + CSV import
