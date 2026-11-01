// The check that the hand-written services layer agrees with the API contract (#34). It has no runtime code and nothing
// imports it, but it is under `src`, so `npm run typecheck` compiles it: when contracts/openapi.yaml and types.ts or
// contracts.ts disagree, the `Same` of that line isn't `true` and the build fails there. The mock implements `Services`,
// so it is compiled against the same types. To fix a failure: change the yaml, run `npm run gen:api`, then types.ts.
//
// `Same` is stricter than plain assignability: optional fields never stop one type being assignable to another, so it
// compares the field names too. A renamed optional field fails, and so does a field added on one side.
//
// The only differences allowed are `WidenStatus` and `HandDocument`, below. Everything else has to match.

import type { components, operations } from './api-types'
import type { Services } from './contracts'
import type { API_ERROR_CODES, ApiErrorCode, ApiFieldErrors } from './errors'
import type * as T from './types'

type S = components['schemas']

type AllKeys<V> = V extends unknown ? keyof V : never
type Assignable<From, To> = [From] extends [To] ? true : false
type Same<Hand, Wire> =
  Assignable<Hand, Wire> extends true
    ? Assignable<Wire, Hand> extends true
      ? Assignable<AllKeys<Hand>, AllKeys<Wire>> extends true
        ? Assignable<AllKeys<Wire>, AllKeys<Hand>>
        : false
      : false
    : false
type Ok<_Check extends true> = true

// ---------------------------------------------------------------- what types.ts has and the wire doesn't

/**
 * Screens and the mock handle `declined` and `cancelled` because the schema allows them later (docs/spec.md, D5), but no
 * MVP operation leads to them, so the contract's `DocumentStatus` leaves them out.
 */
type WidenStatus<V> = V extends readonly (infer Item)[]
  ? WidenStatus<Item>[]
  : V extends object
    ? { [K in keyof V]: K extends 'status' ? V[K] | 'declined' | 'cancelled' : WidenStatus<V[K]> }
    : V

/** `cancelledAt` stays in the mock store and the test fixtures; the wire doesn't have it (no MVP operation sets it). */
type HandDocument = Omit<T.Document, 'cancelledAt'>

// ---------------------------------------------------------------- operations of the contract

type Json<K extends keyof operations, Status extends keyof operations[K]['responses']> = operations[K]['responses'][Status] extends {
  content: { 'application/json': infer Body }
}
  ? Body
  : never
type Body<K extends keyof operations> = operations[K] extends { requestBody: { content: { 'application/json': infer Input } } } ? Input : never
type Query<K extends keyof operations> = operations[K] extends { parameters: { query?: infer Params } } ? NonNullable<Params> : never

type Result<M extends (...args: never[]) => unknown> = Awaited<ReturnType<M>>
type Arg<M extends (...args: never[]) => unknown, I extends number> = NonNullable<Parameters<M>[I]>

type Auth = Services['auth']
type Company = Services['company']
type Clients = Services['clients']
type Articles = Services['articles']
type Documents = Services['documents']
type Payments = Services['payments']
type Dashboard = Services['dashboard']
type Public = Services['public']

/** A document a service method returns, as `HandDocument`. */
type DocumentOf<M extends (...args: never[]) => unknown> = Omit<Result<M>, 'cancelledAt'>

// ---------------------------------------------------------------- the checks

/** The error format and the eleven codes (errors.ts, and backend/app/errors.py). */
export type ErrorChecks = [
  Ok<Same<ApiErrorCode, S['ApiErrorCode']>>,
  Ok<Same<(typeof API_ERROR_CODES)[number], S['ApiErrorCode']>>,
  // Assignable both ways, not `Same`: `keyof` of a Record and of an index signature differ only in `number`.
  Ok<Assignable<ApiFieldErrors, S['ErrorBody']['fields']>>,
  Ok<Assignable<S['ErrorBody']['fields'], ApiFieldErrors>>,
]

