import type { DiscordUser } from '@hono/oauth-providers/discord'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { CookieOptions } from 'hono/utils/cookie'
import type { AppEnv } from '@/core'
import { discordAuth } from '@hono/oauth-providers/discord'
import { githubAuth } from '@hono/oauth-providers/github'
import { googleAuth } from '@hono/oauth-providers/google'
import { getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { isPublicPath } from '@/constants/public-paths'
import { getServices } from '@/core/request-services'
import { AuthType } from '@/service/auth.service'
import { isAllowedOrigin, Logger } from '@/utils'

const log = new Logger('OAuth')

const COOKIE_NAME = 'token'
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 30,
} as CookieOptions

/**
 * 在给定的 app 实例上注册 OAuth 相关的中间件和路由。
 */
export function registerOAuthRoutes(app: OpenAPIHono<AppEnv>) {
  app.use('*', async (ctx, next) => {
    if (isPublicPath(ctx.req.path)) {
      const redirect = ctx.req.query('_redirect')

      if (redirect) {
        const url = new URL(redirect)
        if (!isAllowedOrigin(url.origin)) {
          log.warn('Redirect origin not allowed', {
            origin: url.origin,
            path: ctx.req.path,
          })
          throw new HTTPException(403, {
            message: 'Source domain is not allowed',
          })
        }
        log.debug('Setting redirect cookie', { redirect })
        setCookie(ctx, '_redirect', redirect)
        // 通过重定向去掉 URL 中的 query 参数，确保后续 OAuth 逻辑拿到的是干净的 URL
        log.info('Redirecting to clean URL', { path: ctx.req.path })
        return ctx.redirect(ctx.req.path)
      }

      return next()
    }

    const token = getCookie(ctx, COOKIE_NAME)
    const { authService } = getServices(ctx)

    if (!token) {
      log.warn('Token validation failed', { reason: 'no_token', path: ctx.req.path })
      throw new HTTPException(401, {
        message: 'Unauthorized',
      })
    }

    try {
      const user = await authService.verifyJwt(token)
      log.debug('JWT verified', { userId: user.id })
      ctx.set('user', user)
      return next()
    }
    catch (error) {
      log.warn('Token validation failed', {
        reason: 'invalid_token',
        path: ctx.req.path,
        error: error instanceof Error ? error.message : 'unknown',
      })
      throw new HTTPException(401, {
        message: 'Unauthorized',
      })
    }
  })

  app.get(
    'auth/google',
    googleAuth({
      scope: ['email', 'profile'],
      prompt: 'select_account',
    }),
    async (ctx) => {
      log.info('OAuth login started', { provider: 'google' })
      const googleUser = ctx.get('user-google')
      const { authService } = getServices(ctx)
      const { user, token } = await authService.login(AuthType.GOOGLE, googleUser)

      log.debug('User info received', {
        provider: 'google',
        providerUserId: googleUser?.id,
        hasEmail: !!googleUser?.email,
      })

      setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

      const redirect = getCookie(ctx, '_redirect')
      if (redirect) {
        log.info('OAuth login success, redirecting', {
          provider: 'google',
          userId: user.id,
        })
        return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
      }

      log.info('OAuth login success', {
        provider: 'google',
        userId: user.id,
      })
      return ctx.json({ user, token })
    },
  )

  app.get(
    'auth/discord',
    discordAuth({
      scope: ['identify', 'email'],
    }),
    async (ctx) => {
      log.info('OAuth login started', { provider: 'discord' })

      const token = ctx.get('token')
      // Fetch the complete user info from Discord users endpoint.
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { authorization: `Bearer ${token?.token}` },
      }).then(res => res.json()) as any

      log.debug('Raw Discord user response:', { userResponse })

      const email = userResponse.email

      if (!email) {
        throw new HTTPException(400, {
          message: 'Email is undefined. Make sure your OAuth2 request includes the "email" scope and the token has the proper permissions.',
        })
      }

      let avatar = 'https://discord.com//assets/18e336a74a159cfd.png'

      if (userResponse.avatar) {
        avatar = `https://cdn.discordapp.com/avatars/${userResponse.id}/${userResponse.avatar}.png`
      }

      const discordUser = ctx.get('user-discord') as DiscordUser & { email: string | null }
      Object.assign(discordUser, { email, avatar })

      const { authService } = getServices(ctx)
      const { user, token: jwtToken } = await authService.login(AuthType.DISCORD, discordUser)

      log.debug('User info received', {
        provider: 'discord',
        providerUserId: discordUser?.id,
        hasEmail: !!discordUser?.email,
      })

      setCookie(ctx, COOKIE_NAME, jwtToken, COOKIE_OPTIONS)

      const redirect = getCookie(ctx, '_redirect')
      if (redirect) {
        log.info('OAuth login success, redirecting', {
          provider: 'discord',
          userId: user.id,
        })
        return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
      }

      log.info('OAuth login success', {
        provider: 'discord',
        userId: user.id,
      })
      return ctx.json({ user, token: jwtToken })
    },
  )

  app.get(
    'auth/github',
    githubAuth({
      scope: ['user:email'],
      oauthApp: true,
    }),
    async (ctx) => {
      log.info('OAuth login started', { provider: 'github' })
      const githubUser = ctx.get('user-github')
      const { authService } = getServices(ctx)
      const { user, token } = await authService.login(AuthType.GITHUB, githubUser)

      log.debug('User info received', {
        provider: 'github',
        providerUserId: githubUser?.id,
        hasEmail: !!githubUser?.email,
      })

      setCookie(ctx, COOKIE_NAME, token, COOKIE_OPTIONS)

      const redirect = getCookie(ctx, '_redirect')
      if (redirect) {
        log.info('OAuth login success, redirecting', {
          provider: 'github',
          userId: user.id,
        })
        return ctx.redirect(await authService.buildTicketRedirectUrl(user, redirect))
      }

      log.info('OAuth login success', {
        provider: 'github',
        userId: user.id,
      })
      return ctx.json({ user, token })
    },
  )

  app.get('auth/by-ticket', async (ctx) => {
    const ticket = ctx.req.query('ticket')
    log.debug('Ticket validation started', { ticketPrefix: ticket?.slice(0, 8) })
    const { authService } = getServices(ctx)
    const token = await authService.checkOnceTicket(ticket)

    if (!token) {
      log.warn('Ticket validation failed', { ticketPrefix: ticket?.slice(0, 8) })
      throw new HTTPException(404)
    }

    const user = await authService.verifyJwt(token)
    log.info('Ticket validated', { ticketPrefix: ticket?.slice(0, 8), userId: user.id })
    return ctx.json({ token, user })
  })
}
