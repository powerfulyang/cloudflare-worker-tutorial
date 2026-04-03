import type { CookieOptions } from 'hono/utils/cookie'
import { discordAuth } from '@hono/oauth-providers/discord'
import { githubAuth } from '@hono/oauth-providers/github'
import { googleAuth } from '@hono/oauth-providers/google'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { isPublicPath } from '@/constants/public-paths'
import { app } from '@/server'
import { AuthType } from '@/service/auth.service'
import { isAllowedOrigin } from '@/utils'

const COOKIE_NAME = 'token'
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 30,
} as CookieOptions

app.use('*', async (ctx, next) => {
  if (isPublicPath(ctx.req.path)) {
    const redirect = ctx.req.query('_redirect')

    if (redirect) {
      const url = new URL(redirect)
      if (!isAllowedOrigin(url.origin)) {
        throw new HTTPException(403, {
          message: 'Source domain is not allowed',
        })
      }

      setCookie(ctx, '_redirect', redirect)
    }

    return next()
  }

  const token = getCookie(ctx, COOKIE_NAME)
  const { authService } = ctx.get('services')

  if (!token) {
    throw new HTTPException(401, {
      message: 'Unauthorized',
    })
  }

  const user = await authService.verifyJwt(token)
  ctx.set('user', user)
  return next()
})

app.get(
  'auth/google',
  googleAuth({
    scope: ['email', 'profile'],
    prompt: 'select_account',
  }),
  async (ctx) => {
    const googleUser = ctx.get('user-google')
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.GOOGLE, googleUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    return ctx.json({ user, token })
  },
)

app.get(
  'auth/discord',
  discordAuth({
    scope: ['identify', 'email'],
  }),
  async (ctx) => {
    const discordUser = ctx.get('user-discord')
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.DISCORD, discordUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    return ctx.json({ user, token })
  },
)

app.get(
  'auth/github',
  githubAuth({
    scope: ['user:email'],
    oauthApp: true,
  }),
  async (ctx) => {
    const githubUser = ctx.get('user-github')
    const { authService } = ctx.get('services')
    const { user, token } = await authService.login(AuthType.GITHUB, githubUser)

    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
    }

    return ctx.json({ user, token })
  },
)

app.get('auth/by-ticket', async (ctx) => {
  const ticket = ctx.req.query('ticket')
  const { authService } = ctx.get('services')
  const token = await authService.checkOnceTicket(ticket)

  if (!token) {
    throw new HTTPException(404)
  }

  const user = await authService.verifyJwt(token)
  return ctx.json({ token, user })
})
