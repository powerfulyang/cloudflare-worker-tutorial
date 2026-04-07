import type { User } from '#/prisma/client/edge'
import { env } from 'cloudflare:workers'
import { HTTPException } from 'hono/http-exception'
import { verify } from 'hono/jwt'
import { describe, expect, it } from 'vitest'
import { createTestServices, testUserTemplate } from '@/../tests/helpers/test-services'
import { getPrismaInstance } from '@/core/prisma'
import { UserRepository } from '@/repository/user.repository'
import { AuthType } from '@/service/auth.service'

describe('authService', () => {
  describe('jWT', () => {
    it('should sign JWT with user data', async () => {
      const { authService } = createTestServices({ env })
      const token = await authService.signJwt(testUserTemplate)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      const decoded = await verify(token, env.JWT_SECRET, 'HS256')
      expect(decoded.user).toBeDefined()
      expect((decoded.user as User).email).toBe(testUserTemplate.email)
    })

    it('should verify JWT and return user', async () => {
      const { authService } = createTestServices({ env })
      const token = await authService.signJwt(testUserTemplate)
      const user = await authService.verifyJwt(token)
      expect(user).toBeDefined()
      expect(user.email).toBe(testUserTemplate.email)
      expect(user.id).toBe(testUserTemplate.id)
    })

    it('should use custom secret for signing', async () => {
      const { authService } = createTestServices({ env })
      const customSecret = 'custom-secret-123'
      const token = await authService.signJwt(testUserTemplate, customSecret)
      const decoded = await verify(token, customSecret, 'HS256')
      expect((decoded.user as User).email).toBe(testUserTemplate.email)
    })

    it('should use custom secret for verifying', async () => {
      const { authService } = createTestServices({ env })
      const customSecret = 'custom-secret-456'
      const token = await authService.signJwt(testUserTemplate, customSecret)
      const user = await authService.verifyJwt(token, customSecret)
      expect(user.email).toBe(testUserTemplate.email)
    })
  })

  describe('oAuth Login', () => {
    it('should create new user on Google login', async () => {
      const { authService } = createTestServices({ env })
      const googleUser = {
        id: 'google-new-123',
        email: 'google-new@example.com',
        name: 'Google New User',
        picture: 'https://google.com/new-avatar.png',
      }
      const result = await authService.login(AuthType.GOOGLE, googleUser)
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(googleUser.email)
      expect(result.user.nickname).toBe(googleUser.name)
      expect(result.user.avatar).toBe(googleUser.picture)
      expect(result.user.googleId).toBe(googleUser.id)
      expect(result.token).toBeDefined()
    })

    it('should find existing user on Google login', async () => {
      const prisma = getPrismaInstance(env.DB)
      const userRepo = new UserRepository(prisma)
      const { authService } = createTestServices({ env })
      await userRepo.create({
        email: 'google-existing@example.com',
        nickname: 'Existing User',
        googleId: 'google-existing-456',
      })
      const googleUser = {
        id: 'google-existing-456',
        email: 'google-existing@example.com',
        name: 'Updated Name',
        picture: 'https://google.com/new-avatar.png',
      }
      const result = await authService.login(AuthType.GOOGLE, googleUser)
      expect(result.user.email).toBe(googleUser.email)
      expect(result.user.googleId).toBe(googleUser.id)
      expect(result.token).toBeDefined()
    })

    it('should create new user on Discord login', async () => {
      const { authService } = createTestServices({ env })
      const discordUser = {
        id: 'discord-new-789',
        email: 'discord-new@example.com',
        global_name: 'Discord New User',
        avatar: 'discord-avatar-hash',
      }
      const result = await authService.login(AuthType.DISCORD, discordUser)
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(discordUser.email)
      expect(result.user.nickname).toBe(discordUser.global_name)
      expect(result.user.discordId).toBe(discordUser.id)
      expect(result.user.avatar).toContain('cdn.discordapp.com')
    })

    it('should create new user on GitHub login', async () => {
      const { authService } = createTestServices({ env })
      const githubUser = {
        id: 'github-new-101',
        email: 'github-new@example.com',
        name: 'GitHub New User',
        avatar_url: 'https://github.com/new-avatar.png',
      }
      const result = await authService.login(AuthType.GITHUB, githubUser)
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(githubUser.email)
      expect(result.user.nickname).toBe(githubUser.name)
      expect(result.user.avatar).toBe(githubUser.avatar_url)
      expect(result.user.githubId).toBe(githubUser.id)
    })

    it('should throw 400 when user data is missing', async () => {
      const { authService } = createTestServices({ env })
      await expect(authService.login(AuthType.GOOGLE, undefined)).rejects.toThrow(HTTPException)
      try {
        await authService.login(AuthType.GOOGLE, undefined)
      }
      catch (error) {
        expect((error as HTTPException).status).toBe(400)
      }
    })
  })

  describe('ticket', () => {
    it('should generate once ticket and store in KV', async () => {
      const { authService } = createTestServices({ env })
      const ticket = await authService.generateOnceTicket(testUserTemplate)
      expect(ticket).toBeDefined()
      expect(typeof ticket).toBe('string')
      expect(ticket).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      const storedToken = await env.KV.get(`oauth:once:${ticket}`)
      expect(storedToken).toBeDefined()
    })

    it('should build ticket redirect URL', async () => {
      const { authService } = createTestServices({ env })
      const redirectUrl = 'https://client.example.com/callback'
      const result = await authService.buildTicketRedirectUrl(testUserTemplate, redirectUrl)
      expect(result).toContain(redirectUrl)
      expect(result).toContain('ticket=')
      const url = new URL(result)
      expect(url.searchParams.has('ticket')).toBe(true)
    })

    it('should check and consume once ticket', async () => {
      const { authService } = createTestServices({ env })
      const ticket = await authService.generateOnceTicket(testUserTemplate)
      const token = await authService.checkOnceTicket(ticket)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      const secondCheck = await authService.checkOnceTicket(ticket)
      expect(secondCheck).toBeNull()
    })

    it('should return null for non-existent ticket', async () => {
      const { authService } = createTestServices({ env })
      const result = await authService.checkOnceTicket('non-existent-ticket-uuid')
      expect(result).toBeNull()
    })
  })
})
