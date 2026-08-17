// XTRITIUM §3.1 — Zero network. Ever.
// Fails the build if any network primitive appears in src/.
// A plain address written as text (the About page's source URL) is not a
// primitive: "https:" is a scheme, "https." is a module member access.

import { walk, collect, report, SRC } from './lib/scan.mjs'

const rules = [
  { pattern: /\bfetch\s*\(/, why: 'fetch() is a network primitive' },
  { pattern: /\bXMLHttpRequest\b/, why: 'XMLHttpRequest is a network primitive' },
  { pattern: /\bWebSocket\b/, why: 'WebSocket is a network primitive' },
  { pattern: /\bEventSource\b/, why: 'EventSource opens a network stream' },
  { pattern: /navigator\s*\.\s*sendBeacon/, why: 'sendBeacon transmits to a server' },
  { pattern: /\bnet\s*\./, why: 'node:net member access' },
  { pattern: /\bhttp\s*\./, why: 'node:http member access' },
  { pattern: /\bhttps\s*\./, why: 'node:https member access' },
  {
    pattern: /\bfrom\s+['"]node:(http|https|net|tls|dgram|dns)['"]/,
    why: 'importing a network module'
  },
  {
    pattern: /\brequire\s*\(\s*['"](node:)?(http|https|net|tls|dgram|dns)['"]\s*\)/,
    why: 'requiring a network module'
  },
  { pattern: /\bshell\s*\.\s*openExternal/, why: 'openExternal leaves the app (XTRITIUM §3.5)' },
  { pattern: /\bsetPermissionRequestHandler\s*\(\s*\)/, why: 'permission handler must be explicit' }
]

const files = walk(SRC, ['.ts', '.tsx', '.js', '.mjs', '.html', '.css', '.json'])
report('audit-egress', collect(files, rules))
