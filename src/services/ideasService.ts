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

  function list({ category, status }: { category?: string; status?: string } = {}): Topic[] {
    let query = 'SELECT * FROM topics WHERE 1=1'
    const params: string[] = []
    if (category) { query += ' AND category = ?'; params.push(category) }
    if (status)   { query += ' AND status = ?';   params.push(status) }
    return db.prepare(query).all(...params) as Topic[]
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
    if (topic.status !== 'pending') return { error: 'forbidden' }
    db.prepare('DELETE FROM topics WHERE id = ?').run(id)
    return { deleted: true }
  }

  function skip(id: number): Topic | ServiceError {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined
    if (!topic) return { error: 'not_found' }

    const newCount = (topic.skip_count ?? 0) + 1
    const newStatus = newCount >= 3 ? 'archived' : 'skipped'
    db.prepare('UPDATE topics SET skip_count = ?, status = ? WHERE id = ?').run(newCount, newStatus, id)
    return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic
  }

  return { create, list, update, remove, skip }
}
