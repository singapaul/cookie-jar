import type Database from 'better-sqlite3'

const JOIN = `
  SELECT r.*, t.title, t.category, t.url
  FROM reviews r
  JOIN topics t ON t.id = r.topic_id
`

export function createReviewsService(db: Database.Database) {
  function list({ category, min_rating }: { category?: string; min_rating?: string } = {}) {
    let query = JOIN + ' WHERE 1=1'
    const params: (string | number)[] = []
    if (category) { query += ' AND t.category = ?'; params.push(category) }
    if (min_rating) { query += ' AND r.rating >= ?'; params.push(Number(min_rating)) }
    query += ' ORDER BY r.reviewed_at DESC'
    return db.prepare(query).all(...params)
  }

  function get(id: number) {
    return db.prepare(JOIN + ' WHERE r.id = ?').get(id) ?? null
  }

  return { list, get }
}
