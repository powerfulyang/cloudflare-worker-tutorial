import type { Record } from '#/prisma/client/edge'
import type { ServiceDependencies } from '@/core/base.service'
import type { RecordRepository } from '@/repository/record.repository'
import { HTTPException } from 'hono/http-exception'
import { BaseService } from '@/core/base.service'

export class RecordService extends BaseService {
  constructor(
    deps: ServiceDependencies,
    private readonly recordRepository: RecordRepository,
  ) {
    super(deps)
  }

  async findById(id: string) {
    const record = await this.recordRepository.findById(id)

    if (!record) {
      throw new HTTPException(404, {
        message: 'Record not found',
      })
    }

    return this.formatRecord(record)
  }

  async upsert(id: string, data: unknown) {
    const record = await this.recordRepository.upsert(id, JSON.stringify(data))

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
