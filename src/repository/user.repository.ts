import type { Prisma, PrismaClient, User } from '#/prisma/client/edge'

export type OAuthProviderField = 'googleId' | 'discordId' | 'githubId'

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
    })
  }

  findByProviderId(providerField: OAuthProviderField, providerId: string) {
    return this.prisma.user.findFirst({
      where: {
        [providerField]: providerId,
      },
    })
  }

  updateById(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    })
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    })
  }
}
