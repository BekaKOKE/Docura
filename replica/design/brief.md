# Docura: design brief (paste into Claude Design, v0 or Lovable)

Build the frontend screens for **Docura**, a mobile-first web app (PWA) for tradespeople in Kazakhstan: plumbers, electricians, finishers, repair crews. They make a quote (КП) on their phone at the client's place, the client signs it with a finger, and the quote becomes an invoice (счёт на оплату) and an act of completed works (акт выполненных работ). Payments are tracked by hand. **The UI is in Russian, money is in tenge (₸).**

**Tech.** React + TypeScript. **Every data call goes through one services layer** (`src/services`): an interface plus a **mock implementation** with realistic seed data and 150–400 ms latency. Components never call `fetch` directly. Money comes from services as integer tiyn (1 ₸ = 100 tiyn) and is formatted with `Intl.NumberFormat('ru-KZ', {style:'currency', currency:'KZT'})`. All strings go through a `t()` function (Russian now, Kazakh later).

**Look: "site notebook", not SaaS.** A warm paper background, ink text, one signal-saffron action colour that stays readable in sunlight, flat cards with 1px borders, document-like ruled lists, tabular numbers.
- **No** purple or blue gradients, glassmorphism or default shadcn styling (zinc palette, default radius, shadows). If you use shadcn/Radix primitives, restyle them completely with the tokens below. No stock illustrations or emoji.
- Use only these colours:
  - bg #F5F3EE · surface #FFFFFF · surface-sunken #ECE9E2 · border #DDD8CE · border-input #8B857A
  - text #1C1B18 · text-muted #5E5A52
  - accent #F2B705 with **ink text #1C1B18 on it** (never white) · accent-text #7A4F00 for links · accent-tint #FCEFC7
  - ink #1C1B18 / on-ink #F5F3EE for the dark totals bar and toasts
  - focus ring #1F5FAD 3px
  - statuses, text on tint: info #1F5FAD/#E3ECF8 · success #1C6E46/#DFF0E6 · warning #8A5300/#FBEBCB · danger #B3261E/#F9E1DE
- Saffron is never the only sign of state: switches, checkboxes, progress bars and selected states use ink #1C1B18.
- Radius 4/8/12. Spacing on a 4 px grid. Shadows only on floating things: bottom bars, sheets, toasts.

**Fonts.**
- **Onest** for everything, with `font-variant-numeric: tabular-nums` for amounts. **IBM Plex Mono** only for identifiers (КП-2026-0012, БИН, ИИК).
- Load the Google Fonts subsets **cyrillic, cyrillic-ext and latin-ext**: the ₸ sign (U+20B8) lives in latin-ext and the Kazakh letters (ә ғ қ ң ө ұ ү һ і) in cyrillic-ext.
- Inputs are at least 16 px.

**Russian text rules.**
- Button labels wrap onto two lines at word boundaries. Never truncate, hyphenate or shrink them.
- At most 2 buttons side by side on a phone; a third action goes into an "Ещё" sheet.
- Use `minmax(0,1fr)` grids and `min-width:0` flex children, so one long word ("Зарегистрироваться") can't widen the layout.
- Amounts and document numbers never wrap (`white-space: nowrap`).
- Use correct plurals (`Intl.PluralRules('ru')`), the letter ё, and «ёлочки» quotes.

**Layout.**
- **Phone (360–430 px), first:** bottom tab bar Главная · Документы · [+] · Клиенты · Ещё. The [+] is a 56 px saffron square. A sticky bottom action bar holds the main actions at 56 px (thumb zone). Touch targets are at least 48 px.
- **Desktop (≥1024 px):** a 248 px left sidebar, content up to 1120 px. The quote editor shows the form next to a live A4 preview.

**Screens to build:**

1. **Quote editor (Новое КП).** Sections, top to bottom:
   - Клиент: a picker sheet with search and quick-create.
   - Работы и материалы: line cards (title, "12,5 м² × 18 500 ₸", total) that expand to edit. Quantity is a stepper that accepts a comma, plus a unit chip. Price is a money input. Lines can be added from the catalogue or by hand, and reordered with ↑↓.
   - Условия: a validity segmented control and a switch "НДС 16 %".
   - A sticky dark totals bar ("Итого 323 930 ₸").
   - An action bar: [Отправить] (secondary) and [Подписать сейчас] (primary).
   - Show autosave status. States: empty, sent, signed (read-only, with "Выставить счёт" / "Создать акт").
   - "Отправить" opens a sheet: WhatsApp / SMS / email / copy link, with an editable message.
2. **Public signing page** (the client, no login, no app navigation).
   - The tradesperson's company first: logo, name, БИН, phone. Then the document title, number, amount and validity, and the lines as readable cards (not a shrunken A4).
   - A full-width [Подписать] opens a sheet: name, a finger signature pad (ink #14213D on white, a "Очистить" button), two required consent checkboxes (acceptance of the amount, and personal data), then [Подписать].
   - States: success, already signed, declined, expired, link revoked, "document changed — review the new version".
   - A hand-over variant for signing on the tradesperson's phone ("Передайте телефон клиенту").
3. **Invoice list (Документы → Счета).**
   - A summary strip ("Ждём 2 316 000 ₸ · просрочено 1 250 000 ₸"), search ("Клиент, номер или сумма"), filter chips (Все, Ждут оплаты, Просрочены, Оплачены, Черновики, Аннулированы).
   - Rows: client · total · number · due date · status badge ("Оплачен на 40%" with a thin progress bar, "Просрочен 7 дн.").
   - A "Записать оплату" sheet: amount pre-filled with the balance, method chips Наличные / Kaspi / Перевод / Карта / Другое, date, and an undo toast.
   - Desktop: a table.
4. **Dashboard (Главная).**
   - First "Нужно сделать": overdue invoices, signed quotes with no invoice yet, quotes waiting for a signature, quotes about to expire.
   - Then KPI tiles: Получено, Ждём оплаты (overdue part in red), Выставлено, КП подписано 5 из 8.
   - Then "Подписано — выставьте счёт" with a [Счёт] button, and recent activity. No charts.
   - First-run state: a 3-step "Начало работы" checklist.

**Every screen needs** loading skeletons, empty states with one clear action, error banners with [Повторить], and visible focus. Use Lucide icons. Every screen must work at 360 px with no horizontal scroll.

**Sample data** for the mocks: ИП Сейткали Б. (БИН 123456789012, Алматы); clients Қайрат Әбілқасымов, ТОО «Алатау Құрылыс Сервис», Ирина Ёлкина; work items "Укладка ламината 18 500 ₸/м²", "Замена смесителя 12 000 ₸/шт", "Штробление стен 2 500 ₸/п.м."; amounts from 38 900 ₸ to 1 250 000 ₸.
