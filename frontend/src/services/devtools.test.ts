import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearForcedErrors,
  devLogins,
  forceNextError,
  getDevSnapshot,
  mockDevtoolsEnabled,
  resetMockData,
  subscribeDevtools,
} from './devtools'
import { mockServices } from './mock'

// The singleton runtime of the app, on memory storage (no localStorage in the test environment).
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  clearForcedErrors()
  await settle(mockServices.auth.logout())
  resetMockData()
  vi.useRealTimers()
})

/** Runs a mock call to its end: the 400 ms latency passes on the fake clock. */
async function settle<T>(call: Promise<T>): Promise<PromiseSettledResult<T>> {
  const result = Promise.allSettled([call]).then(([r]) => r!)
  await vi.advanceTimersByTimeAsync(400)
  return result
}

describe('devtools', () => {
  it('is on in the tests (development mode, mock services)', () => {
    expect(mockDevtoolsEnabled).toBe(true)
  })

  it('lists the dev logins of the seed with their companies', () => {
    expect(devLogins()).toEqual([
      { email: 'seitkali@example.kz', password: 'docura-dev-2026', company: 'ИП Сейткали Б.' },
      { email: 'nurlanov@example.kz', password: 'docura-dev-2026', company: 'ИП Нурланов А.' },
    ])
  })

  it('returns the same snapshot until something changes, so React can compare it', () => {
    const first = getDevSnapshot()
    expect(getDevSnapshot()).toBe(first)
    forceNextError('not_found')
    const second = getDevSnapshot()
    expect(second).not.toBe(first)
    expect(second.forced).toEqual([{ code: 'not_found', remaining: 1 }])
    expect(getDevSnapshot()).toBe(second)
  })

  it('forces an error on the next mock call and then goes back to normal', async () => {
    forceNextError('rate_limited')
    const forced = await settle(mockServices.auth.me())
    expect(forced).toMatchObject({ status: 'rejected', reason: { code: 'rate_limited', status: 429 } })
    expect(getDevSnapshot().forced).toEqual([])
    const normal = await settle(mockServices.auth.me())
    expect(normal).toMatchObject({ status: 'rejected', reason: { code: 'unauthorized' } })
  })

  it('tells subscribers when the queue or the data changes', async () => {
    const listener = vi.fn()
    const off = subscribeDevtools(listener)
    forceNextError('overpayment')
    expect(listener).toHaveBeenCalledTimes(1)
    clearForcedErrors()
    expect(listener).toHaveBeenCalledTimes(2)
    await settle(mockServices.auth.login({ email: 'seitkali@example.kz', password: 'docura-dev-2026' }))
    expect(listener.mock.calls.length).toBeGreaterThan(2)
    off()
    const count = listener.mock.calls.length
    resetMockData()
    expect(listener).toHaveBeenCalledTimes(count)
  })

  it('describes the signed-in company with only the rows it can see (AC 6)', async () => {
    expect(getDevSnapshot().session).toBeNull()
    await settle(mockServices.auth.login({ email: 'seitkali@example.kz', password: 'docura-dev-2026' }))
    expect(getDevSnapshot().session).toEqual({
      email: 'seitkali@example.kz',
      companyName: 'ИП Сейткали Б.',
      counts: { clients: 3, articles: 8, documents: 12, payments: 2 },
    })
    await settle(mockServices.auth.login({ email: 'nurlanov@example.kz', password: 'docura-dev-2026' }))
    expect(getDevSnapshot().session).toEqual({
      email: 'nurlanov@example.kz',
      companyName: 'ИП Нурланов А.',
      counts: { clients: 1, articles: 0, documents: 1, payments: 0 },
    })
    await settle(
      mockServices.auth.register({ email: 'aliya@example.kz', password: 'correct-horse', fullName: 'Алия' }),
    )
    expect(getDevSnapshot().session).toEqual({ email: 'aliya@example.kz', companyName: null, counts: null })
  })

  it('resets to the seed and keeps a seed user signed in', async () => {
    await settle(mockServices.auth.login({ email: 'seitkali@example.kz', password: 'docura-dev-2026' }))
    resetMockData()
    expect(getDevSnapshot().session?.email).toBe('seitkali@example.kz')
  })
})
