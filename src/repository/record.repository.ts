import type { PrismaClient, Record } from '#/prisma/client/edge'
import { Logger } from '@/utils'

const log = new Logger('RecordRepository')

export class RecordRepository {
  constructor(private readonly prisma: PrismaClient) {
  }

  async findById(id: string) {
    const startTime = Date.now()
    log.debug('Database query started', {
      table: 'records',
      operation: 'findById',
      recordId: id,
    })

    const result = await this.prisma.record.findUnique({
      where: { id },
    })

    const durationMs = Date.now() - startTime
    log.debug('Database query completed', {
      table: 'records',
      operation: 'findById',
      found: !!result,
      durationMs,
    })

    return result
  }

  async upsert(id: string, data: string): Promise<Record> {
    const startTime = Date.now()
    log.debug('Database upsert started', {
      table: 'records',
      operation: 'upsert',
      recordId: id,
    })

    const result = await this.prisma.record.upsert({
      where: { id },
      create: {
        id,
        data,
      },
      update: {
        data,
      },
    })

    const durationMs = Date.now() - startTime
    log.info('Database upsert completed', {
      table: 'records',
      operation: 'upsert',
      recordId: id,
      durationMs,
    })

    return result
  }
}
