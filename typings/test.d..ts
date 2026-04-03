declare global {
  namespace Cloudflare {
    interface Env extends Bindings {
      TEST_MIGRATIONS: {
        name: string
        queries: string[]
      }[]
    }
  }
}

export {}
