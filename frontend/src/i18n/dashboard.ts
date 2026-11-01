// Strings of the dashboard (#32, S04): the four tiles of the month and the signed quotes that wait for an invoice.
// The "Нужно сделать" rows, recent events, the period picker and the first-run checklist are post-MVP polish.
export const dashboardRu = {
  'db.loading': 'Загружаем главную…',
  'db.error.title': 'Не удалось загрузить главную',
  'db.error.periodReversed': 'Конец периода раньше начала',
  'db.period': '{month} {year}',
  'db.tile.received': 'Получено',
  'db.tile.waiting': 'Ждём оплаты',
  'db.tile.waiting.overdue': 'из них просрочено',
  'db.tile.invoiced': 'Выставлено счетов',
  'db.tile.quotes': 'КП подписано',
  'db.tile.quotes.value': '{signed} из {total}',
  'db.nothing.title': 'За {month} пока ничего',
  'db.nothing.text': 'Создайте КП и отправьте клиенту ссылку: суммы появятся здесь.',
  'db.nothing.action': 'Создать КП',
  'db.toInvoice.title': 'Подписано — выставьте счёт',
  'db.toInvoice.action': 'Счёт',
  'db.toInvoice.rowAction': 'выставить счёт',
} as const
