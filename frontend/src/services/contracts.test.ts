import { describe, expect, it } from 'vitest'
import contractsSource from './contracts.ts?raw'
import type { Services } from './contracts'

// #11 AC 1: eight services, MVP methods only.
const SERVICE_KEYS = [
  'auth',
  'company',
  'clients',
  'articles',
  'documents',
  'payments',
  'dashboard',
  'public',
] as const

// Compile-time check: Services has exactly these keys (a missing or an extra key fails `npm run typecheck`).
type Missing = Exclude<(typeof SERVICE_KEYS)[number], keyof Services>
type Extra = Exclude<keyof Services, (typeof SERVICE_KEYS)[number]>
const noMissing: Missing extends never ? true : false = true
const noExtra: Extra extends never ? true : false = true

/** Method names of an interface in contracts.ts, read from the source. */
function methodsOf(name: string): string[] {
  const body = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(contractsSource)?.[1]
  if (body === undefined) throw new Error(`interface ${name} not found in contracts.ts`)
  return [...body.matchAll(/^ {2}(\w+)\(/gm)].map((m) => m[1]!)
}

describe('Services contract', () => {
  it('has the eight services of the architecture', () => {
    expect(noMissing && noExtra).toBe(true)
    const body = /export interface Services \{([\s\S]*?)\n\}/.exec(contractsSource)?.[1] ?? ''
    expect([...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1])).toEqual([...SERVICE_KEYS])
  })

  it('leaves the post-MVP methods out (cancel, duplicate, rotate link, events, decline)', () => {
    expect(contractsSource).not.toMatch(/cancel|duplicate|rotateLink|events|decline/i)
  })

  it('has the MVP methods of each service', () => {
    expect(methodsOf('AuthService')).toEqual(['register', 'login', 'me', 'logout'])
    expect(methodsOf('CompanyService')).toEqual(['create', 'get', 'update', 'uploadLogo', 'logoUrl'])
    expect(methodsOf('ClientsService')).toEqual(['list', 'get', 'create', 'update', 'remove'])
    expect(methodsOf('ArticlesService')).toEqual(['list', 'create', 'update', 'remove'])
    expect(methodsOf('DocumentsService')).toEqual([
      'list',
      'get',
      'create',
      'update',
      'remove',
      'issue',
      'convert',
      'signatureBlob',
    ])
    expect(methodsOf('PaymentsService')).toEqual(['list', 'create', 'remove'])
    expect(methodsOf('DashboardService')).toEqual(['get'])
    expect(methodsOf('PublicService')).toEqual(['get', 'sign'])
  })

  it('makes every method async', () => {
    const methods = [...contractsSource.matchAll(/^ {2}\w+\(.*\): (.+)$/gm)].map((m) => m[1]!)
    expect(methods.length).toBeGreaterThan(25)
    for (const returnType of methods) expect(returnType).toMatch(/^Promise</)
  })
})
