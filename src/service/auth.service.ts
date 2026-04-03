import type { Prisma, User } from '#/prisma/client'
import type { DiscordUser } from '@hono/oauth-providers/discord'
import type { GitHubUser } from '@hono/oauth-providers/github'
import type { GoogleUser } from '@hono/oauth-providers/google'
import type { ServiceDependencies } from '@/core/base.service'
import type { OAuthProviderField, UserRepository } from '@/repository/user.repository'
import { HTTPException } from 'hono/http-exception'
import { sign, verify } from 'hono/jwt'
import { BaseService } from '@/core/base.service'

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
    return await sign({
      user,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    }, secret)
  }

  async verifyJwt(token: string, secret: string = this.jwtSecret) {
    const { user } = await verify(token, secret, 'HS256')
    return user as User
  }

  async login(type: AuthType, user?: AuthUser) {
    const dbUser = await this.findOrCreateUser(type, user)
    const token = await this.signJwt(dbUser)
    return {
      user: dbUser,
      token,
    }
  }

  async generateOnceTicket(user: User) {
    const token = await this.signJwt(user)
    const ticket = crypto.randomUUID()

    await this.env.KV.put(`${this.onceTokenPrefix}${ticket}`, token, {
      expirationTtl: 60 * 3,
    })

    return ticket
  }

  async buildTicketRedirectUrl(user: User, redirect: string) {
    const ticket = await this.generateOnceTicket(user)
    const url = new URL(redirect)
    url.searchParams.append('ticket', ticket)
    return url.toString()
  }

  async checkOnceTicket(ticket?: string) {
    const token = await this.env.KV.get(`${this.onceTokenPrefix}${ticket}`)
    await this.env.KV.delete(`${this.onceTokenPrefix}${ticket}`)
    return token
  }

  private async findOrCreateUser(type: AuthType, user?: AuthUser) {
    if (!user) {
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
        await this.userRepository.updateById(existingUser.id, {
          [providerField]: providerId,
          ...userData,
        })
      }
    }

    const existingUser = await this.userRepository.findByProviderId(providerField, providerId)
    if (existingUser) {
      return existingUser
    }

    return this.userRepository.create(userData)
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
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : undefined,
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
