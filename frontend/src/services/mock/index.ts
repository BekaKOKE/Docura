import type { Services } from '../contracts'
import { createNotImplementedServices } from '../notImplemented'
import { createMockAuth } from './auth'
import { getMockRuntime, type MockRuntime } from './runtime'

// The mock implementation of `Services`, on the mock store (./store.ts). Every method runs inside
// `runtime.call`, which adds the 150-400 ms latency and the dev panel's forced errors, and reaches data only
// through the store's company-scoped access, so another company's ids are 404.
//
// Built here: auth (#14). The other services reject with NotImplementedError until their issues land:
// company (#15), clients (#16), articles (#17), documents and public (#18), payments (#30), dashboard (#32).
// A new service goes in as `clients: createMockClients(getRuntime)` below, written like ./auth.ts.
// Only src/services/select.ts imports this file; screens use `services` from 'src/services'.

export function createMockServices(getRuntime: () => MockRuntime = getMockRuntime): Services {
  const notBuiltYet = createNotImplementedServices('mock', 'built in the issue of that screen: see mock/index.ts')
  return {
    ...notBuiltYet,
    auth: createMockAuth(getRuntime),
  }
}

export const mockServices: Services = createMockServices()
