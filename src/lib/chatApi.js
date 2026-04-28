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
  await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, msg }),
  })
  return msg
}
