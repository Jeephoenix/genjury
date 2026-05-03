import { Router, type IRouter } from "express";

const router: IRouter = Router();

const USE_DB = !!process.env.DATABASE_URL;

let dbModule: any = null;
async function getDb() {
  if (!USE_DB) return null;
  if (!dbModule) dbModule = await import("@workspace/db");
  return dbModule;
}

// Ensure ens_cache table exists (idempotent — runs once per process).
// The player_profiles table is created by the Drizzle schema/migration;
// ens_cache is lightweight enough to self-provision here.
let _ensTableReady = false;
async function ensureEnsTable() {
  if (_ensTableReady) return;
  const mod = await getDb();
  if (!mod) return;
  try {
    await mod.pool.query(`
      CREATE TABLE IF NOT EXISTS ens_cache (
        address    TEXT PRIMARY KEY,
        ens_name   TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    _ensTableReady = true;
  } catch {}
}

// In-memory fallback for environments without a DB
const _memProfiles  = new Map<string, any>();  // address -> profile
const _memUsernames = new Map<string, string>(); // username_lower -> address
const _memEns       = new Map<string, string>(); // address -> ensName

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

function isValidAddress(a: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(a);
}

function isValidEnsName(name: string): boolean {
  return typeof name === "string" && name.length >= 3 && name.length <= 255 && name.includes(".");
}

// GET /api/profile/check?username=xxx
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
router.get("/profile/:address", async (req, res) => {
  const address = String(req.params.address || "").toLowerCase();
  if (!isValidAddress(address)) {
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

      // Also fetch ENS name from cache if available
      await ensureEnsTable();
      const { pool } = await getDb();
      let ensName: string | null = null;
      try {
        const ensRow = await pool.query(
          "SELECT ens_name FROM ens_cache WHERE address = $1 LIMIT 1",
          [address]
        );
        ensName = ensRow.rows[0]?.ens_name ?? null;
      } catch {}

      return res.json({
        address:      row.address,
        username:     row.username,
        avatarUrl:    row.avatarUrl,
        color:        row.color,
        registeredAt: row.registeredAt,
        ensName,
      });
    } catch (e) {
      req.log.error(e, "profile GET db error");
      return res.status(500).json({ error: "Server error" });
    }
  }

  const p = _memProfiles.get(address);
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json({ ...p, ensName: _memEns.get(address) ?? null });
});

// GET /api/profile/batch?addresses=addr1,addr2,...
// Returns { [lowercaseAddress]: { username?, avatarUrl?, color?, ensName? } }
router.get("/profile/batch", async (req, res) => {
  const raw = String(req.query.addresses || "");
  const addresses = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => isValidAddress(a))
    .slice(0, 50);

  if (!addresses.length) return res.json({});

  if (USE_DB) {
    try {
      await ensureEnsTable();
      const { pool } = await getDb();
      const result = await pool.query(
        `SELECT
          COALESCE(p.address, e.address) AS address,
          p.username,
          p.avatar_url,
          p.color,
          e.ens_name
        FROM player_profiles p
        FULL OUTER JOIN ens_cache e ON e.address = p.address
        WHERE COALESCE(p.address, e.address) = ANY($1)`,
        [addresses]
      );
      const out: Record<string, any> = {};
      for (const r of result.rows) {
        const entry: any = {};
        if (r.username)   entry.username  = r.username;
        if (r.avatar_url) entry.avatarUrl = r.avatar_url;
        if (r.color)      entry.color     = r.color;
        if (r.ens_name)   entry.ensName   = r.ens_name;
        if (Object.keys(entry).length) out[r.address] = entry;
      }
      return res.json(out);
    } catch (e) {
      req.log.error(e, "profile batch db error");
      return res.json({});
    }
  }

  const out: Record<string, any> = {};
  for (const addr of addresses) {
    const p = _memProfiles.get(addr);
    const ensName = _memEns.get(addr);
    if (p || ensName) {
      out[addr] = {
        ...(p ? { username: p.username, avatarUrl: p.avatarUrl, color: p.color } : {}),
        ...(ensName ? { ensName } : {}),
      };
    }
  }
  return res.json(out);
});

// GET /api/profile/ens?addresses=addr1,addr2,...
// Returns { [lowercaseAddress]: ensName } for cached addresses only.
router.get("/profile/ens", async (req, res) => {
  const raw = String(req.query.addresses || "");
  const addresses = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => isValidAddress(a))
    .slice(0, 100);

  if (!addresses.length) return res.json({});

  if (USE_DB) {
    try {
      await ensureEnsTable();
      const { pool } = await getDb();
      const result = await pool.query(
        "SELECT address, ens_name FROM ens_cache WHERE address = ANY($1)",
        [addresses]
      );
      const out: Record<string, string> = {};
      for (const r of result.rows) out[r.address] = r.ens_name;
      return res.json(out);
    } catch (e) {
      req.log.error(e, "profile ens GET db error");
      return res.json({});
    }
  }

  const out: Record<string, string> = {};
  for (const addr of addresses) {
    const name = _memEns.get(addr);
    if (name) out[addr] = name;
  }
  return res.json(out);
});

// POST /api/profile/ens
// Body: { address, ensName }
// Upserts the ENS name for the address into the server-side cache.
router.post("/profile/ens", async (req, res) => {
  const body = req.body || {};
  const address = String(body.address || "").trim().toLowerCase();
  const ensName = String(body.ensName || "").trim();

  if (!isValidAddress(address))
    return res.status(400).json({ error: "Invalid address." });
  if (!isValidEnsName(ensName))
    return res.status(400).json({ error: "Invalid ENS name." });

  if (USE_DB) {
    try {
      await ensureEnsTable();
      const { pool } = await getDb();
      await pool.query(
        `INSERT INTO ens_cache (address, ens_name, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (address) DO UPDATE
           SET ens_name = EXCLUDED.ens_name, updated_at = now()`,
        [address, ensName]
      );
      return res.json({ ok: true });
    } catch (e) {
      req.log.error(e, "profile ens POST db error");
      return res.status(500).json({ error: "Server error." });
    }
  }

  _memEns.set(address, ensName);
  return res.json({ ok: true });
});

// POST /api/profile/claim
router.post("/profile/claim", async (req, res) => {
  const body = req.body || {};
  const address = String(body.address || "").toLowerCase();
  if (!isValidAddress(address)) {
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
router.patch("/profile/avatar", async (req, res) => {
  const body = req.body || {};
  const address = String(body.address || "").toLowerCase();
  if (!isValidAddress(address)) {
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
