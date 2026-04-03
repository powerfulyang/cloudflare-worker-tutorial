import type { User } from '#/prisma/client/edge'

export interface ServiceDependencies {
  env: Bindings
  requestId?: string
  user?: User
}

export class BaseService {
  constructor(protected readonly deps: ServiceDependencies) {
  }

  protected get env() {
    return this.deps.env
  }

  protected get requestId() {
    return this.deps.requestId
  }

  protected get user() {
    return this.deps.user
  }
}
