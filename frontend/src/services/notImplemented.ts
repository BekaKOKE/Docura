import type { Services } from './contracts'

/** Thrown (as a rejected promise) by a services implementation that is not built yet. */
export class NotImplementedError extends Error {
  readonly implementation: string
  readonly method: string

  constructor(implementation: string, method: string, hint: string) {
    super(`${implementation} services: ${method}() is not implemented (${hint})`)
    this.name = 'NotImplementedError'
    this.implementation = implementation
    this.method = method
  }
}

const SERVICE_NAMES = [
  'auth',
  'company',
  'clients',
  'articles',
  'documents',
  'payments',
  'dashboard',
  'public',
] as const satisfies readonly (keyof Services)[]

/**
 * A `Services` whose every method rejects with `NotImplementedError`, without any network call.
 * It stands in for an implementation until its issue lands (mock: #14 and #18; http: #52, M5).
 */
export function createNotImplementedServices(implementation: string, hint: string): Services {
  const service = (name: string): object =>
    new Proxy(
      {},
      {
        get(_target, property) {
          // Symbols and `then` must stay undefined, or awaiting a service would treat it as a promise.
          if (typeof property !== 'string' || property === 'then') return undefined
          return async () => {
            throw new NotImplementedError(implementation, `${name}.${property}`, hint)
          }
        },
      },
    )
  return Object.fromEntries(SERVICE_NAMES.map((name) => [name, service(name)])) as unknown as Services
}
