// Strings of the development tools panel (src/dev). They are kept apart from ru.ts and t.ts merges them in
// only when `import.meta.env.DEV` is true, so none of them reaches `npm run build` (#14 AC 5).
export const devRu = {
  'dev.open': 'Инструменты разработчика',
  'dev.title': 'Инструменты разработчика',
  'dev.lead': 'Видны только при npm run dev. Эти кнопки управляют имитацией сервера в браузере.',

  'dev.errors.title': 'Вызвать ошибку API',
  'dev.errors.lead': 'Нажмите на код: следующий вызов сервиса получит эту ошибку, потом всё работает как обычно.',
  'dev.errors.queued': 'в очереди: {n}',
  'dev.errors.clear': 'Снять все ошибки',
  'dev.errors.empty': 'Очередь ошибок пуста.',

  'dev.data.title': 'Данные',
  'dev.data.reset': 'Сбросить данные',
  'dev.data.resetHint': 'Вернёт данные из seed.json и обновит страницу.',
  'dev.data.persistent': 'Сохраняются в localStorage, ключ docura.mock.v1.',
  'dev.data.memoryOnly': 'localStorage недоступен: данные живут только до перезагрузки.',
  'dev.data.signedOut': 'Вход не выполнен.',
  'dev.data.signedIn': 'Вход: {email}',
  'dev.data.noCompany': 'Компании у этого аккаунта ещё нет.',
  'dev.data.company': 'Компания: {name}',
  'dev.data.counts': 'Видно клиентов: {clients}, работ в каталоге: {articles}, документов: {documents}, оплат: {payments}.',

  'dev.logins.title': 'Тестовые входы',
  'dev.logins.lead': 'Пароль у обоих один.',
  'dev.logins.password': 'Пароль: {password}',
} as const
