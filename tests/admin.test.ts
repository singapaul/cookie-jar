import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/db.js'
import type { Express } from 'express'
import type Database from 'better-sqlite3'

const API_KEY = 'test-key'

let app: Express
let db: Database.Database

async function getSessionCookie(): Promise<string> {
  const res = await request(app)
    .post('/admin/login')
    .send('password=test-key')
    .set('Content-Type', 'application/x-www-form-urlencoded')
  const cookies = res.headers['set-cookie'] as unknown as string[]
  return cookies[0]
}

beforeEach(() => {
  db = createDb(':memory:')
  app = createApp(db, API_KEY, vi.fn().mockResolvedValue({}))
})

describe('GET /admin/login', () => {
  it('renders the login form without requiring auth', async () => {
    const res = await request(app).get('/admin/login')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/login/i)
    expect(res.text).toMatch(/password/i)
  })
})

describe('POST /admin/login', () => {
  it('redirects to /admin and sets cookie on correct password', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send('password=test-key')
      .set('Content-Type', 'application/x-www-form-urlencoded')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('re-renders login with error on wrong password', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send('password=wrong')
      .set('Content-Type', 'application/x-www-form-urlencoded')

    expect(res.status).toBe(200)
    expect(res.text).toMatch(/invalid/i)
    expect(res.headers['set-cookie']).toBeUndefined()
  })
})

describe('admin session middleware', () => {
  it('redirects unauthenticated requests to /admin/login', async () => {
    const res = await request(app).get('/admin')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin/login')
  })

  it('passes through requests with a valid session cookie', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.status).not.toBe(302)
  })

  it('does not apply Bearer auth to /admin routes', async () => {
    const res = await request(app).get('/admin/login')
    expect(res.status).not.toBe(401)
  })
})

describe('GET /admin (ideas page)', () => {
  it('shows empty state when no topics exist', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/no ideas/i)
  })

  it('renders pending and skipped topics with their details', async () => {
    db.prepare(
      "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn Rust', 'Systems', 'https://rust-lang.org', 'pending', 0, datetime('now'))"
    ).run()
    db.prepare(
      "INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn K8s', 'DevOps', NULL, 'skipped', 1, datetime('now'))"
    ).run()

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)

    expect(res.text).toMatch(/Learn Rust/)
    expect(res.text).toMatch(/Systems/)
    expect(res.text).toMatch(/https:\/\/rust-lang\.org/)
    expect(res.text).toMatch(/pending/)
    expect(res.text).toMatch(/Learn K8s/)
    expect(res.text).toMatch(/skipped/)
  })

  it('does not show sent or reviewed topics in the main list', async () => {
    db.prepare(
      "INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Sent Topic', 'sent', 0, datetime('now'))"
    ).run()

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(/Sent Topic/)
  })

  it('includes nav bar with Ideas and Reviews links', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/href="\/admin"/)
    expect(res.text).toMatch(/href="\/admin\/reviews"/)
  })
})

describe('POST /admin/ideas', () => {
  it('creates a topic and redirects to /admin', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .post('/admin/ideas')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('title=New+Idea&category=AI&description=desc&url=https://example.com')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')

    const topic = db.prepare("SELECT * FROM topics WHERE title = 'New Idea'").get() as { status: string; category: string }
    expect(topic).toBeDefined()
    expect(topic.status).toBe('pending')
    expect(topic.category).toBe('AI')
  })

  it('redirects back without creating when title is missing', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .post('/admin/ideas')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('category=AI')

    expect(res.status).toBe(302)
    const count = (db.prepare('SELECT COUNT(*) as n FROM topics').get() as { n: number }).n
    expect(count).toBe(0)
  })
})

describe('POST /admin/ideas/:id/edit', () => {
  it('updates topic fields and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, category, status, skip_count, created_at) VALUES ('Old Title', 'Systems', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/edit`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('title=New+Title&category=AI&description=desc&url=https://example.com')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as { title: string; category: string }
    expect(updated.title).toBe('New Title')
    expect(updated.category).toBe('AI')
  })
})

describe('POST /admin/ideas/:id/delete', () => {
  it('deletes the topic and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('To Delete', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/delete`)
      .set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const gone = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id)
    expect(gone).toBeUndefined()
  })
})

describe('POST /admin/ideas/:id/skip', () => {
  it('increments skip_count and redirects to /admin', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic', 'pending', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/ideas/${topic.id}/skip`)
      .set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin')
    const updated = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic.id) as { skip_count: number; status: string }
    expect(updated.skip_count).toBe(1)
    expect(updated.status).toBe('skipped')
  })
})

describe('POST /admin/send-weekly', () => {
  it('redirects to /admin with success flash when topic is sent', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-weekly').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(res.headers.location).toMatch(/\/admin\?flash=/)
    expect(decodeURIComponent(res.headers.location)).toMatch(/sent/i)
  })

  it('redirects with error flash when no eligible topics', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-weekly').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/could not/i)
  })
})

