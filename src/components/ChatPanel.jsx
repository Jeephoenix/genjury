import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore, { PHASES } from '../lib/store'
import { fetchSince, postChat } from '../lib/chatApi'

export default function ChatPanel() {
  const roomCode = useGameStore(s => s.roomCode)
  const phase    = useGameStore(s => s.phase)
  const myId     = useGameStore(s => s.myId)
  const me       = useGameStore(s => s.players.find(p => p.id === myId))
  const messages = useGameStore(s => s.chatMessages)
  const pushChat = useGameStore(s => s.pushChat)

  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef(null)

  const objectionMode =
    phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE

  // ── Poll for new messages while we're in a room ────────────────────
  useEffect(() => {
    if (!roomCode || !me) return
    let cancelled = false
    let since = messages.length
      ? messages[messages.length - 1].ts
      : 0
    const intervalMs = objectionMode ? 1000 : 2500

    async function tick() {
      try {
        const fresh = await fetchSince(roomCode, since)
        if (cancelled || !fresh.length) return
        since = Number(fresh[fresh.length - 1].ts)
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
          if (!open && m.author_id !== me.id) {
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
  }, [roomCode, me?.id, objectionMode, open, pushChat])

  // ── Auto-scroll + clear unread when opening ────────────────────────
  useEffect(() => {
    if (open) setUnread(0)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  if (!roomCode || phase === PHASES.LOBBY) return null

  async function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !me) return
    setText('')
    try {
      const optimistic = await postChat(
        roomCode,
        me,
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
        className="fixed bottom-4 right-4 z-40 px-4 py-3 rounded-full bg-plasma/20 border border-plasma/40 text-plasma backdrop-blur shadow-lg hover:bg-plasma/30 transition"
      >
        💬 Chat
        {unread > 0 && (
          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neon text-void text-xs font-bold">
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
              <div className="text-sm uppercase tracking-wider text-white/70">
                {objectionMode ? '⚖️ Objections' : '🔥 Table Talk'}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white"
              >
                ✕
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
            >
              {messages.length === 0 && (
                <div className="text-white/40 text-sm text-center py-6">
                  No messages yet. Say something inflammatory.
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="text-lg leading-none mt-0.5">{m.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: m.color }}
                      >
                        {m.authorName}
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
                  objectionMode ? 'Object! Coordinate!' : 'Trash talk…'
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-plasma/60"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-3 py-2 rounded-lg bg-plasma/30 border border-plasma/50 text-plasma text-sm font-semibold hover:bg-plasma/40 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
              }
