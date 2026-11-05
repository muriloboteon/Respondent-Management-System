// Creates a prototype variant: a full copy of an existing variant's app that can then change freely.
//
//   node scripts/new-variant.mjs <id> "<Tab label>" [--from <variant id>]   (default: --from main)
//
// - Copies the app (src/, without the shared src/data and src/prototype) into src/variants/<id>/.
// - Gives its saved preferences their own localStorage keys ("respondent-hub:<id>:…").
// - Adds variants/<id>/index.html (served at /variants/<id>/) and a tab in src/prototype/variants.ts.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [id, label, ...rest] = process.argv.slice(2)
const from = rest[0] === '--from' ? rest[1] : 'main'
if (!id || !label || !/^[a-z][a-z0-9-]*$/.test(id) || id === 'main') {
  console.error('Usage: node scripts/new-variant.mjs <id> "<Tab label>" [--from <variant id>]  (id: lowercase, dashes)')
  process.exit(1)
}

const source = from === 'main' ? 'src' : join('src/variants', from)
const target = join('src/variants', id)
if (!existsSync(source)) throw new Error(`No variant "${from}" at ${source}`)
if (existsSync(target)) throw new Error(`${target} already exists`)

// Shared by every variant, so never copied (src/variants holds the copies themselves).
const SHARED = new Set(['data', 'prototype', 'variants'])
mkdirSync(target, { recursive: true })
for (const name of readdirSync(source)) {
  if (source === 'src' && SHARED.has(name)) continue
  cpSync(join(source, name), join(target, name), { recursive: true })
}

const fromPrefix = from === 'main' ? 'respondent-hub:' : `respondent-hub:${from}:`
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
for (const file of walk(target).filter((p) => /\.(ts|tsx)$/.test(p))) {
  const text = readFileSync(file, 'utf8')
  const next = text
    .replaceAll(`'${fromPrefix}`, `'respondent-hub:${id}:`)
    .replace(/<VariantBar current="[^"]*" \/>/, `<VariantBar current="${id}" />`)
  if (next !== text) writeFileSync(file, next)
}

mkdirSync(join('variants', id), { recursive: true })
const html = readFileSync('variants/main/index.html', 'utf8').replace('/src/main.tsx', `/src/${target.replaceAll('\\', '/').slice(4)}/main.tsx`)
writeFileSync(join('variants', id, 'index.html'), html)

const registry = 'src/prototype/variants.ts'
const reg = readFileSync(registry, 'utf8')
const entry = `  { id: '${id}', label: '${label.replaceAll("'", "\\'")}', description: 'Copy of ${from}: describe what this variant tries' },\n`
writeFileSync(registry, reg.replace(/\n\]\n/, `\n${entry}]\n`))

console.log(`Created ${target} (from ${from}), variants/${id}/index.html and a "${label}" tab.`)