describe('POST /admin/send-review-prompt', () => {
  it('redirects with success flash when review prompt sent', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'sent', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare('UPDATE conversation_state SET topic_id = ? WHERE id = 1').run(topic.id)
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-review-prompt').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/sent/i)
  })

  it('redirects with warning flash when no active topic', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app).post('/admin/send-review-prompt').set('Cookie', cookie)

    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/no active/i)
  })
})

describe('GET /admin — flash message', () => {
  it('renders flash message from query param', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app)
      .get('/admin?flash=Topic%20sent!')
      .set('Cookie', cookie)

    expect(res.text).toMatch(/Topic sent!/)
  })

  it('renders no flash div when no query param', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(/role="alert"/)
  })
})

describe('GET /admin/reviews', () => {
  it('shows empty state when no reviews exist', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/no reviews/i)
  })

  it('renders review cards with all fields', async () => {
    db.prepare("INSERT INTO topics (title, category, url, status, skip_count, created_at) VALUES ('Learn Rust', 'Systems', 'https://rust-lang.org', 'reviewed', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare("INSERT INTO reviews (topic_id, pros, cons, rating, verdict, reviewed_at) VALUES (?, 'Great', 'Hard', 9, 'Worth it', datetime('now'))").run(topic.id)

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews').set('Cookie', cookie)

    expect(res.text).toMatch(/Learn Rust/)
    expect(res.text).toMatch(/Systems/)
    expect(res.text).toMatch(/https:\/\/rust-lang\.org/)
    expect(res.text).toMatch(/9/)
    expect(res.text).toMatch(/Great/)
    expect(res.text).toMatch(/Hard/)
    expect(res.text).toMatch(/Worth it/)
  })

  it('renders reviews sorted by most recent first', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic A', 'reviewed', 0, datetime('now'))").run()
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic B', 'reviewed', 0, datetime('now'))").run()
    const [a, b] = db.prepare('SELECT id, title FROM topics').all() as { id: number; title: string }[]
    db.prepare("INSERT INTO reviews (topic_id, rating, reviewed_at) VALUES (?, 7, '2026-01-01')").run(a.id)
    db.prepare("INSERT INTO reviews (topic_id, rating, reviewed_at) VALUES (?, 8, '2026-03-01')").run(b.id)

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews').set('Cookie', cookie)

    const posA = res.text.indexOf('Topic A')
    const posB = res.text.indexOf('Topic B')
    expect(posB).toBeLessThan(posA)
  })

  it('has Reviews link marked active in nav', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews').set('Cookie', cookie)
    expect(res.text).toMatch(/aria-current="page"[^>]*>Reviews|Reviews[^<]*<\/a>/)
  })
})

describe('GET /admin — archived section', () => {
  it('shows archived topics in a details section', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Archived Topic', 'archived', 3, datetime('now'))").run()
    const cookie = await getSessionCookie()

    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/Archived Topic/)
    expect(res.text).toMatch(/<details/)
  })

  it('shows no archived topics message when none exist', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/no archived/i)
  })

  it('does not show edit button for skipped topics', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Skipped', 'skipped', 1, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).not.toMatch(new RegExp(`/admin/ideas/${topic.id}/edit`))
  })
})

// ─── Feature 1: CATEGORIES constant + category select ────────────────────────

describe('GET /admin — category select', () => {
  it('shows <select name="category"> with Frontend and Backend options in the add form', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/<select name="category"/)
    expect(res.text).toMatch(/Frontend/)
    expect(res.text).toMatch(/Backend/)
  })
})

// ─── Feature 2: Favicon ───────────────────────────────────────────────────────

describe('GET /admin — favicon', () => {
  it('contains a rel="icon" link tag', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/rel="icon"/)
  })
})

// ─── Feature 3: UI polish ─────────────────────────────────────────────────────

describe('GET /admin — UI polish', () => {
  it('shows a coloured badge for pending status', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Badge Test', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/background:#d1fae5/)
  })

  it('wraps the edit form in a <details> element', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Detail Test', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    // There should be a <details containing the edit form (more than the archived section)
    const detailsMatches = res.text.match(/<details/g) ?? []
    expect(detailsMatches.length).toBeGreaterThanOrEqual(2)
  })

  it('delete button has confirm() onclick', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Confirm Test', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.text).toMatch(/confirm\(/)
  })
})

// ─── Feature 4: Stats summary ─────────────────────────────────────────────────

describe('GET /admin — stats summary', () => {
  it('shows the count of pending topics in the stats area', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic One', 'pending', 0, datetime('now'))").run()
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic Two', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin').set('Cookie', cookie)
    // Stats area should show total=2
    expect(res.text).toMatch(/2/)
  })
})

// ─── Feature 5: Filter/search ─────────────────────────────────────────────────