/** Every schema, field by field: types.ts against the generated components. */
export type SchemaChecks = [
  Ok<Same<T.Locale, S['Locale']>>,
  Ok<Same<T.User, S['User']>>,
  Ok<Same<T.RegisterInput, S['RegisterInput']>>,
  Ok<Same<T.LoginInput, S['LoginInput']>>,
  Ok<Same<T.AuthSession, S['AuthSession']>>,
  Ok<Same<T.Me, S['Me']>>,
  Ok<Same<T.LegalForm, S['LegalForm']>>,
  Ok<Same<T.Currency, S['Currency']>>,
  Ok<Same<T.CompanyInput, S['CompanyInput']>>,
  Ok<Same<Partial<T.CompanyInput>, S['CompanyPatch']>>,
  Ok<Same<T.Company, S['Company']>>,
  Ok<Same<T.ClientKind, S['ClientKind']>>,
  Ok<Same<T.ClientInput, S['ClientInput']>>,
  Ok<Same<Partial<T.ClientInput>, S['ClientPatch']>>,
  Ok<Same<T.Client, S['Client']>>,
  Ok<Same<T.ClientDetail, WidenStatus<S['ClientDetail']>>>,
  Ok<Same<T.Page<T.Client>, S['ClientPage']>>,
  Ok<Same<T.ArticleKind, S['ArticleKind']>>,
  Ok<Same<T.ArticleInput, S['ArticleInput']>>,
  Ok<Same<Partial<T.ArticleInput>, S['ArticlePatch']>>,
  Ok<Same<T.Article, S['Article']>>,
  Ok<Same<T.Page<T.Article>, S['ArticlePage']>>,
  Ok<Same<T.DocumentType, S['DocumentType']>>,
  Ok<Same<T.DocumentStatus, S['DocumentStatus'] | 'declined' | 'cancelled'>>,
  Ok<Same<T.PaymentState, S['PaymentState']>>,
  Ok<Same<T.InvoiceBasis, S['InvoiceBasis']>>,
  Ok<Same<T.PaymentSummary, S['PaymentSummary']>>,
  Ok<Same<T.ClientSnapshot, S['ClientSnapshot']>>,
  Ok<Same<T.CompanySnapshot, S['CompanySnapshot']>>,
  Ok<Same<T.DocumentLineInput, S['DocumentLineInput']>>,
  Ok<Same<T.DocumentLine, S['DocumentLine']>>,
  Ok<Same<T.DocumentSummary, WidenStatus<S['DocumentSummary']>>>,
  Ok<Same<T.SignatureMethod, S['SignatureMethod']>>,
  Ok<Same<T.SignatureSummary, S['SignatureSummary']>>,
  Ok<Same<HandDocument, WidenStatus<S['Document']>>>,
  Ok<Same<T.Page<T.DocumentSummary>, WidenStatus<S['DocumentSummaryPage']>>>,
  Ok<Same<T.DocumentInput, S['DocumentInput']>>,
  Ok<Same<T.DocumentUpdateInput, S['DocumentUpdateInput']>>,
  Ok<Same<T.ConvertInput, S['ConvertInput']>>,
  Ok<Same<T.PaymentMethod, S['PaymentMethod']>>,
  Ok<Same<T.PaymentInput, S['PaymentInput']>>,
  Ok<Same<T.Payment, S['Payment']>>,
  Ok<Same<T.Page<T.Payment>, S['PaymentPage']>>,
  Ok<Same<T.PaymentResult, S['PaymentResult']>>,
  Ok<Same<T.CountAndTotal, S['CountAndTotal']>>,
  Ok<Same<T.CountAndBalance, S['CountAndBalance']>>,
  Ok<Same<T.DocumentEventType, S['DocumentEventType']>>,
  Ok<Same<T.DocumentEvent, S['DocumentEvent']>>,
  Ok<Same<T.DashboardEvent, S['DashboardEvent']>>,
  Ok<Same<T.Dashboard, WidenStatus<S['Dashboard']>>>,
  Ok<Same<T.PublicDocument, WidenStatus<S['PublicDocument']>>>,
  Ok<Same<T.PublicSignInput, S['PublicSignInput']>>,
]

