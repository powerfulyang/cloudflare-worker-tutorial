import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

function pad(value) {
  return String(value).padStart(2, '0')
}

function createFileName() {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
  const suffix = randomBytes(3).toString('hex')
  return `${timestamp}_${suffix}.sql`
}

const migrationsDir = join(process.cwd(), 'migrations')
const output = join(migrationsDir, createFileName())

mkdirSync(migrationsDir, { recursive: true })

const prismaBinary = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
)

const result = spawnSync(prismaBinary, [
  'migrate',
  'diff',
  '--from-local-d1',
  '--to-schema-datamodel',
  './prisma/schema.prisma',
  '--script',
  '--output',
  output,
], {
  stdio: 'inherit',
  shell: false,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`Created migration: ${output}`)
