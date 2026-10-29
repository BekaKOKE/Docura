// Strings of converting a signed quote into an invoice (#27): the titles of the invoice lines, the contract
// reference and the messages of the mock `documents.convert`. The wording is written fresh for Docura (docs/spec.md §5).
export const invoicesRu = {
  // The one line of a prepayment invoice; {percent} is "50" or "12,5", {date} is dd.mm.yyyy.
  'invoice.line.percent': 'Предоплата {percent}% по КП № {number} от {date}',
  'invoice.line.amount': 'Предоплата по КП № {number} от {date}',
  'invoice.line.remaining': 'Остаток по КП № {number} от {date}',
  'invoice.line.unit': 'услуга',
  'invoice.contractRef': 'КП № {number} от {date}',

  // exceeds_quote_total (409): {amount} is what can still be invoiced, formatted as money.
  'invoice.error.exceedsQuoteTotal': 'Сумма счетов не может быть больше суммы КП. Можно выставить ещё: {amount}',

  // Field messages (validation_error).
  'invoice.error.basisInvalid': 'Выберите, на какую сумму выставить счёт.',
  'invoice.error.percentInvalid': 'Укажите процент от 0,01 до 100.',
  'invoice.error.amountInvalid': 'Укажите сумму больше нуля.',
} as const
