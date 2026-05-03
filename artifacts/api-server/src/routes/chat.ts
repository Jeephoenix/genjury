import { Router, type IRouter } from "express";

const router: IRouter = Router();

const USE_DB = !!process.env.DATABASE_URL;

// Lazy DB import — only if DATABASE_URL is available
let dbModule: any = null;
async function getDb() {
  if (!USE_DB) return null;
  if (!dbModule) {
    dbModule = await import("@workspace/db");
  }
  return dbModule;
}

// In-memory fallback
const _mem = new Map<string, any[]>();
const _memReactions = new Map<string, Record<string, string[]>>();

function memGet(room: string, since: number) {
  return (_mem.get(room) || [])
    .filter((m) => m.ts > since)
    .slice(-100)
    .map((m) => ({ ...m, reactions: _memReactions.get(m.id) || {} }));
}

function memPost(roomCode: string, msg: any) {
  const msgs = _mem.get(roomCode) || [];
  if (!msgs.some((m) => m.id === msg.id)) {
    msgs.push({
      id: String(msg.id),
      author_id: String(msg.authorId || ""),
      author_name: String(msg.authorName || "Player"),
      avatar: String(msg.avatar || ""),
      color: String(msg.color || ""),
      text: String(msg.text || "").slice(0, 280),
      kind: msg.kind === "objection" ? "objection" : "taunt",
      ts: Number(msg.ts) || Date.now(),
    });
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500);
    _mem.set(roomCode, msgs);
  }
}

router.get("/chat", async (req, res) => {
  const room = String(req.query.room || "");
  const since = Number(req.query.since || 0);
  if (!room) return res.status(400).json({ error: "room required" });

  if (USE_DB) {
    try {
      const { db, chatMessages, chatReactions } = await getDb();
      const { eq, gt, and, inArray } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.roomCode, room), gt(chatMessages.ts, since)))
        .orderBy(chatMessages.ts)
        .limit(100);

      let messages: any[] = rows;
      if (rows.length) {
        const msgIds = rows.map((r: any) => r.id);
        const rxRows = await db
          .select()
          .from(chatReactions)
          .where(inArray(chatReactions.msgId, msgIds));
        const rxMap: Record<string, Record<string, string[]>> = {};
        for (const rx of rxRows) {
          if (!rxMap[rx.msgId]) rxMap[rx.msgId] = {};
          if (!rxMap[rx.msgId][rx.emoji]) rxMap[rx.msgId][rx.emoji] = [];
          rxMap[rx.msgId][rx.emoji].push(rx.userId);
        }
        messages = rows.map((r: any) => ({ ...r, reactions: rxMap[r.id] || {} }));
      }
      return res.json({ messages });
    } catch (e) {
      req.log.error(e, "chat GET db error");
      return res.status(500).json({ error: "server error" });
    }
  }
  return res.json({ messages: memGet(room, since) });
});

router.post("/chat", async (req, res) => {
  const { roomCode, msg } = req.body || {};
  if (!roomCode || !msg?.text || !msg?.authorId) {
    return res.status(400).json({ error: "bad payload" });
  }

  if (USE_DB) {
    try {
      const { db, chatMessages } = await getDb();
      await db.insert(chatMessages).values({
        id: String(msg.id),
        roomCode,
        authorId: msg.authorId,
        authorName: msg.authorName,
        avatar: msg.avatar || "",
        color: msg.color || "",
        text: String(msg.text).slice(0, 280),
        kind: msg.kind === "objection" ? "objection" : "taunt",
        ts: Number(msg.ts) || Date.now(),
      }).onConflictDoNothing();
      return res.json({ ok: true });
    } catch (e) {
      req.log.error(e, "chat POST db error");
      return res.status(500).json({ error: "server error" });
    }
  }
  memPost(roomCode, msg);
  return res.json({ ok: true });
});

router.patch("/chat", async (req, res) => {
  const { roomCode, msgId, emoji, userId } = req.body || {};
  const VALID = ["👍", "🔥", "⚖️"];
  if (!roomCode || !msgId || !emoji || !userId || !VALID.includes(emoji)) {
    return res.status(400).json({ error: "bad payload" });
  }

  if (USE_DB) {
    try {
      const { db, chatReactions } = await getDb();
      const { eq, and } = await import("drizzle-orm");
      const existing = await db
        .select()
        .from(chatReactions)
        .where(and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, userId)));
      if (existing.length) {
        await db.delete(chatReactions).where(
          and(eq(chatReactions.msgId, msgId), eq(chatReactions.emoji, emoji), eq(chatReactions.userId, userId))
        );
      } else {
        await db.insert(chatReactions).values({ msgId, emoji, userId }).onConflictDoNothing();
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
  const cur = { ...(_memReactions.get(msgId) || {}) };
  const users = cur[emoji] ? [...cur[emoji]] : [];
  const idx = users.indexOf(userId);
  if (idx >= 0) { users.splice(idx, 1); } else { users.push(userId); }
  if (users.length) { cur[emoji] = users; } else { delete cur[emoji]; }
  _memReactions.set(msgId, cur);
  return res.json({ ok: true, reactions: cur });
});

export default router;
