import type { PrismaClient, Record } from '#/prisma/client/edge'

export class RecordRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  findById(id: string) {
    return this.prisma.record.findUnique({
      where: { id },
    })
  }

  upsert(id: string, data: string): Promise<Record> {
    return this.prisma.record.upsert({
      where: { id },
      create: {
        id,
        data,
      },
      update: {
        data,
      },
    })
  }
}
