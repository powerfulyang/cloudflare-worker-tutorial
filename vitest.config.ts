import { join } from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
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
          // 预先设置 vitest runner 需要的 compatibility flags，避免 debug 输出
          compatibilityFlags: [
            'nodejs_compat',
            'enable_nodejs_tty_module',
            'enable_nodejs_fs_module',
            'enable_nodejs_http_modules',
            'enable_nodejs_perf_hooks_module',
            'enable_nodejs_v8_module',
            'enable_nodejs_process_v2',
          ],
        },
      }),
    ],
    resolve: {
      tsconfigPaths: true,
      alias: {
        '#': join(__dirname),
      },
    },
    test: {
      globals: true,
      setupFiles: ['./.vitest/apply-migrations.ts'],
      include: ['tests/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
      exclude: ['tests/e2e'],
    },
  }
})
