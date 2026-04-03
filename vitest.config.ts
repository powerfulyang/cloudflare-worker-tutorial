import { join } from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  // Read all migrations in the `migrations` directory
  const migrationsPath = join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    plugins: [
      cloudflareTest({
        isolatedStorage: true, // Use isolated storage for each worker, **important**
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          // Add a test-only binding for migrations, so we can apply them in a
          // setup file
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
      tsconfigPaths(),
    ],
    test: {
      globals: true,
      setupFiles: ['./.vitest/apply-migrations.ts'],
    },
  }
})
