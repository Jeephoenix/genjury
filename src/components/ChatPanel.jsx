import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Scale, X, Send } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import { fetchSince, postChat } from '../lib/chatApi'
import { getProfile, subscribeProfile, displayName } from '../lib/profile'
import { myAddress } from '../lib/genlayer'
import Avatar from './Avatar'

export default function ChatPanel() {
  const roomCode = useGameStore(s => s.roomCode)
  const phase    = useGameStore(s => s.phase)
  const myId     = useGameStore(s => s.myId)
  const messages = useGameStore(s => s.chatMessages)
  const pushChat = useGameStore(s => s.pushChat)

  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [unread, setUnread] = useState(0)
  const [, force]           = useState(0)
  const scrollRef = useRef(null)

  // Auto-collapse chat during active game phases to avoid covering gameplay UI
  const activePhase = phase === PHASES.WRITING || phase === PHASES.VOTING
  useEffect(() => {
    if (activePhase) setOpen(false)
  }, [activePhase])

  // Re-render when the user updates their profile so chat shows the new
  // name / avatar without a refresh.
  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  const objectionMode =
    phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE

  // Identity for outgoing chat — wallet address (or fallback id) + profile.
  // No longer requires the user to be in the on-chain players list, so they
  // can chat in the lobby and as soon as they open a room.
  const profile = getProfile()
  const meId = myId || (myAddress() || '').toLowerCase() || 'guest'

  // ── Poll for new messages while we're in a room ────────────────────
  useEffect(() => {
    if (!roomCode) return
    let cancelled = false
    let since = messages.length
      ? Number(messages[messages.length - 1].ts) || 0
      : 0
    const intervalMs = objectionMode ? 1000 : 2500

    async function tick() {
      try {
        const fresh = await fetchSince(roomCode, since)
        if (cancelled || !fresh.length) return
        since = Number(fresh[fresh.length - 1].ts) || since
        for (const m of fresh) {
          pushChat({
            id:         m.id,
            authorId:   m.author_id,
            authorName: m.author_name,
            avatar:     m.avatar,
            color:      m.color,
            text:       m.text,
            kind:       m.kind,
            ts:         Number(m.ts),
          })
          if (!open && m.author_id !== meId) {
            setUnread(u => u + 1)
          }
        }
      } catch {
        /* ignore transient errors */
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, objectionMode, open, pushChat, meId])

  // ── Auto-scroll + clear unread when opening ────────────────────────
  useEffect(() => {
    if (open) setUnread(0)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  // Chat is available the moment the user is in a room — including the
  // lobby — so people can coordinate before the first round.
  if (!roomCode) return null

  async function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    try {
      const player = {
        id:     meId,
        name:   profile.name || displayName(meId),
        avatar: '',
        color:  profile.color,
      }
      const optimistic = await postChat(
        roomCode,
        player,
        t,
        objectionMode ? 'objection' : 'taunt',
      )
      pushChat(optimistic)
    } catch {
      // Re-fill on failure so the user doesn't lose their text.
      setText(t)
    }
  }

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-40 px-4 py-3 rounded-full bg-plasma/20 border border-plasma/40 text-plasma backdrop-blur shadow-lg hover:bg-plasma/30 transition inline-flex items-center gap-2"
        aria-label="Toggle chat"
      >
        <MessageSquare className="w-4 h-4" strokeWidth={2.25} />
        <span className="text-sm font-semibold">Chat</span>
        {unread > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neon text-void text-xs font-bold">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="fixed bottom-20 right-4 z-40 w-[340px] max-h-[60vh] flex flex-col rounded-2xl border border-white/10 bg-void/90 backdrop-blur-xl shadow-2xl"
          >
            <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-sm uppercase tracking-wider text-white/70 inline-flex items-center gap-2">
                {objectionMode ? (
                  <>
                    <Scale className="w-4 h-4 text-neon" strokeWidth={2.25} />
                    Objections
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 text-plasma" strokeWidth={2.25} />
                    Table Talk
                  </>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
            >
              {messages.length === 0 && (
                <div className="text-white/40 text-sm text-center py-6">
                  No messages yet. Be the first to say something.
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <Avatar
                    name={m.authorName}
                    src={m.avatar && m.avatar.startsWith('data:') ? m.avatar : ''}
                    color={m.color}
                    size={24}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: m.color || '#a259ff' }}
                      >
                        {m.authorName || 'Player'}
                      </span>
                      {m.kind === 'objection' && (
                        <span className="text-[10px] uppercase tracking-wider text-neon">
                          objection
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/90 break-words">
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={submit}
              className="p-2 border-t border-white/10 flex gap-2"
            >
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={280}
                placeholder={
                  objectionMode ? 'Object! Coordinate!' : 'Say something…'
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-plasma/60"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-3 py-2 rounded-lg bg-plasma/30 border border-plasma/50 text-plasma text-sm font-semibold hover:bg-plasma/40 disabled:opacity-40 inline-flex items-center gap-1.5"
                aria-label="Send"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2.25} />
                Send
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
