import { describe, it, expect, beforeEach } from 'vitest'
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
  app = createApp(db, API_KEY)
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
