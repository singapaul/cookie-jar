import type Database from 'better-sqlite3'
import type { Topic } from '../types.js'

interface ServiceError {
  error: 'not_found' | 'forbidden'
}

export function createIdeasService(db: Database.Database) {
  function create({ title, description, category, url }: Partial<Topic>): Topic {
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO topics (title, description, category, url, status, skip_count, created_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).run(title, description ?? null, category ?? null, url ?? null, now)
    return db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid) as Topic
  }

  function list({ category, status, search, limit, offset }: { category?: string; status?: string; search?: string; limit?: number; offset?: number } = {}): Topic[] {
    let query = 'SELECT * FROM topics WHERE 1=1'
    const params: (string | number)[] = []
    if (category) { query += ' AND category = ?'; params.push(category) }
    if (status)   { query += ' AND status = ?';   params.push(status) }
    if (search)   { query += ' AND title LIKE ?';  params.push(`%${search}%`) }
    query += ' ORDER BY created_at DESC'
    if (limit !== undefined) { query += ' LIMIT ?'; params.push(limit) }
    if (offset !== undefined) { query += ' OFFSET ?'; params.push(offset) }
    return db.prepare(query).all(...params) as Topic[]
  }

  function count({ category, status, search }: { category?: string; status?: string; search?: string } = {}): number {
    let query = 'SELECT COUNT(*) as n FROM topics WHERE 1=1'
    const params: (string | number)[] = []
    if (category) { query += ' AND category = ?'; params.push(category) }
    if (status)   { query += ' AND status = ?';   params.push(status) }
    if (search)   { query += ' AND title LIKE ?';  params.push(`%${search}%`) }
    return (db.prepare(query).get(...params) as { n: number }).n
  }

  function getStats(): {
    total: number
    pending: number
    skipped: number
    archived: number
    sent: number
    reviewed: number
    avgRating: number | null
  } {
    const counts = db.prepare(`
      SELECT status, COUNT(*) as n FROM topics GROUP BY status
    `).all() as { status: string; n: number }[]
    const byStatus = Object.fromEntries(counts.map(r => [r.status, r.n]))
    const avg = (db.prepare('SELECT AVG(rating) as avg FROM reviews').get() as { avg: number | null }).avg
    const total = counts.reduce((s, r) => s + r.n, 0)
    return {
      total,
      pending:  byStatus['pending']  ?? 0,
      skipped:  byStatus['skipped']  ?? 0,
      archived: byStatus['archived'] ?? 0,
      sent:     byStatus['sent']     ?? 0,
      reviewed: byStatus['reviewed'] ?? 0,
      avgRating: avg !== null ? Math.round(avg * 10) / 10 : null,
    }
  }

  function update(id: number, fields: Partial<Topic>): Topic | ServiceError {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined
    if (!topic) return { error: 'not_found' }
    if (topic.status !== 'pending') return { error: 'forbidden' }

    const allowed = ['title', 'description', 'category', 'url'] as const
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k as typeof allowed[number]))
    if (updates.length === 0) return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic

    const set = updates.map(([k]) => `${k} = ?`).join(', ')
    const values = updates.map(([, v]) => v)
    db.prepare(`UPDATE topics SET ${set} WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic
  }

  function remove(id: number): { deleted: true } | ServiceError {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined
    if (!topic) return { error: 'not_found' }
    if (!['pending', 'sent', 'reviewed'].includes(topic.status)) return { error: 'forbidden' }
    if (topic.status === 'reviewed') {
      db.prepare('DELETE FROM reviews WHERE topic_id = ?').run(id)
    }
    db.prepare('DELETE FROM topics WHERE id = ?').run(id)
    return { deleted: true }
  }

  function resetToPending(id: number): Topic | ServiceError {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined
    if (!topic) return { error: 'not_found' }
    if (topic.status !== 'sent') return { error: 'forbidden' }
    db.prepare("UPDATE topics SET status = 'pending', sent_at = NULL WHERE id = ?").run(id)
    return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic
  }

  function skip(id: number): Topic | ServiceError {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined
    if (!topic) return { error: 'not_found' }

    const newCount = (topic.skip_count ?? 0) + 1
    const newStatus = newCount >= 3 ? 'archived' : 'skipped'
    db.prepare('UPDATE topics SET skip_count = ?, status = ? WHERE id = ?').run(newCount, newStatus, id)
    return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic
  }

  return { create, list, count, getStats, update, remove, skip, resetToPending }
}
