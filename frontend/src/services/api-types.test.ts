/// <reference types="node" />
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import yamlRaw from '../../../contracts/openapi.yaml?raw'
import generated from './api-types.ts?raw'
import contractsSource from './contracts.ts?raw'

// #34: the runtime half of the contract check; the type half is api-types.check.ts.

const yaml = yamlRaw.replace(/\r\n/g, '\n')

/** Every services method as `service.method`, read from contracts.ts. */
function serviceMethods(): string[] {
  const services = /export interface Services \{([\s\S]*?)\n\}/.exec(contractsSource)?.[1] ?? ''
  return [...services.matchAll(/^ {2}(\w+): (\w+)$/gm)].flatMap(([, service, name]) => {
    const body = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(contractsSource)?.[1] ?? ''
    return [...body.matchAll(/^ {2}(\w+)\(/gm)].map((m) => `${service}.${m[1]}`)
  })
}

const mapped = [...yaml.matchAll(/^ {6}x-service-method: (\S+)$/gm)].map((m) => m[1]!)
const operationIds = [...yaml.matchAll(/^ {6}operationId: (\S+)$/gm)].map((m) => m[1]!)

/** Makes no request: the http services forget the bearer token on the client. */
const WITHOUT_OPERATION = ['auth.logout']
/** Operations no services method calls: a liveness probe, and the URL an `<img>` loads from `PublicDocument.logoUrl`. */
const WITHOUT_METHOD = ['healthGet', 'publicGetLogo']

describe('contracts/openapi.yaml', () => {
  it('has the 33 MVP operations, each with its own id', () => {
    expect(operationIds).toHaveLength(33)
    expect(new Set(operationIds).size).toBe(33)
  })

  it('maps every services method to exactly one operation', () => {
    const methods = serviceMethods()
    expect(methods).toHaveLength(32)
    expect([...mapped].sort()).toEqual(methods.filter((m) => !WITHOUT_OPERATION.includes(m)).sort())
    expect(mapped.length + WITHOUT_METHOD.length).toBe(operationIds.length)
  })

  it('has no post-MVP operation or value', () => {
    expect(yaml).not.toMatch(/cancel|duplicate|decline|\/events|\/link/)
  })
})

describe('src/services/api-types.ts', () => {
  it('was generated from the contract as it is now (run `npm run gen:api` if not)', () => {
    const hash = createHash('sha256').update(yaml).digest('hex')
    expect(generated).toContain(`// contract sha256: ${hash}\n`)
  })
})
