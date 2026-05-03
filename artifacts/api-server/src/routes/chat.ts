import { Router, type IRouter } from "express";

const router: IRouter = Router();

const USE_DB = !!process.env.DATABASE_URL;

let dbModule: any = null;
async function getDb() {
  if (!USE_DB) return null;
  if (!dbModule) {
    dbModule = await import("@workspace/db");
  }
  return dbModule;
}

// ── In-memory stores ───────────────────────────────────────────────────────
const _mem        = new Map<string, any[]>();
const _memReact   = new Map<string, Record<string, string[]>>();
const _memMembers = new Map<string, Set<string>>();
const _memHosts   = new Map<string, string>();

function norm(s: string) { return String(s || '').toLowerCase(); }

function memIsMember(room: string, userId: string): boolean {
  return !!_memMembers.get(room)?.has(norm(userId));
}

function memAddMember(room: string, userId: string, isHost: boolean) {
  if (!_memMembers.has(room)) _memMembers.set(room, new Set());
  _memMembers.get(room)!.add(norm(userId));
  if (isHost && !_memHosts.has(room)) _memHosts.set(room, norm(userId));
}

function memClearRoom(room: string) {
  _mem.delete(room);
  _memMembers.delete(room);
  _memHosts.delete(room);
}

function parseReplyTo(raw: any) {
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}

function memGet(room: string, since: number) {
  return (_mem.get(room) || [])
    .filter((m) => m.ts > since)
    .slice(-100)
    .map((m) => ({ ...m, reactions: _memReact.get(m.id) || {} }));
}

function memPost(roomCode: string, msg: any) {
  const msgs = _mem.get(roomCode) || [];
  if (!msgs.some((m) => m.id === msg.id)) {
    msgs.push({
      id: String(msg.id),
      author_id: norm(msg.authorId || ""),
      author_name: String(msg.authorName || "Player"),
      avatar: String(msg.avatar || ""),
      color: String(msg.color || ""),
      text: String(msg.text || "").slice(0, 280),
      kind: msg.kind === "objection" ? "objection" : "taunt",
      ts: Number(msg.ts) || Date.now(),
      reply_to: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
    });
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500);
    _mem.set(roomCode, msgs);
  }
}

// ── POST: register member or send message ──────────────────────────────────
router.post("/chat", async (req, res) => {
  const body = req.body || {};

  // Register member
  if (body.action === "join") {
    const { roomCode, userId, isHost } = body;
    if (!roomCode || !userId) return res.status(400).json({ error: "bad payload" });
    const uid = norm(userId);
    if (USE_DB) {
      try {
        const { db, chatMembers } = await getDb();
        await db.insert(chatMembers).values({ roomCode, userId: uid, isHost: !!isHost }).onConflictDoNothing();
        return res.json({ ok: true });
      } catch (e) {
        req.log.error(e, "chat JOIN db error");
        return res.status(500).json({ error: "server error" });
      }
    }
    memAddMember(roomCode, uid, !!isHost);
    return res.json({ ok: true });
  }

  // Send message
  const { roomCode, msg } = body;
  if (!roomCode || !msg?.text || !msg?.authorId) {
    return res.status(400).json({ error: "bad payload" });
  }
  const uid = norm(msg.authorId);

  if (USE_DB) {
    try {
      const { db, chatMessages, chatMembers } = await getDb();
      const { eq, and } = await import("drizzle-orm");
      const memberRows = await db.select().from(chatMembers)
        .where(and(eq(chatMembers.roomCode, roomCode), eq(chatMembers.userId, uid)));
      if (!memberRows.length) return res.status(403).json({ error: "not a member of this room" });
      await db.insert(chatMessages).values({
        id: String(msg.id), roomCode, authorId: uid,
        authorName: msg.authorName, avatar: msg.avatar || "", color: msg.color || "",
        text: String(msg.text).slice(0, 280),
        kind: msg.kind === "objection" ? "objection" : "taunt",
        ts: Number(msg.ts) || Date.now(),
        replyTo: msg.replyTo ? JSON.stringify(msg.replyTo) : null,
      }).onConflictDoNothing();
      return res.json({ ok: true });
    } catch (e) {
      req.log.error(e, "chat POST db error");
      return res.status(500).json({ error: "server error" });
    }
  }
  if (!memIsMember(roomCode, uid)) return res.status(403).json({ error: "not a member of this room" });
  memPost(roomCode, msg);
  return res.json({ ok: true });
});

