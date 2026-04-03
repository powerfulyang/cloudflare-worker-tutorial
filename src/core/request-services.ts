import type { AuthService } from '@/service/auth.service'
import type { RecordService } from '@/service/record.service'
import { getPrismaInstance } from '@/core/prisma'
import { RecordRepository } from '@/repository/record.repository'
import { UserRepository } from '@/repository/user.repository'
import { AuthService as AuthServiceClass } from '@/service/auth.service'
import { RecordService as RecordServiceClass } from '@/service/record.service'

export interface RequestServices {
  authService: AuthService
  recordService: RecordService
}

export function createRequestServices({
  env,
  requestId,
}: {
  env: Bindings
  requestId?: string
}): RequestServices {
  const prisma = getPrismaInstance(env.DB)
  const userRepository = new UserRepository(prisma)
  const recordRepository = new RecordRepository(prisma)
  const serviceDeps = {
    env,
    requestId,
  }

  return {
    authService: new AuthServiceClass(serviceDeps, userRepository),
    recordService: new RecordServiceClass(serviceDeps, recordRepository),
  }
}
