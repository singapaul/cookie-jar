import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDb } from '../src/db.js'
import type { Express } from 'express'
import type Database from 'better-sqlite3'

const API_KEY = 'test-key'

let app: Express
let db: Database.Database

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
    const loginRes = await request(app)
      .post('/admin/login')
      .send('password=test-key')
      .set('Content-Type', 'application/x-www-form-urlencoded')

    const cookie = loginRes.headers['set-cookie']
    const res = await request(app).get('/admin').set('Cookie', cookie)
    expect(res.status).not.toBe(302)
  })

  it('does not apply Bearer auth to /admin routes', async () => {
    const res = await request(app).get('/admin/login')
    expect(res.status).not.toBe(401)
  })
})
