import type { Prisma, PrismaClient, User } from '#/prisma/client/edge'
import { Logger } from '@/utils'

const log = new Logger('UserRepository')

export type OAuthProviderField = 'googleId' | 'discordId' | 'githubId'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  async findByEmail(email: string) {
    const startTime = Date.now()
    log.debug('Database query started', { table: 'users', operation: 'findByEmail', email })

    const result = await this.prisma.user.findFirst({
      where: { email },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'users',
      operation: 'findByEmail',
      found: !!result,
      durationMs,
    })

    return result
  }

  async findByProviderId(providerField: OAuthProviderField, providerId: string) {
    const startTime = Date.now()
    log.debug('Database query started', {
      table: 'users',
      operation: 'findByProviderId',
      providerField,
    })

    const result = await this.prisma.user.findFirst({
      where: {
        [providerField]: providerId,
      },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'users',
      operation: 'findByProviderId',
      found: !!result,
      durationMs,
    })

    return result
  }

  async updateById(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const startTime = Date.now()
    log.debug('Database update started', { table: 'users', operation: 'updateById', userId: id })

    const result = await this.prisma.user.update({
      where: { id },
      data,
    })

    const durationMs = Date.now() - startTime
    log.info('Database update completed', {
      table: 'users',
      operation: 'updateById',
      userId: id,
      durationMs,
    })

    return result
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const startTime = Date.now()
    log.debug('Database insert started', { table: 'users', operation: 'create' })

    const result = await this.prisma.user.create({
      data,
    })

    const durationMs = Date.now() - startTime
    log.info('Database insert completed', {
      table: 'users',
      operation: 'create',
      userId: result.id,
      durationMs,
    })

    return result
  }
}
