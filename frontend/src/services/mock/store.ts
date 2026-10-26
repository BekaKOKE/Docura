// The mock store: all data lives in memory and is saved to localStorage under `docura.mock.v1` after every
// write, so it survives a reload. On first start (or when the save is missing or unreadable) it is loaded
// from contracts/fixtures/seed.json. Mock services never touch this file's state directly; they go through
// `read`/`write` (as the signed-in company) or, for sign-in and public links only, `readAll`/`writeAll`.

import { t } from '../../i18n/t'
import { ApiError } from '../errors'
import type { Id } from '../types'
import { createSeedData } from './seed'
import { createScopedDb, notFound, type ScopedDb } from './scopedDb'
import type { StoreData, StoredUser } from './storeTypes'

export const STORAGE_KEY = 'docura.mock.v1'

/** The part of `Storage` the store needs. `localStorage` fits; tests pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * `localStorage`, or null when it can't be used (private mode, blocked site data, no window). Even reading the
 * property can throw, so the whole access is wrapped.
 */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    const probe = `${STORAGE_KEY}.probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

function isStoreData(value: unknown, seedVersion: number): value is StoreData {
  if (typeof value !== 'object' || value === null) return false
  const data = value as Partial<Record<keyof StoreData, unknown>>
  if (data.schemaVersion !== 1 || data.seedVersion !== seedVersion) return false
  const lists = ['users', 'companies', 'clients', 'articles', 'documents', 'documentCounters', 'shareLinks', 'signatures', 'payments'] as const
  return lists.every((key) => Array.isArray(data[key])) && 'session' in data
}

export interface MockStore {
  /** False when the last save to localStorage failed (or there is no localStorage): data then lives in memory only. */
  readonly persistent: boolean
  /** Bumped on every change, so a UI can tell whether it is stale. */
  readonly version: number

  /**
   * Runs `fn` as the signed-in user's company. `unauthorized` (401) when nobody is signed in, `not_found` when the
   * user has no company yet. What `fn` returns is a deep copy: callers can't change the store through it.
   */
  read<T>(fn: (db: ScopedDb) => T): T
  /** As `read`, but `fn` may change data. All or nothing: if `fn` throws, nothing is saved. */
  write<T>(fn: (db: ScopedDb) => T): T
  /** As `read`/`write`, for an explicit company (a public link names its company; the client has no session). */
  readIn<T>(companyId: Id, fn: (db: ScopedDb) => T): T
  writeIn<T>(companyId: Id, fn: (db: ScopedDb) => T): T

  /** Unscoped access to every row. Only for sign-in and sign-up (users, session) and for finding a public link by its token. */
  readAll<T>(fn: (data: Readonly<StoreData>) => T): T
  writeAll<T>(fn: (data: StoreData) => T): T

  /** Back to the seed. Keeps the sign-in when that user is in the seed too. */
  reset(): void
  /** Re-reads localStorage (another tab changed it). */
  reload(): void
  /** Called after every change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export interface StoreOptions {
  /** Where to save. Default: `localStorage` when it works, else memory only. Pass null for memory only. */
  storage?: StorageLike | null
}

export function createStore(options: StoreOptions = {}): MockStore {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const listeners = new Set<() => void>()
  let persistent = storage !== null
  let version = 0
  let state: StoreData

  function save(): void {
    if (!storage) return
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
      persistent = true
    } catch {
      // Quota exceeded or storage blocked: keep working from memory; the next write tries again.
      persistent = false
    }
  }

  function load(): StoreData {
    const fresh = createSeedData()
    if (!storage) return fresh
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        if (isStoreData(parsed, fresh.seedVersion)) return parsed
      }
    } catch {
      // Unreadable or corrupt save: fall through to the seed, which then replaces it.
    }
    return fresh
  }

  function changed(): void {
    version += 1
    for (const listener of [...listeners]) listener()
  }

  state = load()
  save()

  function sessionCompany(data: StoreData): Id {
    const session = data.session
    const user = session ? data.users.find((u) => u.id === session.userId) : undefined
    if (!session || !user) throw new ApiError({ code: 'unauthorized', message: t('apiError.unauthorized') })
    // A company the user doesn't have (before onboarding) is a 404, as `GET /company` is on the API.
    if (!user.companyId || !data.companies.some((c) => c.id === user.companyId)) throw notFound()
    return user.companyId
  }

  function writeAll<T>(fn: (data: StoreData) => T): T {
    // Work on a copy and keep it only if `fn` finishes: a mock call that fails half way leaves no half-written data.
    const draft = structuredClone(state)
    const result = fn(draft)
    state = draft
    save()
    changed()
    return structuredClone(result)
  }

  return {
    get persistent() {
      return persistent
    },
    get version() {
      return version
    },

    read: (fn) => structuredClone(fn(createScopedDb(state, sessionCompany(state)))),
    write: (fn) => writeAll((draft) => fn(createScopedDb(draft, sessionCompany(draft)))),
    readIn: (companyId, fn) => structuredClone(fn(createScopedDb(state, companyId))),
    writeIn: (companyId, fn) => writeAll((draft) => fn(createScopedDb(draft, companyId))),

    readAll: (fn) => structuredClone(fn(state)),
    writeAll,

    reset() {
      const fresh = createSeedData()
      const session = state.session
      const user: StoredUser | undefined = session ? fresh.users.find((u) => u.id === session.userId) : undefined
      fresh.session = session && user ? session : null
      state = fresh
      save()
      changed()
    },

    reload() {
      state = load()
      changed()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
