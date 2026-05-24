import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argv, exit, stderr, stdout } from 'node:process'

const ROOT = resolve(argv[2] || 'src')
const PATTERN = /from\s+['"](\.\.?\/[^'"]*\/schema)['"]/

function* walkSync(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walkSync(p)
    else if (entry.name.endsWith('.ts')) yield p
  }
}

const violations = []
for (const file of walkSync(ROOT)) {
  const content = readFileSync(file, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(PATTERN)
    if (m && !line.includes('.js')) {
      violations.push(`${file}: ${m[1]}`)
    }
  }
}

if (violations.length > 0) {
  stderr.write('ERROR: Bare schema imports found. Use .js extension:\n')
  for (const v of violations) stderr.write(`  ${v}\n`)
  exit(1)
}
stdout.write('All schema imports use .js extension\n')
