// Strings of the catalogue screen (S24) and of the article rules shared with the mock service (#17).
// Kept in their own file and spread into ru.ts, so the dictionary of one issue stays in one place.
export const catalogRu = {
  'catalog.search.label': 'Поиск по каталогу',
  'catalog.search.placeholder': 'Найти работу или материал',
  'catalog.search.clear': 'Очистить поиск',
  'catalog.filter.label': 'Показать',
  'catalog.filter.service': 'Работы',
  'catalog.filter.material': 'Материалы',
  'catalog.add': 'Добавить в каталог',
  'catalog.more': 'Показать ещё',
  'catalog.found': 'Найдено: {count}',
  'catalog.loading': 'Загружаем каталог…',
  'catalog.empty.title': 'Каталог пока пуст',
  'catalog.empty.text': 'Добавьте работы и материалы с ценами, чтобы собирать КП в два касания.',
  'catalog.noResults.title': 'Ничего не нашли',
  'catalog.noResults.text': 'По запросу «{q}» в каталоге пусто. Проверьте написание или сбросьте поиск.',
  'catalog.noResults.reset': 'Сбросить поиск',
  'catalog.noKind.title': 'Здесь пока пусто',
  'catalog.noKind.text': 'В этом разделе каталога ничего нет. Покажите всё или добавьте позицию.',
  'catalog.noKind.reset': 'Показать всё',
  'catalog.error.title': 'Не удалось загрузить каталог',
  'catalog.retry': 'Повторить',
  'catalog.kind.service': 'Работа',
  'catalog.kind.material': 'Материал',
  'catalog.created': 'Позиция «{title}» добавлена в каталог.',
  'catalog.updated': 'Позиция «{title}» сохранена.',
  'catalog.archived': 'Позиция «{title}» убрана в архив.',
  'catalog.row.open': 'Изменить: {title}',

  'catalogForm.title.new': 'Новая позиция',
  'catalogForm.title.edit': 'Изменить позицию',
  'catalogForm.kind': 'Что это',
  'catalogForm.name': 'Название',
  'catalogForm.unit': 'Единица измерения',
  'catalogForm.price': 'Цена за единицу',
  'catalogForm.price.hint': 'Например 18 500 или 18 500,50',
  'catalogForm.add': 'Добавить',
  'catalogForm.save': 'Сохранить',
  'catalogForm.saving': 'Сохраняем…',
  'catalogForm.cancel': 'Отмена',
  'catalogForm.saveError': 'Не удалось сохранить позицию',
  'catalogForm.archive': 'Убрать в архив',
  'catalogForm.archive.why':
    'Позиции не удаляются, их убирают в архив: из каталога она пропадёт, а в уже составленных документах останется как была.',

  'catalogArchive.title': 'Убрать позицию в архив?',
  'catalogArchive.text':
    '«{title}» пропадёт из каталога и из выбора в КП. Строки в уже составленных документах не изменятся.',
  'catalogArchive.confirm': 'В архив',
  'catalogArchive.cancel': 'Отмена',
  'catalogArchive.error': 'Не удалось убрать позицию',

  // Field errors. The mock service raises the same texts in `fields`, so a screen shows one wording.
  'article.error.titleRequired': 'Укажите название',
  'article.error.titleLong': 'Не больше 300 знаков',
  'article.error.kindInvalid': 'Выберите: работа или материал',
  'article.error.unitInvalid': 'Выберите единицу измерения',
  'article.error.priceRequired': 'Укажите цену',
  'article.error.priceFormat': 'Введите цену цифрами: 18 500 или 18 500,50 (до двух знаков после запятой)',
  'article.error.priceNegative': 'Цена не может быть отрицательной',
} as const

/** The field errors of an article, as dictionary keys. */
export type ArticleErrorKey = Extract<keyof typeof catalogRu, `article.error.${string}`>
