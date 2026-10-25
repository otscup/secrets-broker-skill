// The tool reference drifted once already: request_fill, materialize and
// materialize_redeem shipped in the broker but never reached the reference card.
// The full tool table now lives in exactly one place — the root SKILL.md — and
// the other seven skills point at it instead of restating it.
import fs from 'node:fs'

const workers = process.env.SECRETS_BROKER_WORKERS ?? '../secrets-broker-workers'
const source = fs.readFileSync(`${workers}/src/index.js`, 'utf8')

// The MCP catalog is the literal block of { name, description, inputSchema }
// objects; take the names from that slice only, so route names and event names
// elsewhere in the file do not leak in.
const start = source.indexOf('name: \'list_secrets\'')
if (start < 0) throw new Error('MCP tool catalog not found in src/index.js — has it moved?')
const end = source.indexOf('name: \'http_request\'', start)
const catalog = source.slice(start, end + 200)
const tools = [...catalog.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1])

const card = fs.readFileSync('SKILL.md', 'utf8')
const missing = tools.filter((name) => !card.includes('`' + name + '`'))

const pass = (m) => console.log('PASS  ' + m)
const fail = (name, detail) => { console.log('FAIL  ' + name + ' :: ' + detail); process.exitCode = 1 }

if (tools.length < 9) fail('T1', 'found only ' + tools.length + ' tools: ' + tools.join(', '))
else if (missing.length) fail('T1', 'the tool table does not name: ' + missing.join(', '))
else pass('T1 the tool table names all ' + tools.length + ' broker tools')

// The card is a table; a row per tool keeps it readable. Guard the shape so a
// rewrite cannot silently drop the column and still "contain the name".
const rows = card.split('\n').filter((line) => /^\| `[a-z_]+` \|/.test(line))
if (rows.length === tools.length) pass('T2 the tool table has one row per tool')
else fail('T2', 'table rows=' + rows.length + ' tools=' + tools.length)

if (process.exitCode) console.log('\n==== skill tools FAILED ====')
else console.log('\n==== skill tools ' + 2 + '/2 passed ====')
