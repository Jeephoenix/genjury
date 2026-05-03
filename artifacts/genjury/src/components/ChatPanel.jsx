import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Scale, X, Send, ChevronRight } from 'lucide-react'
import useGameStore, { PHASES } from '../lib/store'
import { fetchSince, postChat, toggleReaction } from '../lib/chatApi'
import { getProfile, subscribeProfile, displayName } from '../lib/profile'
import { myAddress } from '../lib/genlayer'
import Avatar from './Avatar'

export default function ChatPanel() {
  const roomCode = useGameStore(s => s.roomCode)
  const phase    = useGameStore(s => s.phase)
  const myId     = useGameStore(s => s.myId)
  const messages = useGameStore(s => s.chatMessages)
  const pushChat           = useGameStore(s => s.pushChat)
    const patchChatReaction  = useGameStore(s => s.patchChatReaction)

  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [unread, setUnread]  = useState(0)
    const [apiOk,  setApiOk]   = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [, force]           = useState(0)
  const scrollRef           = useRef(null)
  const inputRef            = useRef(null)
  const longPressTimer      = useRef(null)

  const activePhase    = phase === PHASES.WRITING || phase === PHASES.VOTING
  const objectionMode  = phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE

  // Auto-collapse during active timed phases
  useEffect(() => {
    if (activePhase) setOpen(false)
  }, [activePhase])

  useEffect(() => subscribeProfile(() => force((n) => n + 1)), [])

  const profile = getProfile()
  const meId    = myId || (myAddress() || '').toLowerCase() || 'guest'

  // ── Poll for new messages ──────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return
    let cancelled = false
    let since = messages.length
      ? Number(messages[messages.length - 1].ts) || 0
      : 0
    const intervalMs = objectionMode ? 1000 : 2500

    let failCount = 0
      async function tick() {
        try {
          const fresh = await fetchSince(roomCode, since)
          if (cancelled) return
          failCount = 0
          if (!apiOk) setApiOk(true)
          if (!fresh.length) return
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
              reactions:  m.reactions || {},
            })
            if (!open && m.author_id !== meId) setUnread(u => u + 1)
          }
        } catch {
          if (!cancelled) {
            failCount++
            if (failCount >= 3) setApiOk(false)
          }
        }
      }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, objectionMode, open, pushChat, meId])

  // ── Scroll to bottom + clear unread on open ────────────────────────
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

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
        roomCode, player, t,
        objectionMode ? 'objection' : 'taunt',
      )
      pushChat(optimistic)
    } catch {
      setText(t)
    }
  }

  const REACTION_EMOJIS = ['👍', '🔥', '⚖️']

    async function react(msgId, emoji) {
      const msg = messages.find(m => m.id === msgId)
      if (!msg) return
      const current  = msg.reactions || {}
      const users    = current[emoji] || []
      const removing = users.includes(meId)
      // Optimistic update
      const updated = { ...current }
      if (removing) {
        updated[emoji] = users.filter(u => u !== meId)
        if (!updated[emoji].length) delete updated[emoji]
      } else {
        updated[emoji] = [...users, meId]
      }
      patchChatReaction(msgId, updated)
      setHoveredId(null)
      try {
        const fresh = await toggleReaction(roomCode, msgId, emoji, meId)
        patchChatReaction(msgId, fresh)
      } catch {
        patchChatReaction(msgId, current) // rollback
      }
    }

    function startLongPress(msgId) {
      longPressTimer.current = setTimeout(() => setHoveredId(msgId), 400)
    }
    function cancelLongPress() { clearTimeout(longPressTimer.current) }

    const panelTitle = objectionMode
    ? <><Scale className="w-4 h-4 text-neon" strokeWidth={2.25} />Objections</>
    : <><MessageSquare className="w-4 h-4 text-plasma" strokeWidth={2.25} />Table Talk</>

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-40 px-4 py-2.5 rounded-full glass border border-plasma/35 text-plasma hover:bg-plasma/20 hover:border-plasma/55 transition-all duration-200 inline-flex items-center gap-2 shadow-lg backdrop-blur-xl"
        aria-label="Toggle chat"
      >
        {open
          ? <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          : <MessageSquare className="w-4 h-4" strokeWidth={2.25} />
        }
        <span className="text-sm font-semibold">{open ? 'Close' : 'Chat'}</span>
        {!open && unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neon text-void text-xs font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/*
              ── Backdrop (mobile only) ──
              Tapping outside the drawer closes it.
              Hidden on sm+ since the panel is just a floating card there.
            */}
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/*
              ── Drawer / Panel ──
              Mobile  : full-height right drawer (slides in from right edge)
              Desktop : small floating card above the toggle button
            */}
            <motion.aside
              key="chat-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240, mass: 0.9 }}
              className={[
                // shared
                'fixed right-0 z-50 flex flex-col',
                'border-white/[0.08] bg-void/95 backdrop-blur-2xl shadow-2xl',
                // mobile: full height, full width, no rounded corners, border-l only
                'top-0 bottom-0 w-full border-l',
                // desktop: floating card with rounded corners, constrained size
                'sm:top-auto sm:bottom-20 sm:w-[340px] sm:max-h-[65vh] sm:rounded-2xl sm:border sm:border-white/10',
              ].join(' ')}
              aria-label="Chat panel"
            >
              {/* Top accent line */}
              <div className="h-px bg-gradient-to-r from-transparent via-plasma/50 to-transparent flex-shrink-0" />

              {/*
                ── Panel header ──
                On mobile: extra top padding to clear the 2-row game header (80 px).
                On desktop: normal padding.
              */}
              <div className="flex items-center justify-between px-4 py-3 pt-[84px] sm:pt-3 border-b border-white/[0.07] flex-shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80 uppercase tracking-wider">
                  {panelTitle}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </div>

              {/* ── Message list ── */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-3 overscroll-contain"
              >
                {!apiOk && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-1">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
                    Chat service unavailable — retrying…
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="text-white/30 text-sm text-center py-10 flex flex-col items-center gap-2">
                    <MessageSquare className="w-8 h-8 text-white/10" strokeWidth={1.5} />
                    <span>No messages yet.</span>
                    <span className="text-xs text-white/20">Be the first to say something.</span>
                  </div>
                )}
                {messages.map(m => {
                    const rxEntries = Object.entries(m.reactions || {}).filter(([, u]) => u.length > 0)
                    return (
                      <div
                        key={m.id}
                        className={`flex items-start gap-2.5 ${m.authorId === meId ? 'flex-row-reverse' : ''}`}
                        onMouseEnter={() => setHoveredId(m.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onTouchStart={() => startLongPress(m.id)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                      >
                        <Avatar
                          name={m.authorName}
                          src={m.avatar && m.avatar.startsWith('data:') ? m.avatar : ''}
                          color={m.color}
                          size={28}
                        />
                        <div className={`flex-1 min-w-0 ${m.authorId === meId ? 'items-end' : 'items-start'} flex flex-col`}>
                          {m.authorId !== meId && (
                            <div className="flex items-baseline gap-1.5 mb-0.5">
                              <span className="text-xs font-semibold" style={{ color: m.color || '#a259ff' }}>
                                {m.authorName || 'Player'}
                              </span>
                              {m.kind === 'objection' && (
                                <span className="text-[10px] uppercase tracking-wider text-neon font-bold">objection</span>
                              )}
                            </div>
                          )}
                          {/* Bubble + floating reaction picker */}
                          <div className="relative">
                            {hoveredId === m.id && (
                              <div className={`absolute -top-9 z-10 flex gap-0.5 px-1 py-1 rounded-xl bg-void/95 border border-white/10 shadow-xl backdrop-blur-xl ${m.authorId === meId ? 'right-0' : 'left-0'}`}>
                                {REACTION_EMOJIS.map(e => (
                                  <button
                                    key={e}
                                    onClick={() => react(m.id, e)}
                                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                                      (m.reactions?.[e] || []).includes(meId)
                                        ? 'bg-plasma/25 border border-plasma/40'
                                        : 'hover:bg-white/10'
                                    }`}
                                    aria-label={`React ${e}`}
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div
                              className={`rounded-2xl px-3 py-2 text-sm break-words max-w-[85%] leading-snug ${
                                m.authorId === meId
                                  ? 'bg-plasma/20 border border-plasma/25 text-white rounded-tr-sm'
                                  : 'bg-white/[0.06] border border-white/[0.07] text-white/90 rounded-tl-sm'
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                          {/* Reaction pills */}
                          {rxEntries.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${m.authorId === meId ? 'justify-end' : 'justify-start'}`}>
                              {rxEntries.map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => react(m.id, emoji)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                                    users.includes(meId)
                                      ? 'bg-plasma/20 border-plasma/40 text-plasma'
                                      : 'bg-white/[0.05] border-white/[0.08] text-white/50 hover:bg-white/[0.08]'
                                  }`}
                                >
                                  {emoji} <span>{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* ── Input bar ── */}
              <form
                onSubmit={submit}
                className="flex gap-2 p-3 border-t border-white/[0.07] flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <input
                  ref={inputRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={280}
                  placeholder={objectionMode ? 'Object! Coordinate!' : 'Say something…'}
                  className="flex-1 bg-white/[0.05] border border-white/[0.09] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-plasma/50 focus:bg-white/[0.07] transition-all"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="w-11 h-11 rounded-xl bg-plasma/25 border border-plasma/40 text-plasma hover:bg-plasma/35 hover:border-plasma/60 disabled:opacity-30 transition-all flex items-center justify-center flex-shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" strokeWidth={2.25} />
                </button>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
