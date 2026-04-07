import type { Record } from '#/prisma/client/edge'
import type { ServiceDependencies } from '@/core/base.service'
import type { RecordRepository } from '@/repository/record.repository'
import { HTTPException } from 'hono/http-exception'
import { BaseService } from '@/core/base.service'
import { Logger } from '@/utils'

const log = new Logger('RecordService')

export class RecordService extends BaseService {
  constructor(
    deps: ServiceDependencies,
    private readonly recordRepository: RecordRepository,
  ) {
    super(deps)
  }

  async findById(id: string) {
    log.debug('Record lookup started', { recordId: id })
    const record = await this.recordRepository.findById(id)

    if (!record) {
      log.warn('Record not found', { recordId: id })
      throw new HTTPException(404, {
        message: 'Record not found',
      })
    }

    log.info('Record found', { recordId: id })
    return this.formatRecord(record)
  }

  async upsert(id: string, data: unknown) {
    const dataSize = JSON.stringify(data).length
    log.debug('Record upsert started', { recordId: id, dataSize })

    const record = await this.recordRepository.upsert(id, JSON.stringify(data))

    log.info('Record upserted', { recordId: id, dataSize })
    return this.formatRecord(record)
  }

  private formatRecord(record: Record) {
    return {
      id: record.id,
      data: JSON.parse(record.data),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}
