import type { CookieOptions } from 'hono/utils/cookie'
import { discordAuth } from '@hono/oauth-providers/discord'
import { githubAuth } from '@hono/oauth-providers/github'
import { googleAuth } from '@hono/oauth-providers/google'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import app from '@/server'
import { AuthType } from '@/service/auth.service'
import { isAllowedOrigin } from '@/utils'

const COOKIE_NAME = 'token'
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 30, // 30 days
} as CookieOptions

// 鉴权中间件
app.use('*', async (ctx, next) => {
  // 跳过登录相关路由
  if (ctx.req.path.startsWith('/api/auth/') || ctx.req.path.startsWith('/api/test/')) {
    const _redirect = ctx.req.query('_redirect')
    if (_redirect) {
      // check 是不是白名单域名
      const url = new URL(_redirect)
      if (isAllowedOrigin(url.origin)) {
        setCookie(ctx, '_redirect', _redirect)
      }
      else {
        throw new HTTPException(403, {
          message: 'Source domain is not allowed',
        })
      }
    }
    return next()
  }

  const token = getCookie(ctx, COOKIE_NAME)
  const authService = ctx.get('authService')

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
    const authService = ctx.get('authService')
    const { user, token } = await authService.login(AuthType.GOOGLE, googleUser)

    // set cookie
    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return authService.generateTicketAndRedirect(user, redirect)
    }

    return ctx.json({
      user,
      token,
    })
  },
)

app.get(
  'auth/discord',
  discordAuth({
    scope: ['identify', 'email'],
  }),
  async (ctx) => {
    const discordUser = ctx.get('user-discord')
    const authService = ctx.get('authService')
    const { user, token } = await authService.login(AuthType.DISCORD, discordUser)

    // set cookie
    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return authService.generateTicketAndRedirect(user, redirect)
    }

    return ctx.json({
      user,
      token,
    })
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
    const authService = ctx.get('authService')
    const { user, token } = await authService.login(AuthType.GITHUB, githubUser)

    // set cookie
    setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

    const redirect = getCookie(ctx, '_redirect')
    if (redirect) {
      return authService.generateTicketAndRedirect(user, redirect)
    }

    return ctx.json({
      user,
      token,
    })
  },
)

app.get('auth/by-ticket', async (ctx) => {
  const ticket = ctx.req.query('ticket')
  const authService = ctx.get('authService')
  const token = await authService.checkOnceTicket(ticket)
  if (!token) {
    throw new HTTPException(404)
  }
  const user = await authService.verifyJwt(token)
  return ctx.json({
    token,
    user,
  })
})
