import { Router, type IRouter } from "express";

const router: IRouter = Router();

const USE_DB = !!process.env.DATABASE_URL;

let dbModule: any = null;
async function getDb() {
  if (!USE_DB) return null;
  if (!dbModule) dbModule = await import("@workspace/db");
  return dbModule;
}

// In-memory fallback for environments without a DB
const _memProfiles  = new Map<string, any>();  // address -> profile
const _memUsernames = new Map<string, string>(); // username_lower -> address

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function validateUsername(username: string): string | null {
  if (!username || typeof username !== "string") return "Username is required.";
  const trimmed = username.trim();
  if (trimmed.length < 5) return "Username must be at least 5 characters.";
  if (trimmed.length > 24) return "Username must be 24 characters or fewer.";
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed))
    return "Only letters, numbers, spaces, underscores, and hyphens are allowed.";
  if (/^\s|\s$/.test(trimmed)) return "Username cannot start or end with a space.";
  if (/\s{2,}/.test(trimmed)) return "Username cannot contain consecutive spaces.";
  return null;
}

// GET /api/profile/check?username=xxx
// Returns { available: boolean, error?: string }
router.get("/profile/check", async (req, res) => {
  const raw = String(req.query.username || "");
  const validationError = validateUsername(raw);
  if (validationError) return res.json({ available: false, error: validationError });

  const lower = normalizeUsername(raw);

  if (USE_DB) {
    try {
      const { db, playerProfiles } = await getDb();
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select({ address: playerProfiles.address })
        .from(playerProfiles)
        .where(eq(playerProfiles.usernameLower, lower))
        .limit(1);
      return res.json({ available: rows.length === 0 });
    } catch (e) {
      req.log.error(e, "profile check db error");
      return res.status(500).json({ available: false, error: "Server error" });
    }
  }

  return res.json({ available: !_memUsernames.has(lower) });
});

// GET /api/profile/:address
// Returns the profile or 404
router.get("/profile/:address", async (req, res) => {
  const address = String(req.params.address || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  if (USE_DB) {
    try {
      const { db, playerProfiles } = await getDb();
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.address, address))
        .limit(1);
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      const row = rows[0];
      return res.json({
        address:      row.address,
        username:     row.username,
        avatarUrl:    row.avatarUrl,
        color:        row.color,
        registeredAt: row.registeredAt,
      });
    } catch (e) {
      req.log.error(e, "profile GET db error");
      return res.status(500).json({ error: "Server error" });
    }
  }

  const p = _memProfiles.get(address);
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json(p);
});

// POST /api/profile/claim
// Body: { address, username, avatarUrl?, color? }
// One-time registration — address may only claim once
router.post("/profile/claim", async (req, res) => {
  const body = req.body || {};
  const address = String(body.address || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address." });
  }

  const rawUsername = String(body.username || "");
  const validationError = validateUsername(rawUsername);
  if (validationError) return res.status(400).json({ error: validationError });

  const username     = rawUsername.trim();
  const usernameLower = normalizeUsername(username);
  const avatarUrl    = String(body.avatarUrl || "").slice(0, 400000);
  const color        = String(body.color || "#a259ff").slice(0, 32);

  if (USE_DB) {
    try {
      const { db, playerProfiles } = await getDb();
      const { eq } = await import("drizzle-orm");

      // Check already claimed by this address
      const existing = await db
        .select({ username: playerProfiles.username })
        .from(playerProfiles)
        .where(eq(playerProfiles.address, address))
        .limit(1);
      if (existing.length) {
        return res.status(409).json({
          error: "This wallet has already claimed an identity.",
          username: existing[0].username,
        });
      }

      // Check username taken
      const taken = await db
        .select({ address: playerProfiles.address })
        .from(playerProfiles)
        .where(eq(playerProfiles.usernameLower, usernameLower))
        .limit(1);
      if (taken.length) {
        return res.status(409).json({ error: "That name is already taken. Choose another." });
      }

      await db.insert(playerProfiles).values({
        address,
        username,
        usernameLower,
        avatarUrl,
        color,
      });

      return res.json({ ok: true, username, address });
    } catch (e: any) {
      req.log.error(e, "profile claim db error");
      if (e?.code === "23505") {
        return res.status(409).json({ error: "That name is already taken. Choose another." });
      }
      return res.status(500).json({ error: "Server error." });
    }
  }

  // In-memory fallback
  if (_memProfiles.has(address)) {
    return res.status(409).json({
      error: "This wallet has already claimed an identity.",
      username: _memProfiles.get(address)!.username,
    });
  }
  if (_memUsernames.has(usernameLower)) {
    return res.status(409).json({ error: "That name is already taken. Choose another." });
  }

  const profile = { address, username, avatarUrl, color, registeredAt: new Date().toISOString() };
  _memProfiles.set(address, profile);
  _memUsernames.set(usernameLower, address);

  return res.json({ ok: true, username, address });
});

// PATCH /api/profile/avatar
// Updates avatar only (username remains locked)
router.patch("/profile/avatar", async (req, res) => {
  const body = req.body || {};
  const address = String(body.address || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address." });
  }
  const avatarUrl = String(body.avatarUrl || "").slice(0, 400000);

  if (USE_DB) {
    try {
      const { db, playerProfiles } = await getDb();
      const { eq } = await import("drizzle-orm");
      const existing = await db
        .select({ address: playerProfiles.address })
        .from(playerProfiles)
        .where(eq(playerProfiles.address, address))
        .limit(1);
      if (!existing.length) return res.status(404).json({ error: "Profile not found." });
      await db
        .update(playerProfiles)
        .set({ avatarUrl })
        .where(eq(playerProfiles.address, address));
      return res.json({ ok: true });
    } catch (e) {
      req.log.error(e, "profile avatar db error");
      return res.status(500).json({ error: "Server error." });
    }
  }

  const p = _memProfiles.get(address);
  if (!p) return res.status(404).json({ error: "Profile not found." });
  p.avatarUrl = avatarUrl;
  return res.json({ ok: true });
});

export default router;
