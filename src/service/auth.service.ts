import type { Prisma, User } from '#/prisma/client'
import type { DiscordUser } from '@hono/oauth-providers/discord'
import type { GitHubUser } from '@hono/oauth-providers/github'
import type { GoogleUser } from '@hono/oauth-providers/google'
import type { ServiceDependencies } from '@/core/base.service'
import type { OAuthProviderField, UserRepository } from '@/repository/user.repository'
import { HTTPException } from 'hono/http-exception'
import { sign, verify } from 'hono/jwt'
import { BaseService } from '@/core/base.service'
import { Logger } from '@/utils/logger'

const log = new Logger('AuthService')

export enum AuthType {
  GOOGLE = 'google',
  DISCORD = 'discord',
  GITHUB = 'github',
}

type AuthUser = Partial<GoogleUser | DiscordUser | GitHubUser>

const authProviderFieldMap: Record<AuthType, OAuthProviderField> = {
  [AuthType.GOOGLE]: 'googleId',
  [AuthType.DISCORD]: 'discordId',
  [AuthType.GITHUB]: 'githubId',
}

export class AuthService extends BaseService {
  private readonly onceTokenPrefix = 'oauth:once:'

  constructor(
    deps: ServiceDependencies,
    private readonly userRepository: UserRepository,
  ) {
    super(deps)
  }

  private get jwtSecret() {
    return this.env.JWT_SECRET
  }

  async signJwt(user: User, secret: string = this.jwtSecret) {
    log.debug('Signing JWT', {
      userId: user.id,
      hasEmail: !!user.email,
    })
    const token = await sign({
      user,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    }, secret)
    log.info('JWT signed successfully', {
      userId: user.id,
      tokenPrefix: `${token.substring(0, 12)}...`,
    })
    return token
  }

  async verifyJwt(token: string, secret: string = this.jwtSecret) {
    log.debug('Verifying JWT', {
      tokenPrefix: `${token.substring(0, 12)}...`,
    })
    const { user } = await verify(token, secret, 'HS256')
    const typedUser = user as User
    log.info('JWT verified successfully', {
      userId: typedUser.id,
      hasEmail: !!typedUser.email,
    })
    return typedUser
  }

  async login(type: AuthType, user?: AuthUser) {
    log.debug('Login attempt', {
      authType: type,
      hasUser: !!user,
      providerId: user?.id ? String(user.id) : undefined,
    })
    const dbUser = await this.findOrCreateUser(type, user)
    const token = await this.signJwt(dbUser)
    log.info('Login successful', {
      authType: type,
      userId: dbUser.id,
      hasEmail: !!dbUser.email,
    })
    return {
      user: dbUser,
      token,
    }
  }

  async generateOnceTicket(user: User) {
    log.debug('Generating once ticket', { userId: user.id })
    const token = await this.signJwt(user)
    const ticket = crypto.randomUUID()

    await this.env.KV.put(`${this.onceTokenPrefix}${ticket}`, token, {
      expirationTtl: 60 * 3,
    })

    log.info('Once ticket generated', {
      userId: user.id,
      ticketPrefix: `${ticket.substring(0, 8)}...`,
      ttlSeconds: 180,
    })
    return ticket
  }

  async buildTicketRedirectUrl(user: User, redirect: string) {
    log.debug('Building ticket redirect URL', {
      userId: user.id,
      redirectHost: new URL(redirect).host,
    })
    const ticket = await this.generateOnceTicket(user)
    const url = new URL(redirect)
    url.searchParams.append('ticket', ticket)
    log.info('Ticket redirect URL built', {
      userId: user.id,
      ticketPrefix: `${ticket.substring(0, 8)}...`,
    })
    return url.toString()
  }

  async checkOnceTicket(ticket?: string) {
    log.debug('Checking once ticket', {
      hasTicket: !!ticket,
      ticketPrefix: ticket ? `${ticket.substring(0, 8)}...` : undefined,
    })
    const token = await this.env.KV.get(`${this.onceTokenPrefix}${ticket}`)
    await this.env.KV.delete(`${this.onceTokenPrefix}${ticket}`)
    if (token) {
      log.info('Once ticket consumed', {
        ticketPrefix: `${ticket!.substring(0, 8)}...`,
        hasToken: true,
      })
    }
    else {
      log.warn('Once ticket not found or expired', {
        ticketPrefix: `${ticket?.substring(0, 8)}...`,
      })
    }
    return token
  }

  private async findOrCreateUser(type: AuthType, user?: AuthUser) {
    log.debug('Finding or creating user', {
      authType: type,
      hasUser: !!user,
      providerId: user?.id ? String(user.id) : undefined,
    })

    if (!user) {
      log.error('User not found in OAuth response', { authType: type })
      throw new HTTPException(400, {
        message: `${type} user not found`,
      })
    }

    const userData = this.buildUserCreateInput(type, user)
    const providerField = authProviderFieldMap[type]
    const providerId = String(user.id)

    if ('email' in user && user.email) {
      const existingUser = await this.userRepository.findByEmail(user.email)
      if (existingUser) {
        log.debug('Found user by email, updating provider ID', {
          userId: existingUser.id,
          authType: type,
          providerField,
        })
        await this.userRepository.updateById(existingUser.id, {
          [providerField]: providerId,
          ...userData,
        })
        log.info('User updated with provider ID', {
          userId: existingUser.id,
          authType: type,
        })
        return existingUser
      }
    }
    else {
      throw new HTTPException(400, {
        message: `${type} user email not found`,
      })
    }

    const existingUser = await this.userRepository.findByProviderId(providerField, providerId)
    if (existingUser) {
      log.info('Found existing user by provider ID', {
        userId: existingUser.id,
        authType: type,
        providerField,
        hasEmail: !!existingUser.email,
      })
      return existingUser
    }

    log.debug('Creating new user', {
      authType: type,
      providerField,
      hasEmail: !!(userData as { email?: string }).email,
    })
    const newUser = await this.userRepository.create({
      ...userData,
      [providerField]: providerId,
    })
    log.info('New user created', {
      userId: newUser.id,
      authType: type,
      hasEmail: !!newUser.email,
    })
    return newUser
  }

  private buildUserCreateInput(type: AuthType, user: AuthUser): Prisma.UserCreateInput {
    switch (type) {
      case AuthType.GOOGLE: {
        const googleUser = user as Partial<GoogleUser>
        return {
          email: googleUser.email!,
          nickname: googleUser.name,
          avatar: googleUser.picture,
        }
      }
      case AuthType.DISCORD: {
        const discordUser = user as Partial<DiscordUser> & { email?: string }
        return {
          email: discordUser.email!,
          nickname: discordUser.global_name,
          avatar: discordUser.avatar,
        }
      }
      case AuthType.GITHUB: {
        const githubUser = user as Partial<GitHubUser>
        return {
          email: githubUser.email!,
          nickname: githubUser.name,
          avatar: githubUser.avatar_url,
        }
      }
    }
  }
}
