# Pack Sync Plan

## Architecture

- **Worker storage**: Cloudflare D1 (SQLite). Free tier: 5M reads/day, 100k writes/day.
- **Sync model**: Shared ownership — all subscribers see one version, anyone can edit.
- **Progress**: Never synced. Worker stores only card content (word + translation).
- **Conflict resolution**: Last-write-wins (higher version wins; equal version → newer `updated_at`).
- **Auth**: Username only, stored in localStorage. Same name = same account.
- **Pack GUID**: Existing `id: string` field reused as sync identifier.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/packs` | List all packs `[{id, name, version, owners, card_count}]` |
| GET | `/api/packs/:id` | Full pack `{id, name, version, cards: [{id, word, translation}], owners}` |
| PUT | `/api/packs/:id` | Create or update pack. Body: `{name, cards, version, updated_at, username}` |
| POST | `/api/packs/:id/subscribe` | Add username to owners. Body: `{username}` |

---

## Phase 1 — Types & Local Storage
- [x] Add `version: number` to `Pack` interface in `types/index.ts`
- [x] Auto-increment version in `savePack()` in `storage.ts`
- [x] Add `getUsername()` / `saveUsername()` to `storage.ts`
- [x] Add `getSyncQueue()` / `addToSyncQueue()` / `removeFromSyncQueue()` to `storage.ts`

## Phase 2 — Cloudflare Worker
- [x] Create `wrangler.toml`
- [x] Create D1 schema `worker/schema.sql`
- [x] Write Worker API `worker/index.ts` (4 routes + CORS)

## Phase 3 — Client Sync Service
- [x] Create `src/utils/sync.ts`
  - [x] `pushPack(pack, username)` — strip progress, PUT to worker
  - [x] `subscribeToPack(packId, username)` — fetch full pack + POST subscribe
  - [x] `syncAll(username)` — startup sync: pull newer, push newer, flush queue

## Phase 4 — Account UI
- [x] Username modal on first visit (no username in localStorage)
- [x] Username display + change button in Home header

## Phase 5 — Browse & Subscribe UI
- [x] "Чужие паки" button on Home (next to "Загрузить CSV")
- [x] Modal with list of all worker packs (name, owners, card count)
- [x] "Подписаться" button per pack → `subscribeToPack()`

## Phase 6 — Sync Status & Auto-sync
- [x] Sync status indicator on Home (Синхронизировано / Синхронизация... / Офлайн)
- [x] Auto-sync on app load (`useEffect` in `App.tsx`)
- [x] Push on every pack mutation (hook in `savePack`)
