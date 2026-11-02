/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// #83 AC 1, TC-2: every idempotency key the screens send comes from `newRequestId` in src/services (a UUID), never
// from a string the screen makes itself. Plain search over the screens' source, tests left out.
const SCREENS = fileURLToPath(new URL('.', import.meta.url))

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSources(path)
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const files = listSources(SCREENS).map((path) => ({
  path: relative(SCREENS, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}))

/** The screens that send a key: the quote editor (create), convert (invoice), the act screen and the payment sheet. */
const SENDERS = ['quoteEditor/QuoteEditorScreen.tsx', 'convert/ConvertScreen.tsx', 'acts/ActDetailScreen.tsx', 'payments/RecordPaymentSheet.tsx']

describe('idempotency keys in the screens', () => {
  it('are sent by the four screens, which take them from newRequestId', () => {
    const sending = files.filter((f) => /clientRequestId(: |\s*\})/.test(f.text) && !f.path.endsWith('Rules.ts')).map((f) => f.path)
    expect(sending.sort()).toEqual([...SENDERS].sort())
    for (const path of SENDERS) {
      expect(files.find((f) => f.path === path)!.text, path).toMatch(/import \{[^}]*\bnewRequestId\b[^}]*\} from '\.\.\/\.\.\/services'/)
    }
  })

  it('are never made by hand: no prefixed keys, no Math.random, no randomUUID', () => {
    for (const { path, text } of files) {
      expect(text, path).not.toMatch(/['"`](?:pm|qe|cv|act)-\$\{/)
      expect(text, path).not.toMatch(/Math\.random\(|randomUUID\(/)
      expect(text, path).not.toMatch(/function new\w*RequestId/)
    }
  })
})
