interface Env {
  DB: D1Database
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    try {
      if (request.method === 'GET' && parts.length === 2 && parts[1] === 'packs') {
        return handleListPacks(env)
      }

      if (request.method === 'GET' && parts.length === 3 && parts[1] === 'packs') {
        return handleGetPack(env, parts[2])
      }

      if (request.method === 'PUT' && parts.length === 3 && parts[1] === 'packs') {
        const body = await request.json() as PutBody
        return handlePutPack(env, parts[2], body)
      }

      if (request.method === 'POST' && parts.length === 4 && parts[1] === 'packs' && parts[3] === 'subscribe') {
        const body = await request.json() as SubscribeBody
        return handleSubscribe(env, parts[2], body)
      }

      if (request.method === 'POST' && parts.length === 4 && parts[1] === 'packs' && parts[3] === 'unsubscribe') {
        const body = await request.json() as SubscribeBody
        return handleUnsubscribe(env, parts[2], body)
      }

      return json({ error: 'Not found' }, 404)
    } catch (e) {
      return json({ error: String(e) }, 500)
    }
  },
}

async function handleListPacks(env: Env): Promise<Response> {
  const [packsResult, ownersResult] = await Promise.all([
    env.DB.prepare('SELECT id, name, version, updated_at, cards FROM packs ORDER BY updated_at DESC').all(),
    env.DB.prepare('SELECT pack_id, username FROM pack_owners').all(),
  ])

  const ownersByPack: Record<string, string[]> = {}
  for (const row of ownersResult.results) {
    const r = row as { pack_id: string; username: string }
    if (!ownersByPack[r.pack_id]) ownersByPack[r.pack_id] = []
    ownersByPack[r.pack_id].push(r.username)
  }

  const packs = packsResult.results.map(row => {
    const r = row as { id: string; name: string; version: number; updated_at: string; cards: string }
    const cards = JSON.parse(r.cards) as unknown[]
    return {
      id: r.id,
      name: r.name,
      version: r.version,
      updated_at: r.updated_at,
      owners: ownersByPack[r.id] ?? [],
      card_count: cards.length,
    }
  })

  return json(packs)
}

async function handleGetPack(env: Env, id: string): Promise<Response> {
  const [packRow, ownersResult] = await Promise.all([
    env.DB.prepare('SELECT id, name, version, updated_at, cards FROM packs WHERE id = ?').bind(id).first(),
    env.DB.prepare('SELECT username FROM pack_owners WHERE pack_id = ?').bind(id).all(),
  ])

  if (!packRow) return json({ error: 'Not found' }, 404)

  const r = packRow as { id: string; name: string; version: number; updated_at: string; cards: string }
  return json({
    id: r.id,
    name: r.name,
    version: r.version,
    updated_at: r.updated_at,
    cards: JSON.parse(r.cards),
    owners: ownersResult.results.map(o => (o as { username: string }).username),
  })
}

interface SyncCard {
  id: string
  word: string
  translation: string
}

interface PutBody {
  name: string
  cards: SyncCard[]
  version: number
  updated_at: string
  username: string
}

async function handlePutPack(env: Env, id: string, body: PutBody): Promise<Response> {
  const { name, cards, version, updated_at, username } = body
  const cardsJson = JSON.stringify(cards)

  await env.DB.prepare(`
    INSERT INTO packs (id, name, cards, version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      cards = excluded.cards,
      version = excluded.version,
      updated_at = excluded.updated_at
    WHERE excluded.version > packs.version
       OR (excluded.version = packs.version AND excluded.updated_at > packs.updated_at)
  `).bind(id, name, cardsJson, version, updated_at).run()

  await env.DB.prepare('INSERT OR IGNORE INTO pack_owners (pack_id, username) VALUES (?, ?)')
    .bind(id, username).run()

  return json({ ok: true })
}

interface SubscribeBody {
  username: string
}

async function handleSubscribe(env: Env, id: string, body: SubscribeBody): Promise<Response> {
  const { username } = body

  const pack = await env.DB.prepare('SELECT id FROM packs WHERE id = ?').bind(id).first()
  if (!pack) return json({ error: 'Pack not found' }, 404)

  await env.DB.prepare('INSERT OR IGNORE INTO pack_owners (pack_id, username) VALUES (?, ?)')
    .bind(id, username).run()

  return json({ ok: true })
}

async function handleUnsubscribe(env: Env, id: string, body: SubscribeBody): Promise<Response> {
  const { username } = body
  await env.DB.prepare('DELETE FROM pack_owners WHERE pack_id = ? AND username = ?')
    .bind(id, username).run()
  return json({ ok: true })
}
