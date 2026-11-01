// Strings of recording and removing a payment (#30): the sheet "Оплата по СЧ-…" (S16), the menu of an invoice row (S15),
// the undo toast, and the refusals the mock service raises (the backend sends the same texts).
export const paymentsRu = {
  // The sheet.
  'pm.title': 'Оплата по {number}',
  'pm.sub.left': 'Остаток',
  'pm.sub.of': 'из',
  'pm.amount.label': 'Сумма',
  'pm.method.label': 'Способ',
  'pm.date.label': 'Дата',
  'pm.note.label': 'Комментарий',
  'pm.submit': 'Записать',
  'pm.submit.amount': 'Записать {amount}',
  'pm.submitting': 'Записываем…',
  'pm.failed': 'Не удалось записать оплату',

  // The refusals: under the field they belong to (components.md, "Record payment sheet").
  'pm.error.amountRequired': 'Укажите сумму',
  'pm.error.amountFormat': 'Введите сумму цифрами, например 64 786',
  'pm.error.overpayment': 'Больше остатка на {amount}. Проверьте сумму.',
  'pm.error.date': 'Укажите существующую дату.',
  'pm.error.method': 'Выберите способ оплаты.',
  'pm.error.noteTooLong': 'Комментарий не длиннее 500 символов.',
  'pm.error.invoiceOnly': 'Оплату можно записать только по выставленному счёту.',

  // The card (S16).
  'pm.action.record': 'Записать оплату',
  'pm.remove.aria': 'Удалить оплату {amount} от {date}',
  'pm.remove.title': 'Удалить оплату?',
  'pm.remove.text': 'Оплата {amount} от {date} пропадёт из списка, а остаток по счёту вырастет.',
  'pm.remove.confirm': 'Удалить',
  'pm.remove.keep': 'Не удалять',
  'pm.remove.removing': 'Удаляем…',
  'pm.remove.failed': 'Не удалось удалить оплату',

  // The menu of a row (S15), the same actions as the swipe.
  'pm.menu.aria': 'Действия со счётом {number}',
  'pm.menu.title': 'Счёт {number}',
  'pm.menu.record': 'Записать оплату',
  'pm.menu.record.hint': 'Остаток {amount}',
  'pm.menu.open': 'Открыть счёт',
  'pm.menu.open.hint': 'Оплаты, документ и отправка',

  // The toast.
  'pm.toast.recorded': 'Оплата записана',
  'pm.toast.undo': 'Отменить',
  'pm.toast.undone': 'Оплата отменена',
  'pm.toast.undoFailed': 'Не удалось отменить оплату',
  'pm.toast.removed': 'Оплата удалена',
} as const
