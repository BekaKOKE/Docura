// Strings of the document renderers (КП, счёт: src/documents) and of the preview screen S08 (#21).
// Kept in their own file and spread into ru.ts, so the dictionary of one issue stays in one place.
//
// Wording rule (docs/spec.md §7): the client's signature is only ever "Подпись на экране".
export const documentsRu = {
  'doc.quote.title': 'Коммерческое предложение',
  'doc.invoice.title': 'Счёт на оплату',
  'doc.numberSign': '№',
  'doc.draft': 'черновик',
  'doc.from': 'от',
  'doc.validUntil': 'Действует до',
  'doc.dueDate': 'Оплатить до',
  'doc.basis': 'Основание',
  'doc.tengeWord': 'тенге',

  'doc.party.executor': 'Исполнитель',
  'doc.party.customer': 'Заказчик',
  'doc.party.supplier': 'Поставщик',
  'doc.party.buyer': 'Покупатель',
  'doc.id.iin': 'ИИН',
  'doc.id.bin': 'БИН',
  'doc.id.binIin': 'БИН/ИИН',
  'doc.phone': 'Тел.',
  'doc.email': 'Эл. почта',
  'doc.vatCertificate': 'Свидетельство НДС',

  'doc.pay.title': 'Банковские реквизиты',
  'doc.pay.beneficiary': 'Бенефициар',
  'doc.pay.bank': 'Банк бенефициара',
  'doc.pay.iik': 'ИИК',
  'doc.pay.bik': 'БИК',
  'doc.pay.kbe': 'Кбе',
  'doc.pay.knp': 'КНП',

  'doc.table.label': 'Позиции',
  'doc.col.n': '№',
  'doc.col.title': 'Наименование',
  'doc.col.qty': 'Кол-во',
  'doc.col.unit': 'Ед.',
  'doc.col.price': 'Цена',
  'doc.col.sum': 'Сумма',

  'doc.total.net': 'Без НДС',
  'doc.total.vat': 'НДС {rate} %',
  'doc.total.vatLabel': 'НДС',
  'doc.total.noVat': 'Без НДС',
  'doc.total.gross': 'Итого',
  'doc.itemsTotal': 'Всего наименований {n}, на сумму',
  'doc.inWords': 'Сумма прописью',

  'doc.notes': 'Примечание',
  'doc.terms': 'Условия',

  'doc.sign.executor': 'Исполнитель',
  'doc.sign.line': 'подпись',
  'doc.sign.onScreen': 'Подпись на экране',
  'doc.sign.signed': 'Подписано на экране {when}',
  'doc.sign.at': '{date} в {time}',
  'doc.sign.imageAlt': 'Подпись на экране: {name}',

  // S08, the preview screen.
  'preview.loading': 'Открываем документ…',
  'preview.error.title': 'Не удалось открыть документ',
  'preview.error.generic': 'Что-то пошло не так. Попробуйте ещё раз.',
  'preview.retry': 'Повторить',
  'preview.login': 'Войти',
  'preview.print': 'Скачать PDF',
  'preview.zoomIn': 'Крупнее',
  'preview.zoomOut': 'Вписать в экран',
  'preview.page': 'Документ на листе А4',
  'preview.pane': 'Живой предпросмотр документа',
  'preview.actPending': 'Предпросмотр акта появится в задаче #31.',
} as const