/** Every services method against the operation it maps to: what it sends and what it gets back. */
export type MethodChecks = [
  // auth (`auth.logout` has no operation: it forgets the token)
  Ok<Same<Arg<Auth['register'], 0>, Body<'authRegister'>>>,
  Ok<Same<Result<Auth['register']>, Json<'authRegister', 201>>>,
  Ok<Same<Arg<Auth['login'], 0>, Body<'authLogin'>>>,
  Ok<Same<Result<Auth['login']>, Json<'authLogin', 200>>>,
  Ok<Same<Result<Auth['me']>, Json<'authMe', 200>>>,
  // company
  Ok<Same<Arg<Company['create'], 0>, Body<'companyCreate'>>>,
  Ok<Same<Result<Company['create']>, Json<'companyCreate', 201>>>,
  Ok<Same<Result<Company['get']>, Json<'companyGet', 200>>>,
  Ok<Same<Arg<Company['update'], 0>, Body<'companyUpdate'>>>,
  Ok<Same<Result<Company['update']>, Json<'companyUpdate', 200>>>,
  // clients
  Ok<Same<Arg<Clients['list'], 0>, Query<'clientsList'>>>,
  Ok<Same<Result<Clients['list']>, Json<'clientsList', 200>>>,
  Ok<Same<Result<Clients['get']>, WidenStatus<Json<'clientsGet', 200>>>>,
  Ok<Same<Arg<Clients['create'], 0>, Body<'clientsCreate'>>>,
  Ok<Same<Result<Clients['create']>, Json<'clientsCreate', 201>>>,
  Ok<Same<Arg<Clients['update'], 1>, Body<'clientsUpdate'>>>,
  Ok<Same<Result<Clients['update']>, Json<'clientsUpdate', 200>>>,
  // articles
  Ok<Same<Arg<Articles['list'], 0>, Query<'articlesList'>>>,
  Ok<Same<Result<Articles['list']>, Json<'articlesList', 200>>>,
  Ok<Same<Arg<Articles['create'], 0>, Body<'articlesCreate'>>>,
  Ok<Same<Result<Articles['create']>, Json<'articlesCreate', 201>>>,
  Ok<Same<Arg<Articles['update'], 1>, Body<'articlesUpdate'>>>,
  Ok<Same<Result<Articles['update']>, Json<'articlesUpdate', 200>>>,
  // documents
  Ok<Same<Arg<Documents['list'], 0>, WidenStatus<Query<'documentsList'>>>>,
  Ok<Same<Result<Documents['list']>, WidenStatus<Json<'documentsList', 200>>>>,
  Ok<Same<DocumentOf<Documents['get']>, WidenStatus<Json<'documentsGet', 200>>>>,
  Ok<Same<Arg<Documents['create'], 0>, Body<'documentsCreate'>>>,
  Ok<Same<DocumentOf<Documents['create']>, WidenStatus<Json<'documentsCreate', 201>>>>,
  Ok<Same<DocumentOf<Documents['create']>, WidenStatus<Json<'documentsCreate', 200>>>>,
  Ok<Same<Arg<Documents['update'], 1>, Body<'documentsUpdate'>>>,
  Ok<Same<DocumentOf<Documents['update']>, WidenStatus<Json<'documentsUpdate', 200>>>>,
  Ok<Same<DocumentOf<Documents['issue']>, WidenStatus<Json<'documentsIssue', 200>>>>,
  Ok<Same<Arg<Documents['convert'], 1>, Body<'documentsConvert'>>>,
  Ok<Same<DocumentOf<Documents['convert']>, WidenStatus<Json<'documentsConvert', 201>>>>,
  Ok<Same<DocumentOf<Documents['convert']>, WidenStatus<Json<'documentsConvert', 200>>>>,
  // payments (`payments.list` returns the `items` of the page)
  Ok<Same<Result<Payments['list']>, Json<'paymentsList', 200>['items']>>,
  Ok<Same<Arg<Payments['create'], 1>, Body<'paymentsCreate'>>>,
  Ok<Same<Result<Payments['create']>, Json<'paymentsCreate', 201>>>,
  Ok<Same<Result<Payments['create']>, Json<'paymentsCreate', 200>>>,
  // dashboard
  Ok<Same<Arg<Dashboard['get'], 0>, Query<'dashboardGet'>>>,
  Ok<Same<Result<Dashboard['get']>, WidenStatus<Json<'dashboardGet', 200>>>>,
  // public
  Ok<Same<Result<Public['get']>, WidenStatus<Json<'publicGet', 200>>>>,
  Ok<Same<Arg<Public['sign'], 1>, Body<'publicSign'>>>,
  Ok<Same<Result<Public['sign']>, WidenStatus<Json<'publicSign', 200>>>>,
]
