const BASE = '/api/chat'

export async function fetchSince(roomCode, since) {
  const r = await fetch(`${BASE}?room=${encodeURIComponent(roomCode)}&since=${since}`)
  if (!r.ok) throw new Error('fetch failed')
  return (await r.json()).messages || []
}

export async function postChat(roomCode, player, text, kind = 'taunt') {
  const msg = {
    id: crypto.randomUUID(),
    authorId: player.id,
    authorName: player.name,
    avatar: player.avatar,
    color: player.color,
    text: text.slice(0, 280),
    kind,
    ts: Date.now(),
  }
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, msg }),
  })
  if (!res.ok) throw new Error('post failed')
  return msg
}

  export async function toggleReaction(roomCode, msgId, emoji, userId) {
    const r = await fetch('/api/chat', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomCode, msgId, emoji, userId }),
    })
    if (!r.ok) throw new Error('reaction failed')
    const data = await r.json()
    return data.reactions || {}
  }
  