/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import { build, type Rollup } from 'vite'
import { describe, expect, it } from 'vitest'

// #14 AC 5: the dev panel and the error injection are not in `npm run build`. This builds the real app entry
// (src/main.tsx) in production mode, plus an import of `services` so the mock is in the bundle the way it will be
// once screens use it, and looks for the panel's strings, the injector and the panel's styles in the output.
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ENTRY = '\0production-build-check'

async function buildApp(): Promise<{ js: string; css: string }> {
  // vitest runs with NODE_ENV=test, which would make this a development build; `npm run build` has NODE_ENV=production.
  const nodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    return await buildWithVite()
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = nodeEnv
  }
}

async function buildWithVite(): Promise<{ js: string; css: string }> {
  const result = (await build({
    root: ROOT,
    mode: 'production',
    logLevel: 'silent',
    plugins: [
      {
        name: 'production-build-check-entry',
        resolveId: (id) => (id === 'virtual:production-build-check' ? ENTRY : undefined),
        load: (id) =>
          id === ENTRY
            ? `import ${JSON.stringify(ROOT + 'src/main.tsx')}\nimport { services } from ${JSON.stringify(ROOT + 'src/services/index.ts')}\nglobalThis.__services = services\n`
            : undefined,
      },
    ],
    build: { write: false, minify: true, rollupOptions: { input: 'virtual:production-build-check' } },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[]
  const output = (Array.isArray(result) ? result[0]! : result).output
  const text = (predicate: (file: Rollup.OutputAsset | Rollup.OutputChunk) => boolean) =>
    output
      .filter(predicate)
      .map((file) => (file.type === 'chunk' ? file.code : String(file.source)))
      .join('\n')
  return { js: text((f) => f.type === 'chunk'), css: text((f) => f.type === 'asset' && f.fileName.endsWith('.css')) }
}

describe('production build', () => {
  it('has the mock store but not the dev panel, the forced errors or their strings', async () => {
    const { js, css } = await buildApp()
    // The mock is there, so the check is not passing on an empty bundle.
    expect(js).toContain('docura.mock.v1')
    expect(js).toContain('docura-dev-2026')
    // The panel and the injection are not.
    for (const text of [
      'Сбросить данные',
      'Инструменты разработчика',
      'Вызвать ошибку API',
      'Снять все ошибки',
      'times must be a positive integer',
      'dev-launcher',
      'dev-panel',
    ]) {
      expect(js.includes(text), `js has "${text}"`).toBe(false)
    }
    expect(css).not.toMatch(/\.dev-(launcher|panel|row)/)
  }, 60_000)
})
