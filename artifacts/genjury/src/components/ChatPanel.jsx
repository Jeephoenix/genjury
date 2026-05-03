import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Scale, X, Send, ChevronRight, ChevronDown, Reply } from 'lucide-react'
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
  const pushChat          = useGameStore(s => s.pushChat)
  const patchChatReaction = useGameStore(s => s.patchChatReaction)
  const openProfileCard   = useGameStore(s => s.openProfileCard)

  const [open, setOpen]             = useState(false)
  const [minimized, setMinimized]   = useState(false)
  const [text, setText]             = useState('')
  const [unread, setUnread]         = useState(0)
  const [apiOk, setApiOk]           = useState(true)
  const apiOkRef                    = React.useRef(true)
  const [hoveredId, setHoveredId]   = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [, force]                   = useState(0)
  const scrollRef        = useRef(null)
  const inputRef         = useRef(null)
  const longPressTimer   = useRef(null)
  const swipeStart       = useRef(null)      // horizontal swipe (reply)
  const headerDrag       = useRef(null)      // vertical swipe (minimize)

  const activePhase   = phase === PHASES.WRITING || phase === PHASES.VOTING
  const objectionMode = phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE
  const chatLocked    = phase === PHASES.LOBBY || phase === PHASES.SCOREBOARD || !phase

  // Auto-collapse during timed active phases
  useEffect(() => {
    if (activePhase) setOpen(false)
  }, [activePhase])

  // Reset minimized when panel closes entirely
  useEffect(() => {
    if (!open) setMinimized(false)
  }, [open])

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
        const fresh = await fetchSince(roomCode, since, meId)
        if (cancelled) return
        failCount = 0
        if (!apiOkRef.current) { apiOkRef.current = true; setApiOk(true) }
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
            replyTo:    m.reply_to || null,
          })
          // Count as unread if panel is closed OR minimized
          if ((!open || minimized) && m.author_id !== meId) setUnread(u => u + 1)
        }
      } catch {
        if (!cancelled) {
          failCount++
          if (failCount >= 3) { apiOkRef.current = false; setApiOk(false) }
        }
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, objectionMode, open, minimized, pushChat, meId])

  // ── Scroll to bottom + clear unread when fully open ───────────────
  useEffect(() => {
    if (open && !minimized) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
    if (open && !minimized && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, minimized])

  if (!roomCode) return null

  // ── Toggle button click logic ──────────────────────────────────────
  function handleToggle() {
    if (!open) {
      setOpen(true)
      setMinimized(false)
    } else if (minimized) {
      setMinimized(false)   // expand pill back to full panel
    } else {
      setOpen(false)        // close entirely
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (chatLocked) return
    const t = text.trim()
    if (!t) return
    const currentReply = replyingTo
    setText('')
    setReplyingTo(null)
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
        currentReply,
      )
      pushChat(optimistic)
    } catch {
      setText(t)
      setReplyingTo(currentReply)
    }
  }

  const REACTION_EMOJIS = ['👍', '🔥', '⚖️']

  async function react(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const current  = msg.reactions || {}
    const users    = current[emoji] || []
    const removing = users.includes(meId)
    const updated  = { ...current }
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
      patchChatReaction(msgId, current)
    }
  }

  function triggerReply(msg) {
    setReplyingTo({ id: msg.id, authorName: msg.authorName, text: msg.text, color: msg.color })
    setHoveredId(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  function startLongPress(msg) {
    longPressTimer.current = setTimeout(() => setHoveredId(msg.id), 400)
  }
  function cancelLongPress() { clearTimeout(longPressTimer.current) }

  // ── Horizontal swipe-right on messages → reply ─────────────────────
  function onMsgTouchStart(e, msg) {
    swipeStart.current = { x: e.touches[0].clientX, id: msg.id, msg }
    startLongPress(msg)
  }
  function onMsgTouchMove(e) {
    cancelLongPress()
    if (!swipeStart.current) return
    const dx = e.touches[0].clientX - swipeStart.current.x
    if (dx > 60) {
      triggerReply(swipeStart.current.msg)
      swipeStart.current = null
    }
  }
  function onMsgTouchEnd() {
    cancelLongPress()
    swipeStart.current = null
  }

  // ── Vertical swipe-down on header → minimize ───────────────────────
  function onHeaderTouchStart(e) {
    headerDrag.current = { y: e.touches[0].clientY }
  }
  function onHeaderTouchMove(e) {
    if (!headerDrag.current) return
    const dy = e.touches[0].clientY - headerDrag.current.y
    if (dy > 55) {
      setMinimized(true)
      headerDrag.current = null
    }
  }
  function onHeaderTouchEnd() {
    headerDrag.current = null
  }

  const panelTitle = objectionMode
    ? <><Scale className="w-4 h-4 text-neon" strokeWidth={2.25} />Objections</>
    : <><MessageSquare className="w-4 h-4 text-plasma" strokeWidth={2.25} />Table Talk</>

  // Label + icon for the floating pill/toggle button
  const pillLabel    = open && !minimized ? 'Close' : 'Chat'
  const pillIcon     = open && !minimized
    ? <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
    : <MessageSquare className="w-4 h-4" strokeWidth={2.25} />
  const showUnread   = (!open || minimized) && unread > 0

  return (
    <>
      {/* ── Floating pill / toggle button ─────────────────────────────── */}
      <motion.button
        onClick={handleToggle}
        layout
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-[4.5rem] md:bottom-6 right-4 z-[55] px-4 py-2.5 rounded-full glass border border-plasma/35 text-plasma hover:bg-plasma/20 hover:border-plasma/55 transition-colors duration-200 inline-flex items-center gap-2 shadow-lg backdrop-blur-xl"
        aria-label="Toggle chat"
      >
        {pillIcon}
        <span className="text-sm font-semibold">{pillLabel}</span>
        <AnimatePresence>
          {showUnread && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 400 }}
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neon text-void text-xs font-bold"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Full chat panel (only when open and not minimized) ─────────── */}
      <AnimatePresence>
        {open && !minimized && (
          <>
            {/* Backdrop — mobile only */}
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

            <motion.aside
              key="chat-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240, mass: 0.9 }}
              className={[
                'fixed right-0 z-50 flex flex-col',
                'border-white/[0.08] bg-void/95 backdrop-blur-2xl shadow-2xl',
                'top-0 bottom-0 w-full border-l',
                'sm:top-auto sm:bottom-20 sm:w-[340px] sm:max-h-[65vh] sm:rounded-2xl sm:border sm:border-white/10',
              ].join(' ')}
              aria-label="Chat panel"
            >
              {/* Top accent line */}
              <div className="h-px bg-gradient-to-r from-transparent via-plasma/50 to-transparent flex-shrink-0" />

              {/* ── Panel header — swipe down to minimize ── */}
              <div
                className="flex items-center justify-between px-4 py-3 pt-[84px] sm:pt-3 border-b border-white/[0.07] flex-shrink-0 select-none"
                onTouchStart={onHeaderTouchStart}
                onTouchMove={onHeaderTouchMove}
                onTouchEnd={onHeaderTouchEnd}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80 uppercase tracking-wider">
                  {panelTitle}
                </div>

                {/* Swipe hint pill — visible on mobile */}
                <div className="absolute left-1/2 -translate-x-1/2 top-[88px] sm:top-1.5 w-8 h-1 rounded-full bg-white/[0.12] sm:hidden" />

                <div className="flex items-center gap-1">
                  {/* Minimize button (desktop fallback) */}
                  <button
                    onClick={() => setMinimized(true)}
                    className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/30 hover:text-white/70 hover:bg-white/10 transition-all flex items-center justify-center"
                    aria-label="Minimize chat"
                    title="Minimize"
                  >
                    <ChevronDown className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                  {/* Close button */}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4" strokeWidth={2.25} />
                  </button>
                </div>
              </div>

              {/* ── Message list ── */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-2 overscroll-contain"
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
                  const isMe      = m.authorId === meId
                  const rxEntries = Object.entries(m.reactions || {}).filter(([, u]) => u.length > 0)

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onTouchStart={e => onMsgTouchStart(e, m)}
                      onTouchMove={onMsgTouchMove}
                      onTouchEnd={onMsgTouchEnd}
                    >
                      {/* Avatar */}
                      <button
                        type="button"
                        className="flex-shrink-0 rounded-full hover:opacity-80 active:scale-95 transition-all mb-0.5"
                        onClick={() => openProfileCard({ address: m.authorId, name: m.authorName, color: m.color, avatar: m.avatar })}
                        aria-label={`View ${m.authorName}'s profile`}
                      >
                        <Avatar
                          name={m.authorName}
                          src={m.avatar && m.avatar.startsWith('data:') ? m.avatar : ''}
                          color={m.color}
                          size={28}
                        />
                      </button>

                      {/* Message content */}
                      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>

                        {/* Author name + badge (others only) */}
                        {!isMe && (
                          <div className="flex items-baseline gap-1.5 px-1">
                            <button
                              type="button"
                              className="text-xs font-semibold hover:opacity-70 transition-opacity cursor-pointer leading-none"
                              style={{ color: m.color || '#a259ff' }}
                              onClick={() => openProfileCard({ address: m.authorId, name: m.authorName, color: m.color, avatar: m.avatar })}
                            >
                              {m.authorName || 'Player'}
                            </button>
                            {m.kind === 'objection' && (
                              <span className="text-[9px] uppercase tracking-widest text-neon font-bold">
                                Objection
                              </span>
                            )}
                          </div>
                        )}

                        {/* Bubble + floating action bar */}
                        <div className="relative">
                          {hoveredId === m.id && (
                            <div
                              className={`absolute -top-10 z-10 flex items-center gap-0.5 px-1 py-1 rounded-xl bg-void/95 border border-white/10 shadow-xl backdrop-blur-xl ${isMe ? 'right-0' : 'left-0'}`}
                            >
                              <button
                                onClick={() => triggerReply(m)}
                                className="w-7 h-7 rounded-lg text-sm flex items-center justify-center text-white/60 hover:text-plasma hover:bg-plasma/15 transition-all"
                                aria-label="Reply"
                              >
                                <Reply className="w-3.5 h-3.5" strokeWidth={2.25} />
                              </button>
                              <div className="w-px h-4 bg-white/10 mx-0.5" />
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

                          {/* Bubble */}
                          <div
                            className={`px-3.5 py-2 text-sm leading-relaxed break-words rounded-2xl overflow-hidden ${
                              isMe
                                ? 'bg-plasma/20 border border-plasma/25 text-white rounded-br-sm'
                                : 'bg-white/[0.07] border border-white/[0.08] text-white/90 rounded-bl-sm'
                            }`}
                          >
                            {m.replyTo && (
                              <div
                                className={`flex gap-2 mb-2 pb-2 border-b ${
                                  isMe ? 'border-plasma/20' : 'border-white/[0.08]'
                                }`}
                              >
                                <div
                                  className="w-0.5 rounded-full flex-shrink-0 self-stretch"
                                  style={{ backgroundColor: m.replyTo.color || '#a259ff' }}
                                />
                                <div className="min-w-0">
                                  <p
                                    className="text-[11px] font-semibold leading-none mb-0.5"
                                    style={{ color: m.replyTo.color || '#a259ff' }}
                                  >
                                    {m.replyTo.authorName}
                                  </p>
                                  <p className="text-[12px] text-white/45 truncate leading-snug">
                                    {m.replyTo.text}
                                  </p>
                                </div>
                              </div>
                            )}
                            {m.text}
                          </div>
                        </div>

                        {/* Reaction pills */}
                        {rxEntries.length > 0 && (
                          <div className={`flex flex-wrap gap-1 px-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
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

              {/* ── Reply preview strip ── */}
              <AnimatePresence>
                {replyingTo && (
                  <motion.div
                    key="reply-strip"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 px-3 py-2 border-t border-white/[0.07] bg-white/[0.03] flex-shrink-0"
                  >
                    <Reply className="w-4 h-4 text-plasma flex-shrink-0" strokeWidth={2.25} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-none mb-0.5" style={{ color: replyingTo.color || '#a259ff' }}>
                        {replyingTo.authorName}
                      </p>
                      <p className="text-xs text-white/40 truncate leading-snug">{replyingTo.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                      aria-label="Cancel reply"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input bar ── */}
              {chatLocked ? (
                <div className="flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.07] flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <svg className="w-3.5 h-3.5 text-white/25 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span className="text-xs text-white/25">
                      {phase === PHASES.SCOREBOARD ? 'Case closed — chat ended' : 'Chat opens when the case begins'}
                    </span>
                  </div>
                </div>
              ) : (
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
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
