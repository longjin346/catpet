#!/usr/bin/env node
/**
 * Creates dist/CatPet-{version}-win-x64.zip from the electron-builder dir output.
 *
 * Usage:
 *   pnpm build          # produces dist/win-unpacked/
 *   pnpm package:zip    # zips it → dist/CatPet-{version}-win-x64.zip
 *
 * The zip contains a single top-level "CatPet/" folder so it extracts cleanly.
 */

import { createRequire }                           from 'node:module'
import { createWriteStream, existsSync, statSync } from 'node:fs'
import { readFile }                                from 'node:fs/promises'
import { join, dirname }                           from 'node:path'
import { fileURLToPath }                           from 'node:url'

const require  = createRequire(import.meta.url)
const archiver = require('archiver')

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = join(__dirname, '..')

const pkg     = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const version = pkg.version

const srcDir = join(root, 'dist', 'win-unpacked')
const outZip = join(root, 'dist', `CatPet-${version}-win-x64.zip`)

// ── Pre-flight checks ──────────────────────────────────────────────────────────

if (!existsSync(srcDir)) {
  console.error(`\nError: ${srcDir} not found.\nRun "pnpm build" first to produce the packaged app.\n`)
  process.exit(1)
}

const exePath = join(srcDir, 'CatPet.exe')
if (!existsSync(exePath)) {
  console.error(`\nError: CatPet.exe not found in ${srcDir}.\nThe build may be incomplete — re-run "pnpm build".\n`)
  process.exit(1)
}

// ── Create zip ─────────────────────────────────────────────────────────────────

console.log(`\nPackaging CatPet v${version}`)
console.log(`  Source : ${srcDir}`)
console.log(`  Output : ${outZip}\n`)

const output  = createWriteStream(outZip)
const archive = archiver('zip', { zlib: { level: 6 } })

await new Promise((resolve, reject) => {
  output.on('close', resolve)
  archive.on('error', reject)
  archive.on('warning', w => {
    if (w.code !== 'ENOENT') reject(w)
    else console.warn('Warning:', w.message)
  })

  archive.pipe(output)

  // Everything goes into a CatPet/ subfolder so the zip extracts cleanly
  archive.directory(srcDir, 'CatPet')

  archive.finalize()
})

const bytes = statSync(outZip).size
const mb    = (bytes / 1_000_000).toFixed(1)
console.log(`Done!  ${outZip}  (${mb} MB)\n`)

// ── Verification checklist ─────────────────────────────────────────────────────

const checks = [
  ['CatPet.exe',                          join(srcDir, 'CatPet.exe')],
  ['README.txt',                          join(srcDir, 'README.txt')],
  ['resources/app.asar',                  join(srcDir, 'resources', 'app.asar')],
  ['resources/app.asar.unpacked',         join(srcDir, 'resources', 'app.asar.unpacked')],
]

console.log('Portable build verification:')
let allOk = true
for (const [label, p] of checks) {
  const ok = existsSync(p)
  if (!ok) allOk = false
  console.log(`  ${ok ? '✓' : '✗'} ${label}`)
}

if (!allOk) {
  console.warn('\nSome expected files are missing — review the build output above.')
}
console.log()
