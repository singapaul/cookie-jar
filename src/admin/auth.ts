import type { Request, Response, NextFunction } from 'express'

const COOKIE_NAME = 'admin_session'
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30

export function setSessionCookie(res: Response, apiKey: string): void {
  res.cookie(COOKIE_NAME, 'authenticated', {
    signed: true,
    httpOnly: true,
    maxAge: THIRTY_DAYS,
    sameSite: 'lax',
  })
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  const val = (req.signedCookies as Record<string, string>)[COOKIE_NAME]
  if (val !== 'authenticated') {
    res.redirect('/admin/login')
    return
  }
  next()
}
