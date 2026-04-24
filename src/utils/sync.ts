import type { Pack, Card } from '../types'
import {
  getPacks, savePacks, getPack, deletePack,
  getSyncQueue, addToSyncQueue, removeFromSyncQueue, removeFromMyPackIds,
} from './storage'
import { defaultProgress } from './progress'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'https://cards-sync.laim0999716349.workers.dev'

interface RemotePackSummary {
  id: string
  name: string
  version: number
  updated_at: string
  owners: string[]
  card_count: number
}

interface RemoteCard {
  id: string
  word: string
  translation: string
}

interface RemoteFullPack {
  id: string
  name: string
  version: number
  updated_at: string
  cards: RemoteCard[]
  owners: string[]
}

function stripProgress(pack: Pack): RemoteCard[] {
  return pack.cards.map(c => ({ id: c.id, word: c.word, translation: c.translation }))
}

function mergeCards(localPack: Pack | undefined, remoteCards: RemoteCard[]): Card[] {
  const localById = new Map(localPack?.cards.map(c => [c.id, c]) ?? [])
  return remoteCards.map(rc => {
    const local = localById.get(rc.id)
    if (local) return { ...local, word: rc.word, translation: rc.translation }
    return {
      id: rc.id,
      word: rc.word,
      translation: rc.translation,
      flashcard: defaultProgress(),
      quiz: { de_ru: defaultProgress(), ru_de: defaultProgress() },
      writing: defaultProgress(),
    }
  })
}

function remoteIsNewer(local: Pack, remote: RemotePackSummary | RemoteFullPack): boolean {
  const remoteUpdatedAt = 'updated_at' in remote ? remote.updated_at : ''
  return remote.version > local.version ||
    (remote.version === local.version && remoteUpdatedAt > local.updatedAt)
}

function localIsNewer(local: Pack, remote: RemotePackSummary): boolean {
  return local.version > remote.version ||
    (local.version === remote.version && local.updatedAt > remote.updated_at)
}

export async function pushPack(pack: Pack, username: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/api/packs/${pack.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: pack.name,
      cards: stripProgress(pack),
      version: pack.version,
      updated_at: pack.updatedAt,
      username,
    }),
  })
  if (!res.ok) throw new Error(`Push failed: ${res.status}`)
}

export async function fetchAllPacks(): Promise<RemotePackSummary[]> {
  const res = await fetch(`${WORKER_URL}/api/packs`)
  if (!res.ok) throw new Error(`Fetch list failed: ${res.status}`)
  return res.json()
}

export async function subscribeToPack(packId: string, username: string): Promise<Pack> {
  const res = await fetch(`${WORKER_URL}/api/packs/${packId}`)
  if (!res.ok) throw new Error(`Fetch pack failed: ${res.status}`)
  const remote: RemoteFullPack = await res.json()

  const localPack = getPack(packId)
  const merged: Pack = {
    id: remote.id,
    name: remote.name,
    version: remote.version,
    updatedAt: remote.updated_at,
    createdAt: localPack?.createdAt ?? remote.updated_at,
    cards: mergeCards(localPack, remote.cards),
  }

  const packs = getPacks()
  const idx = packs.findIndex(p => p.id === packId)
  if (idx >= 0) packs[idx] = merged
  else packs.push(merged)
  savePacks(packs)

  await fetch(`${WORKER_URL}/api/packs/${packId}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  return merged
}

export async function unsubscribeFromPack(packId: string, username: string): Promise<void> {
  deletePack(packId)
  removeFromMyPackIds(packId)
  await fetch(`${WORKER_URL}/api/packs/${packId}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
}

export async function syncAll(username: string): Promise<void> {
  if (!WORKER_URL) return

  // Flush offline queue
  for (const packId of getSyncQueue()) {
    const pack = getPack(packId)
    if (!pack) { removeFromSyncQueue(packId); continue }
    try {
      await pushPack(pack, username)
      removeFromSyncQueue(packId)
    } catch { /* retry next time */ }
  }

  let remoteList: RemotePackSummary[]
  try {
    remoteList = await fetchAllPacks()
  } catch {
    return // offline
  }

  const remoteById = new Map(remoteList.map(r => [r.id, r]))
  const localPacks = getPacks()
  const updatedPacks = [...localPacks]

  // Push local packs that are newer or not on server
  for (const local of localPacks) {
    const remote = remoteById.get(local.id)
    if (!remote || localIsNewer(local, remote)) {
      try { await pushPack(local, username) }
      catch { addToSyncQueue(local.id) }
    }
  }

  // Pull remote packs where user is owner and remote is newer
  const localById = new Map(localPacks.map(p => [p.id, p]))
  for (const remote of remoteList) {
    if (!remote.owners.includes(username)) continue
    const local = localById.get(remote.id)
    if (local && !remoteIsNewer(local, remote)) continue

    try {
      const res = await fetch(`${WORKER_URL}/api/packs/${remote.id}`)
      if (!res.ok) continue
      const full: RemoteFullPack = await res.json()

      const merged: Pack = {
        id: full.id,
        name: full.name,
        version: full.version,
        updatedAt: full.updated_at,
        createdAt: local?.createdAt ?? full.updated_at,
        cards: mergeCards(local, full.cards),
      }

      const idx = updatedPacks.findIndex(p => p.id === full.id)
      if (idx >= 0) updatedPacks[idx] = merged
      else updatedPacks.push(merged)
    } catch { /* skip pack */ }
  }

  savePacks(updatedPacks)
}
