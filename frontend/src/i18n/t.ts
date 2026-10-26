import { ru, type MessageKey } from './ru'

export type { MessageKey }

type Params = Record<string, string | number>

// t('placeholder.comesIn', { issues: '#22' }) → "Экран появится в задаче #22".
// A placeholder without a value stays as written, so a missing param is visible instead of silently empty.
export function t(key: MessageKey, params?: Params): string {
  const template: string = ru[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

const issueList = new Intl.ListFormat('ru', { style: 'long', type: 'conjunction' })

// [28, 30] → "#28 и #30"
export function formatIssues(issues: readonly number[]): string {
  return issueList.format(issues.map((n) => `#${n}`))
}
