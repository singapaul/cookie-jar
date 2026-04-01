import type Database from 'better-sqlite3'

const JOIN = `
  SELECT r.*, t.title, t.category, t.url
  FROM reviews r
  JOIN topics t ON t.id = r.topic_id
`

export function createReviewsService(db: Database.Database) {
  function list({ category, min_rating, limit, offset }: { category?: string; min_rating?: string; limit?: number; offset?: number } = {}) {
    let query = JOIN + ' WHERE 1=1'
    const params: (string | number)[] = []
    if (category)   { query += ' AND t.category = ?'; params.push(category) }
    if (min_rating) { query += ' AND r.rating >= ?';  params.push(Number(min_rating)) }
    query += ' ORDER BY r.reviewed_at DESC'
    if (limit !== undefined)  { query += ' LIMIT ?';  params.push(limit) }
    if (offset !== undefined) { query += ' OFFSET ?'; params.push(offset) }
    return db.prepare(query).all(...params)
  }

  function count({ category, min_rating }: { category?: string; min_rating?: string } = {}): number {
    let query = 'SELECT COUNT(*) as n FROM reviews r JOIN topics t ON t.id = r.topic_id WHERE 1=1'
    const params: (string | number)[] = []
    if (category)   { query += ' AND t.category = ?'; params.push(category) }
    if (min_rating) { query += ' AND r.rating >= ?';  params.push(Number(min_rating)) }
    return (db.prepare(query).get(...params) as { n: number }).n
  }

  function get(id: number) {
    return db.prepare(JOIN + ' WHERE r.id = ?').get(id) ?? null
  }

  function update(id: number, fields: { pros?: string; cons?: string; rating?: number; verdict?: string }) {
    const allowed = ['pros', 'cons', 'rating', 'verdict'] as const
    const updates = Object.entries(fields).filter(([k, v]) => allowed.includes(k as typeof allowed[number]) && v !== undefined && v !== '')
    if (updates.length === 0) return
    const set = updates.map(([k]) => `${k} = ?`).join(', ')
    const values = updates.map(([, v]) => v)
    db.prepare(`UPDATE reviews SET ${set} WHERE id = ?`).run(...values, id)
  }

  function remove(id: number): void {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id)
  }

  return { list, count, get, update, remove }
}
