// Strings of the screen that makes an invoice from a signed quote (S14, #27). The wording of the invoice itself
// (its line titles, the refusal when it would pass the quote total) is in invoices.ts, next to the mock that makes it.
export const convertRu = {
  'cv.loading': 'Открываем КП…',
  'cv.error.title': 'Не удалось открыть КП',
  'cv.locked.title': 'Счёт можно выставить только по подписанному КП',
  'cv.locked.text': 'Когда клиент подпишет КП, здесь появится выставление счёта.',
  'cv.locked.back': 'К КП',

  'cv.quote': 'КП {number}',
  'cv.total': 'Сумма КП',
  'cv.invoiced': 'Уже выставлено',
  'cv.available': 'Можно выставить ещё',
  'cv.what': 'Что выставить',

  'cv.basis.full': 'Полная сумма',
  'cv.basis.full.hint': 'Все позиции КП: {amount}',
  'cv.basis.remaining': 'Остаток',
  'cv.basis.remaining.hint': 'Всё, что ещё не выставлено: {amount}',
  'cv.basis.percent': 'Предоплата в процентах',
  'cv.basis.percent.hint': 'Доля от суммы КП',
  'cv.basis.amount': 'Предоплата суммой',
  'cv.basis.amount.hint': 'Сколько клиент платит вперёд',

  'cv.percent.label': 'Процент от суммы КП',
  'cv.percent.suffix': '%',
  'cv.amount.label': 'Сумма предоплаты',
  'cv.preview': 'Счёт на {amount}',
  'cv.error.percent': 'Введите процент больше 0 и не больше 100, например 50 или 12,5',
  'cv.error.amount': 'Введите сумму больше нуля',

  'cv.confirm': 'Выставить счёт',
  'cv.confirming': 'Выставляем…',
  'cv.failed': 'Не удалось выставить счёт',

  'cv.done': 'Счёт {number} на {amount} выставлен',
  'cv.open': 'Открыть счёт',
  'cv.back': 'К КП',
  'cv.allDone': 'По этому КП счета выставлены на всю сумму.',
} as const