// ── GET: fetch messages (members only) ─────────────────────────────────────
router.get("/chat", async (req, res) => {
  const room   = String(req.query.room   || "");
  const since  = Number(req.query.since  || 0);
  const userId = norm(String(req.query.userId || ""));
  if (!room) return res.status(400).json({ error: "room required" });

  if (USE_DB) {
    try {
      const { db, chatMessages, chatReactions, chatMembers } = await getDb();
      const { eq, gt, and, inArray } = await import("drizzle-orm");
      if (userId) {
        const memberRows = await db.select().from(chatMembers)
          .where(and(eq(chatMembers.roomCode, room), eq(chatMembers.userId, userId)));
        if (!memberRows.length) return res.status(403).json({ error: "not a member of this room" });
      }
      const rows = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.roomCode, room), gt(chatMessages.ts, since)))
        .orderBy(chatMessages.ts).limit(100);

      let messages: any[] = rows;
      if (rows.length) {
        const msgIds = rows.map((r: any) => r.id);
        const rxRows = await db.select().from(chatReactions).where(inArray(chatReactions.msgId, msgIds));
        const rxMap: Record<string, Record<string, string[]>> = {};
        for (const rx of rxRows) {
          if (!rxMap[rx.msgId]) rxMap[rx.msgId] = {};
          if (!rxMap[rx.msgId][rx.emoji]) rxMap[rx.msgId][rx.emoji] = [];
          rxMap[rx.msgId][rx.emoji].push(rx.userId);
        }
        messages = rows.map((r: any) => ({
          ...r, reactions: rxMap[r.id] || {}, reply_to: parseReplyTo(r.replyTo),
        }));
      }
      return res.json({ messages });
    } catch (e) {
      req.log.error(e, "chat GET db error");
      return res.status(500).json({ error: "server error" });
    }
  }

  if (userId && !memIsMember(room, userId)) {
    return res.status(403).json({ error: "not a member of this room" });
  }
  return res.json({ messages: memGet(room, since) });
});

// ── PATCH: reaction (members only) ─────────────────────────────────────────
router.patch("/chat", async (req, res) => {
  const { roomCode, msgId, emoji, userId } = req.body || {};
  const VALID = ["👍", "🔥", "⚖️"];
  if (!roomCode || !msgId || !emoji || !userId || !VALID.includes(emoji)) {
    return res.status(400).json({ error: "bad payload" });
  }
  const uid = norm(userId);

  if (USE_DB) {
    try {
      const { db, chatReactions, chatMembers } = await getDb();
      const { eq, and } = await import("drizzle-orm");
      const memberRows = await db.select().from(chatMembers)
        .where(and(eq(chatMembers.roomCode, roomCode), eq(chatMembers.userId, uid)));
      if (!memberRows.length) return res.status(403).json({ error: "not a member of this room" });
      const existing = await db.select().from(chatReactions)
        .where(and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, uid)));
      if (existing.length) {
        await db.delete(chatReactions).where(
          and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, uid))
        );
      } else {
        await db.insert(chatReactions).values({ msgId, emoji, userId: uid }).onConflictDoNothing();
      }
      const all = await db.select().from(chatReactions).where(eq(chatReactions.msgId, msgId));
      const reactions: Record<string, string[]> = {};
      for (const r of all) {
        if (!reactions[r.emoji]) reactions[r.emoji] = [];
        reactions[r.emoji].push(r.userId);
      }
      return res.json({ ok: true, reactions });
    } catch (e) {
      req.log.error(e, "chat PATCH db error");
      return res.status(500).json({ error: "server error" });
    }
  }
  if (!memIsMember(roomCode, uid)) return res.status(403).json({ error: "not a member of this room" });
  const cur   = { ...(_memReact.get(msgId) || {}) };
  const users = cur[emoji] ? [...cur[emoji]] : [];
  const idx   = users.indexOf(uid);
  if (idx >= 0) { users.splice(idx, 1); } else { users.push(uid); }
  if (users.length) { cur[emoji] = users; } else { delete cur[emoji]; }
  _memReact.set(msgId, cur);
  return res.json({ ok: true, reactions: cur });
});

// ── DELETE: wipe room chat + membership on case end ────────────────────────
router.delete("/chat", async (req, res) => {
  const room   = String(req.query.room   || "");
  const userId = norm(String(req.query.userId || ""));
  if (!room || !userId) return res.status(400).json({ error: "bad payload" });

  if (USE_DB) {
    try {
      const { db, chatMessages, chatReactions, chatMembers } = await getDb();
      const { eq } = await import("drizzle-orm");
      const member = await db.select().from(chatMembers)
        .where(eq(chatMembers.roomCode, room));
      const isIn = member.some((m: any) => m.userId === userId);
      if (!isIn) return res.status(403).json({ error: "not a member of this room" });
      const msgRows = await db.select({ id: chatMessages.id }).from(chatMessages)
        .where(eq(chatMessages.roomCode, room));
      if (msgRows.length) {
        const ids = msgRows.map((r: any) => r.id);
        const { inArray } = await import("drizzle-orm");
        await db.delete(chatReactions).where(inArray(chatReactions.msgId, ids));
      }
      await db.delete(chatMessages).where(eq(chatMessages.roomCode, room));
      await db.delete(chatMembers).where(eq(chatMembers.roomCode, room));
      return res.json({ ok: true });
    } catch (e) {
      req.log.error(e, "chat DELETE db error");
      return res.status(500).json({ error: "server error" });
    }
  }
  if (!memIsMember(room, userId)) return res.status(403).json({ error: "not a member of this room" });
  memClearRoom(room);
  return res.json({ ok: true });
});

export default router;
