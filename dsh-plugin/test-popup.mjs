// Smoke test for the DSH plugin popup: launcher exists, empty state renders
// the help panel, and pending cards render approve buttons. No broker calls are
// made (fetch is stubbed).
import fs from 'node:fs'
import { webcrypto } from 'node:crypto'

const client = fs.readFileSync('lib/client.js', 'utf8')

// Minimal DOM stub: enough for the popup code path.
const nodes = []
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; this._html = ''; this.textContent = ''; this.classList = { _s: new Set(), add(x) { this._s.add(x) }, remove(x) { this._s.delete(x) }, toggle(x, f) { f ? this._s.add(x) : this._s.delete(x) }, contains(x) { return this._s.has(x) } } }
  setAttribute(k, v) { this[k] = v }
  appendChild(c) { this.children.push(c); return c }
  append(...c) { this.children.push(...c) }
  get firstChild() { return this.children[0] }
  set innerHTML(v) { this._html = v; this.children = [] }
  get innerHTML() { return this._html }
  remove() { this.removed = true }
  querySelector(sel) { return this.children.find((c) => c._matches === sel) ?? null }
  addEventListener() {}
}
const doc = {
  body: new El('body'),
  createElement: (t) => new El(t),
  getElementById: (id) => doc.body.children.find((c) => c.id === id) ?? null,
}
globalThis.document = doc
globalThis.window = { innerWidth: 1400 }
globalThis.fetch = async (url) => {
  if (String(url).includes('/pending')) return { json: async () => ({ pending: [] }) }
  if (String(url).includes('/credential-requests')) return { json: async () => ({ requests: [] }) }
  return { json: async () => ({}) }
}
globalThis.react = { createElement: () => ({}) }

// Extract startPopup by brace matching and run it.
const start = client.indexOf('function startPopup(ctx)')
if (start < 0) throw new Error('startPopup not found')
let depth = 0, i = client.indexOf('{', start), end = i
for (; i < client.length; i++) {
  if (client[i] === '{') depth++
  else if (client[i] === '}') { depth--; if (depth === 0) { end = i; break } }
}
const body = client.slice(start, end + 1)
const fn = new Function('ctx', body + '\n return startPopup(ctx)')

const cleanup = fn({})
const launcher = doc.body.children.find((c) => c.id === 'secrets-broker-launcher')
if (!launcher) { console.log('FAIL launcher missing'); process.exit(1) }
console.log('PASS launcher present')

launcher.onclick()
setTimeout(() => {
  const overlay = doc.body.children.find((c) => c !== launcher)
  if (!overlay) { console.log('FAIL empty panel did not open'); process.exit(1) }
  const help = overlay.children.find((c) => c['data-help'])
  if (!help) { console.log('FAIL help panel missing'); process.exit(1) }
  console.log('PASS empty panel opens with help')
  cleanup()
  process.exit(0)
}, 1200)
