import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(req, res) {
  // Only allow Vercel Cron (or you, with the secret) to run this.
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24h ago
    const rows = await sql`
      DELETE FROM chat_messages
      WHERE ts < ${cutoff}
      RETURNING id
    `
    return res.status(200).json({ deleted: rows.length, cutoff })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'cleanup failed' })
  }
}