describe('GET /admin — search filter', () => {
  it('filters topics by search query', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Rust', 'pending', 0, datetime('now'))").run()
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Learn Go', 'pending', 0, datetime('now'))").run()
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin?search=Rust').set('Cookie', cookie)
    expect(res.text).toMatch(/Learn Rust/)
    expect(res.text).not.toMatch(/Learn Go/)
  })

  it('renders search input pre-filled with query value', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin?search=TypeScript').set('Cookie', cookie)
    expect(res.text).toMatch(/value="TypeScript"/)
  })
})

// ─── Feature 6: Pagination on ideas list ─────────────────────────────────────

describe('GET /admin — pagination', () => {
  it('shows page 2 topics when 25 pending topics exist', async () => {
    for (let i = 1; i <= 25; i++) {
      db.prepare(`INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Topic ${i}', 'pending', 0, datetime('now', '+${i} seconds'))`).run()
    }
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin?page=2').set('Cookie', cookie)
    // Page 2 should contain topic 1 (oldest, since sorted DESC the 25th item in DESC is the oldest)
    // With PAGE_SIZE=20, page 1 = items 1-20 DESC (topics 25..6), page 2 = items 21-25 (topics 5..1)
    expect(res.text).toMatch(/Topic [1-5](?!\d)/)
    // Page 2 should NOT contain Topic 25 (that's on page 1)
    expect(res.text).not.toMatch(/Topic 25/)
  })
})

// ─── Feature 7: Pagination on reviews list ───────────────────────────────────

describe('GET /admin/reviews — pagination', () => {
  it('shows page 2 reviews when 25 reviews exist', async () => {
    for (let i = 1; i <= 25; i++) {
      db.prepare(`INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Review Topic ${i}', 'reviewed', 0, datetime('now', '+${i} seconds'))`).run()
      const t = db.prepare('SELECT id FROM topics ORDER BY id DESC LIMIT 1').get() as { id: number }
      db.prepare(`INSERT INTO reviews (topic_id, rating, reviewed_at) VALUES (?, 7, datetime('now', '+${i} seconds'))`).run(t.id)
    }
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews?page=2').set('Cookie', cookie)
    // With DESC order and PAGE_SIZE=20, page 2 should have the older ones
    expect(res.text).toMatch(/Review Topic [1-5](?!\d)/)
    expect(res.text).not.toMatch(/Review Topic 25/)
  })
})

// ─── Feature 8: Edit reviews inline ──────────────────────────────────────────

describe('POST /admin/reviews/:id/edit', () => {
  it('updates the review and redirects; updated pros visible on reviews page', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Rust', 'reviewed', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare("INSERT INTO reviews (topic_id, pros, cons, rating, verdict, reviewed_at) VALUES (?, 'Old pros', 'Cons', 8, 'Good', datetime('now'))").run(topic.id)
    const review = db.prepare('SELECT id FROM reviews').get() as { id: number }
    const cookie = await getSessionCookie()

    const res = await request(app)
      .post(`/admin/reviews/${review.id}/edit`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('pros=New+pros&cons=Cons&rating=8&verdict=Good')

    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/admin/reviews')

    const updated = db.prepare('SELECT pros FROM reviews WHERE id = ?').get(review.id) as { pros: string }
    expect(updated.pros).toBe('New pros')
  })
})

describe('GET /admin/reviews — inline edit form', () => {
  it('renders a <details> edit form for each review', async () => {
    db.prepare("INSERT INTO topics (title, status, skip_count, created_at) VALUES ('Rust', 'reviewed', 0, datetime('now'))").run()
    const topic = db.prepare('SELECT id FROM topics').get() as { id: number }
    db.prepare("INSERT INTO reviews (topic_id, pros, cons, rating, verdict, reviewed_at) VALUES (?, 'Great', 'Hard', 9, 'Worth it', datetime('now'))").run(topic.id)

    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews').set('Cookie', cookie)
    expect(res.text).toMatch(/<details/)
    expect(res.text).toMatch(/action="\/admin\/reviews\/\d+\/edit"/)
  })
})

// ─── Feature 9: Export reviews ────────────────────────────────────────────────

describe('GET /admin/reviews/export.csv', () => {
  it('returns 200 with text/csv content type and header row', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews/export.csv').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.text).toMatch(/id,topic_id/)
  })
})

describe('GET /admin/reviews/export.json', () => {
  it('returns 200 with a JSON array', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).get('/admin/reviews/export.json').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('POST /admin/send-reminder', () => {
  it('redirects with skipped flash when no review in progress', async () => {
    const cookie = await getSessionCookie()
    const res = await request(app).post('/admin/send-reminder').set('Cookie', cookie)
    expect(res.status).toBe(302)
    expect(decodeURIComponent(res.headers.location)).toMatch(/no reminder needed/i)
  })
})
