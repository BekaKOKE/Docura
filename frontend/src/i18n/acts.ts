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
  'act.doc.col.n': 'Номер по порядку',
  'act.doc.col.title': 'Наименование работ (услуг) (в разрезе их подвидов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)',
  'act.doc.col.date': 'Дата выполнения работ (оказания услуг)**',
  'act.doc.col.report': 'Сведения об отчете о научных исследованиях, маркетинговых, консультационных и прочих услугах (дата, номер, количество страниц) (при их наличии)***',
  'act.doc.col.unit': 'Единица измерения',
  'act.doc.col.done': 'Выполнено работ (оказано услуг)',
  'act.doc.col.qty': 'количество',
  'act.doc.col.price': 'цена за единицу',
  'act.doc.col.sum': 'стоимость',
  'act.doc.handedOver': 'Сдал (Исполнитель)',
  'act.doc.accepted': 'Принял (Заказчик)',
  'act.doc.position': 'должность',
  'act.doc.signature': 'подпись',
  'act.doc.fullName': 'расшифровка подписи',
  'act.doc.stamp': 'М.П.',
  'act.doc.stocks': 'Сведения об использовании запасов, полученных от заказчика (наименование, количество, стоимость)',
  'act.doc.attachments': 'Приложение: Перечень документации, в том числе отчет(ы) о маркетинговых, научных исследованиях, консультационных и прочих услугах (обязательны при его (их) наличии) на',
  'act.doc.attachments.pages': 'страниц',
  'act.doc.note1': '*Применяется для приемки-передачи выполненных работ (оказанных услуг), за исключением строительно-монтажных работ.',
  'act.doc.note2': '**Заполняется в случае, если даты выполненных работ (оказанных услуг) приходятся на различные периоды, а также в случае, если даты выполнения работ (оказания услуг) и даты подписания (принятия) работ (услуг) различны.',
  'act.doc.note3': '***Заполняется в случае наличия отчета о научных исследованиях, маркетинговых, консультационных и прочих услугах.',
  'act.doc.signedOn': 'Дата подписания (принятия) работ (услуг)',

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
