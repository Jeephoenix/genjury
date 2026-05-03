const BASE = '/api/chat'

export async function fetchSince(roomCode, since, userId) {
  const uid = userId ? `&userId=${encodeURIComponent(userId)}` : ''
  const r = await fetch(`${BASE}?room=${encodeURIComponent(roomCode)}&since=${since}${uid}`)
  if (r.status === 403) return []   // not a member — silently return empty
  if (!r.ok) throw new Error('fetch failed')
  return (await r.json()).messages || []
}

export async function registerMember(roomCode, userId, isHost = false) {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'join', roomCode, userId: String(userId).toLowerCase(), isHost }),
  })
  if (!r.ok) throw new Error('register failed')
  return r.json()
}

export async function clearRoom(roomCode, userId) {
  const r = await fetch(
    `${BASE}?room=${encodeURIComponent(roomCode)}&userId=${encodeURIComponent(String(userId).toLowerCase())}`,
    { method: 'DELETE' }
  )
  if (!r.ok) throw new Error('clear failed')
  return r.json()
}

export async function postChat(roomCode, player, text, kind = 'taunt', replyTo = null) {
  const msg = {
    id: crypto.randomUUID(),
    authorId: String(player.id).toLowerCase(),
    authorName: player.name,
    avatar: player.avatar,
    color: player.color,
    text: text.slice(0, 280),
    kind,
    ts: Date.now(),
    replyTo: replyTo || null,
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
  const r = await fetch(BASE, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, msgId, emoji, userId: String(userId).toLowerCase() }),
  })
  if (!r.ok) throw new Error('reaction failed')
  const data = await r.json()
  return data.reactions || {}
}
