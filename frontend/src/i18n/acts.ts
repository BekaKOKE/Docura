// Strings of the completion act (АВР, #31): the sheet laid out after form Р-1 (src/documents/ActDoc), the acts list,
// the act's card (S18) and the messages of the mock `documents.convert`/`update`/`issue` for an act. The wording is
// written fresh for Docura (docs/spec.md §5); the column names follow form Р-1 (docs/kz-rules.md, row 5).
//
// Wording rule (docs/spec.md §7): a signature on screen is only ever "Подпись на экране". The client signing the
// act on screen is post-MVP (D5): in the MVP both sides sign the printed sheet.
export const actsRu = {
  // The sheet (Р-1).
  'act.doc.title': 'Акт выполненных работ (оказанных услуг)',
  'act.doc.contract': 'Договор (контракт)',
  'act.doc.period': 'Отчётный период',
  'act.doc.periodRange': 'с {from} по {to}',
  'act.doc.col.n': '№',
  'act.doc.col.title': 'Наименование работ (услуг)',
  'act.doc.col.date': 'Дата выполнения',
  'act.doc.col.report': 'Сведения об отчёте (при наличии)',
  'act.doc.col.unit': 'Ед. изм.',
  'act.doc.col.qty': 'Кол-во',
  'act.doc.col.price': 'Цена за единицу',
  'act.doc.col.sum': 'Стоимость',
  'act.doc.handedOver': 'Сдал (Исполнитель)',
  'act.doc.accepted': 'Принял (Заказчик)',
  'act.doc.position': 'должность',
  'act.doc.signature': 'подпись',
  'act.doc.fullName': 'расшифровка',
  'act.doc.stamp': 'М.П.',
  'act.doc.stocks': 'Сведения об использовании запасов, полученных от заказчика',
  'act.doc.attachments': 'Приложение (перечень документации)',
  'act.doc.signedOn': 'Дата подписания (принятия) работ',

  // The acts list (Документы › Акты).
  'act.list.loading': 'Загружаем акты…',
  'act.list.error.title': 'Не удалось загрузить акты',
  'act.list.empty.title': 'Актов пока нет',
  'act.list.empty.text': 'Акт создаётся из подписанного КП в одно касание.',
  'act.list.empty.action': 'К коммерческим предложениям',
  'act.list.more': 'Показать ещё',

  // The card (S18).
  'act.card.period': 'Период {from} — {to}',
  'act.card.openDocument': 'Открыть документ',
  'act.card.printHint': 'Акт подписывают на бумаге: откройте документ и нажмите «Скачать PDF».',
  'act.card.action.quote': 'К КП',
  'act.card.action.send': 'Отправить',
  'act.card.action.save': 'Сохранить',
  'act.card.action.saving': 'Сохраняем…',
  'act.card.action.issue': 'Выставить',
  'act.card.action.issuing': 'Выставляем…',
  'act.card.saved': 'Изменения сохранены',
  'act.card.failed': 'Не удалось сохранить акт',
  'act.card.issueFailed': 'Не удалось выставить акт',

  // The draft's form.
  'act.form.title': 'Данные акта',
  'act.form.contractRef': 'Договор или основание',
  'act.form.contractRef.hint': 'Например: Договор № 15 от 01.10.2026',
  'act.form.periodFrom': 'Отчётный период с',
  'act.form.periodTo': 'Отчётный период по',
  'act.form.lines': 'Даты выполнения работ',
  'act.form.workDate': 'Дата выполнения',

  // Creating the act from a signed quote (/acts/new).
  'act.new.creating': 'Создаём акт…',
  'act.new.noQuote': 'Не указано, по какому КП создать акт.',
  'act.new.locked.title': 'Акт можно создать только по подписанному КП',
  'act.new.locked.text': 'Когда клиент подпишет КП, здесь появится создание акта.',
  'act.new.locked.back': 'К КП',

  // Share message (the share sheet of the card).
  'act.share.body': 'Отправляю акт выполненных работ на сумму {amount}: {link}',

  // Contract reference of a new act, {date} is dd.mm.yyyy.
  'act.contractRef': 'КП № {number} от {date}',

  // Messages of the mock services.
  'act.error.exists': 'По этому КП уже есть акт. Откройте его.',
  'act.error.typeNotAct': 'Здесь редактируется только акт.',
  'act.error.clientLocked': 'Клиента акта менять нельзя.',
  'act.error.periodOrder': 'Конец периода не может быть раньше начала.',
  'act.error.periodRequired': 'Укажите отчётный период.',
  'act.error.contractRefTooLong': 'Не длиннее 200 символов.',
  'act.error.linesFixed': 'Позиции акта берутся из КП, их нельзя добавить или убрать.',
  'act.error.workDateRequired': 'Укажите дату выполнения.',
} as const
