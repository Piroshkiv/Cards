import type { Pack, Card } from '../types'
import {
  getPacks, savePacks, getPack, deletePack,
  getSyncQueue, addToSyncQueue, removeFromSyncQueue,
} from './storage'
import { defaultProgress } from './progress'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? 'https://cards-sync.laim0999716349.workers.dev'

interface RemotePackSummary {
  id: string
  name: string
  version: number
  updated_at: string
  created_by: string
  owners: string[]
  card_count: number
}

interface RemoteCard {
  id: string
  article: string
  word: string
  plural: string
  translation: string
}

interface RemoteFullPack {
  id: string
  name: string
  version: number
  updated_at: string
  created_by: string
  cards: RemoteCard[]
  owners: string[]
}

function stripProgress(pack: Pack): RemoteCard[] {
  return pack.cards.map(c => ({ id: c.id, article: c.article ?? '', word: c.word, plural: c.plural ?? '', translation: c.translation }))
}

function mergeCards(localPack: Pack | undefined, remoteCards: RemoteCard[]): Card[] {
  const localById = new Map(localPack?.cards.map(c => [c.id, c]) ?? [])
  return remoteCards.map(rc => {
    const local = localById.get(rc.id)
    if (local) return { ...local, article: rc.article as any ?? '', word: rc.word, plural: rc.plural ?? '', translation: rc.translation }
    return {
      id: rc.id,
      article: rc.article as any ?? '',
      word: rc.word,
      plural: rc.plural ?? '',
      translation: rc.translation,
      flashcard: defaultProgress(),
      quiz: { de_ru: defaultProgress(), ru_de: defaultProgress() },
      writing: defaultProgress(),
      article_prog: defaultProgress(),
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
      created_by: pack.createdBy || username,
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
    createdBy: remote.created_by,
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

export async function removeOwnerFromServer(packId: string, username: string): Promise<void> {
  await fetch(`${WORKER_URL}/api/packs/${packId}/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  }).catch(() => {})
}

export async function unsubscribeFromPack(packId: string, username: string): Promise<void> {
  deletePack(packId)
  await removeOwnerFromServer(packId, username)
}

// ─── Progress sync ───────────────────────────────────────────────────────────

type ProgressMap = Record<string, {
  flashcard: unknown; quiz: unknown; writing: unknown; article_prog: unknown
}>

function extractProgress(pack: Pack): ProgressMap {
  const map: ProgressMap = {}
  for (const c of pack.cards) {
    map[c.id] = { flashcard: c.flashcard, quiz: c.quiz, writing: c.writing, article_prog: c.article_prog }
  }
  return map
}

function mergeProgress(pack: Pack, remote: ProgressMap): Pack {
  return {
    ...pack,
    cards: pack.cards.map(c => {
      const rp = remote[c.id]
      if (!rp) return c
      return { ...c, ...(rp as object) }
    }),
  }
}

async function pushProgress(pack: Pack, username: string): Promise<void> {
  const res = await fetch(`${WORKER_URL}/api/progress/${pack.id}/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress: extractProgress(pack), updated_at: pack.updatedAt }),
  })
  if (!res.ok) throw new Error(`Progress push failed: ${res.status}`)
}

async function pullProgress(pack: Pack, username: string): Promise<Pack> {
  const res = await fetch(`${WORKER_URL}/api/progress/${pack.id}/${encodeURIComponent(username)}`)
  if (!res.ok) return pack
  const { progress } = await res.json() as { progress: ProgressMap; updated_at: string }
  if (!progress || Object.keys(progress).length === 0) return pack
  return mergeProgress(pack, progress)
}

// ─── Main sync ───────────────────────────────────────────────────────────────

export async function syncAll(username: string): Promise<void> {
  if (!WORKER_URL) return

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

  for (const local of localPacks) {
    const remote = remoteById.get(local.id)
    if (!remote || localIsNewer(local, remote)) {
      try { await pushPack(local, username) }
      catch { addToSyncQueue(local.id) }
    }
    // Always push local progress
    try { await pushProgress(local, username) } catch { /* offline */ }
  }

  const localById = new Map(localPacks.map(p => [p.id, p]))
  for (const remote of remoteList) {
    if (!remote.owners.includes(username)) continue
    const local = localById.get(remote.id)
    if (local && !remoteIsNewer(local, remote)) {
      // Pack content is current, but still pull progress
      try {
        const merged = await pullProgress(local, username)
        const idx = updatedPacks.findIndex(p => p.id === local.id)
        if (idx >= 0) updatedPacks[idx] = merged
      } catch { /* skip */ }
      continue
    }

    try {
      const res = await fetch(`${WORKER_URL}/api/packs/${remote.id}`)
      if (!res.ok) continue
      const full: RemoteFullPack = await res.json()

      let merged: Pack = {
        id: full.id,
        name: full.name,
        version: full.version,
        updatedAt: full.updated_at,
        createdAt: local?.createdAt ?? full.updated_at,
        createdBy: full.created_by,
        cards: mergeCards(local, full.cards),
      }

      merged = await pullProgress(merged, username).catch(() => merged)

      const idx = updatedPacks.findIndex(p => p.id === full.id)
      if (idx >= 0) updatedPacks[idx] = merged
      else updatedPacks.push(merged)
    } catch { /* skip pack */ }
  }

  savePacks(updatedPacks)
}
