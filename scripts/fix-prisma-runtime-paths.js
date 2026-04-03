import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const runtimeDir = join(process.cwd(), 'prisma', 'client', 'runtime')
const generatedClientPkgPath = join(process.cwd(), 'prisma', 'client', 'package.json')
const generatedClientPkg = JSON.parse(readFileSync(generatedClientPkgPath, 'utf8'))
const runtimeUtilsVersion = generatedClientPkg.dependencies?.['@prisma/client-runtime-utils']

if (!runtimeUtilsVersion) {
  throw new Error('Cannot find @prisma/client-runtime-utils version in prisma/client/package.json')
}

const runtimeFiles = [
  join(runtimeDir, 'client.js'),
  join(runtimeDir, 'index-browser.js'),
  join(runtimeDir, 'wasm-compiler-edge.js'),
]

for (const file of runtimeFiles) {
  const source = readFileSync(file, 'utf8')
  const patched = source.replaceAll('@prisma/client-runtime-utils', './@prisma/client-runtime-utils')
  writeFileSync(file, patched, 'utf8')
}

const shimDir = join(runtimeDir, '@prisma')
mkdirSync(shimDir, { recursive: true })

const shimTarget = `../../../../node_modules/.pnpm/@prisma+client-runtime-utils@${runtimeUtilsVersion}/node_modules/@prisma/client-runtime-utils/dist/index.js`
const shimContent = `module.exports = require('${shimTarget}')\n`
writeFileSync(join(shimDir, 'client-runtime-utils.js'), shimContent, 'utf8')

console.log('Patched Prisma runtime imports for workerd/vitest compatibility')
