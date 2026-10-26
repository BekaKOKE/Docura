// The one error type both services implementations throw (replica/architecture.md, "Services layer contract").
// The wire format is {"error": {"code", "message", "fields"}}; the http implementation (#52) maps it to ApiError.

/** Every error code the API can return. Exactly this list, in the order of the architecture. */
export const API_ERROR_CODES = [
  'validation_error',
  'unauthorized',
  'not_found',
  'version_conflict',
  'document_locked',
  'exceeds_quote_total',
  'overpayment',
  'already_signed',
  'link_expired',
  'link_revoked',
  'rate_limited',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** Per-field messages for `validation_error`, keyed by the camelCase field name (`lines.0.qtyMilli` for nested ones). */
export type ApiFieldErrors = Record<string, string>

/** The HTTP status each code travels with (replica/architecture.md, "API"). The mock uses it so it matches the backend. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 422,
  unauthorized: 401,
  not_found: 404,
  version_conflict: 409,
  document_locked: 409,
  exceeds_quote_total: 409,
  overpayment: 409,
  already_signed: 409,
  link_expired: 410,
  link_revoked: 410,
  rate_limited: 429,
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value)
}

export interface ApiErrorInit {
  /** HTTP status. Defaults to the usual one for the code. */
  status?: number
  code: ApiErrorCode
  message: string
  fields?: ApiFieldErrors
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fields?: ApiFieldErrors

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status ?? API_ERROR_STATUS[init.code]
    this.fields = init.fields
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
