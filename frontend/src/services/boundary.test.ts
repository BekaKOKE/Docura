/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// #11 AC 4: no component imports the mock or the http implementation directly. They go through
// `services` from src/services (AGENTS.md rule 1). Plain search over the source, outside src/services.
// It reads the disk on every run (import.meta.glob would be cached with the test file).
const SRC = fileURLToPath(new URL('..', import.meta.url))

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSources(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

/** Paths relative to src, with forward slashes. */
const files = listSources(SRC).map((path) => ({
  path: relative(SRC, path).split(sep).join('/'),
  text: readFileSync(path, 'utf8'),
}))

const IMPORT_OF_IMPLEMENTATION = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"][^'"]*services\/(?:mock|http)(?:\/[^'"]*)?['"]/

describe('services boundary', () => {
  it('scans the source tree', () => {
    const paths = files.map((f) => f.path)
    expect(paths.length).toBeGreaterThan(5)
    expect(paths).toContain('services/index.ts')
    expect(paths).toContain('main.tsx')
  })

  it('has no import of services/mock or services/http outside src/services', () => {
    const offenders = files
      .filter((f) => !f.path.startsWith('services/'))
      .filter((f) => IMPORT_OF_IMPLEMENTATION.test(f.text))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  it('detects the imports it forbids', () => {
    expect(IMPORT_OF_IMPLEMENTATION.test(`import { mockServices } from '../services/mock'`)).toBe(true)
    expect(IMPORT_OF_IMPLEMENTATION.test(`import { httpServices } from "../../services/http/index"`)).toBe(true)
    expect(IMPORT_OF_IMPLEMENTATION.test(`const m = await import('../services/mock')`)).toBe(true)
    expect(IMPORT_OF_IMPLEMENTATION.test(`import { services } from '../services'`)).toBe(false)
    expect(IMPORT_OF_IMPLEMENTATION.test(`import { ApiError } from '../services/errors'`)).toBe(false)
  })
})
