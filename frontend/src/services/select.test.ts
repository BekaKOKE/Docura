import { afterEach, describe, expect, it, vi } from 'vitest'
import contractsSource from './contracts.ts?raw'
import type { Services } from './contracts'
import { httpServices } from './http'
import { mockServices } from './mock'
import { NotImplementedError } from './notImplemented'
import { resolveApiMode, selectServices } from './select'

/** Every `service.method` of the contract, read from contracts.ts. */
function allMethods(): [keyof Services, string][] {
  const pairs: [keyof Services, string][] = []
  const names: Record<string, keyof Services> = {
    AuthService: 'auth',
    CompanyService: 'company',
    ClientsService: 'clients',
    ArticlesService: 'articles',
    DocumentsService: 'documents',
    PaymentsService: 'payments',
    DashboardService: 'dashboard',
    PublicService: 'public',
  }
  for (const [iface, key] of Object.entries(names)) {
    const body = new RegExp(`export interface ${iface} \\{([\\s\\S]*?)\\n\\}`).exec(contractsSource)?.[1] ?? ''
    for (const m of body.matchAll(/^ {2}(\w+)\(/gm)) pairs.push([key, m[1]!])
  }
  return pairs
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('resolveApiMode', () => {
  it('defaults to mock when VITE_API_MODE is unset or empty', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
    expect(resolveApiMode('')).toBe('mock')
    expect(resolveApiMode('  ')).toBe('mock')
  })

  it('accepts mock and http', () => {
    expect(resolveApiMode('mock')).toBe('mock')
    expect(resolveApiMode('http')).toBe('http')
    expect(resolveApiMode('HTTP')).toBe('http')
  })

  it('rejects anything else with a clear message', () => {
    expect(() => resolveApiMode('htpp')).toThrow(/VITE_API_MODE must be "mock" or "http", got "htpp"/)
  })
})

describe('selectServices', () => {
  it('picks the mock by default and for "mock"', () => {
    expect(selectServices(undefined)).toBe(mockServices)
    expect(selectServices('mock')).toBe(mockServices)
  })

  it('picks the http stub for "http"', () => {
    expect(selectServices('http')).toBe(httpServices)
    expect(httpServices).not.toBe(mockServices)
  })
})

describe('the services export', () => {
  it('is the mock when VITE_API_MODE is not set', async () => {
    vi.stubEnv('VITE_API_MODE', '')
    vi.resetModules()
    const { services } = await import('./index')
    const { mockServices: mock } = await import('./mock')
    expect(services).toBe(mock)
  })

  it('is the http stub when VITE_API_MODE=http', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    vi.resetModules()
    const { services } = await import('./index')
    const { httpServices: http } = await import('./http')
    expect(services).toBe(http)
  })
})

describe('the http stub', () => {
  it('knows every method of the contract', () => {
    expect(allMethods().length).toBeGreaterThan(25)
  })

  it('rejects every method with a "not implemented" error and sends no request', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    for (const [service, method] of allMethods()) {
      const fn = (httpServices[service] as unknown as Record<string, () => Promise<unknown>>)[method]!
      const call = fn()
      await expect(call, `${service}.${method}`).rejects.toThrow(/not implemented/)
      await expect(fn(), `${service}.${method}`).rejects.toBeInstanceOf(NotImplementedError)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('names the method and the implementation in the message', async () => {
    await expect(httpServices.clients.list()).rejects.toThrow('http services: clients.list() is not implemented')
  })

  it('is not mistaken for a promise when awaited', async () => {
    expect(await Promise.resolve(httpServices.clients)).toBe(httpServices.clients)
  })
})

describe('the mock placeholder', () => {
  // auth is built in #14; the services of the later issues still reject until their issue lands.
  it('says a service that is not built yet is not implemented', async () => {
    await expect(mockServices.clients.list()).rejects.toThrow(/mock services: clients\.list\(\) is not implemented/)
    await expect(mockServices.documents.get('x')).rejects.toBeInstanceOf(NotImplementedError)
  })
})
