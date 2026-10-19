# Docura components v1

Specs for the design agent and for whoever builds the frontend. Colours, sizes and type are **token roles** from `tokens.json`
(`accent`, `text-muted`, `control-lg`…), never hex. Screen and flow IDs (S07, F02…) refer to `replica/recon.md`. Routes and error codes refer to
`replica/architecture.md`.

Everything here is Docura's own. No Khosmos screenshot, colour, icon, copy or layout was seen or used. All Russian copy below is
written fresh.

Files in `replica/design/`:

| file | what |
| --- | --- |
| `tokens.json` | source of truth for colours, type, space, radius, shadow, motion, sizes, layout |
| `build_tokens.py` | regenerates the three files below from `tokens.json` |
| `tokens.css` | CSS custom properties (`--dc-*`) and base rules (`.dc-money`, `.dc-code`, `.dc-label`, focus ring, reduced motion) |
| `tailwind.v4.css`, `tailwind.preset.cjs` | Tailwind mapping, so code says `bg-surface text-muted border-input ring-focus`, never hex |
| `contrast-report.txt` | WCAG check: 37 pairs, 0 AA failures |
| `specimen/specimen.html` + PNGs | proof that fonts, ₸ and long labels render: mobile 360 px and desktop 1280 px |
| `brief.md` | the paste-in brief for Claude Design, v0 or Lovable |

---

## 0. Rules learned from the specimen (they apply to every component)

These came out of the 360 px renders, not from theory:

1. **Long Russian labels wrap; they never break the layout.**
   - A button label wraps onto at most 2 lines, at word boundaries only (`.dc-label`: no hyphenation, no ellipsis, no font shrinking).
   - Every grid uses `minmax(0, 1fr)` and every flex child gets `min-width: 0`. In the first render, one row of three buttons
     ("Перевыставить", "Предоплата", "Выставить счёт") widened the whole column past the screen.
   - **At most 2 buttons side by side on a phone.** A third action goes into "Ещё" (a bottom sheet).
   - A label with a single word over ~12 letters ("Перевыставить", "Зарегистрироваться") is a full-width button.
2. **Money is atomic.**
   - Always format with `Intl.NumberFormat('ru-KZ', {style: 'currency', currency: 'KZT'})`. It outputs U+00A0 between digit groups and before ₸; Onest has that glyph.
   - Wrap amounts in `.dc-money`: no wrapping, tabular figures. Otherwise "1 874 300 ₸" breaks into "1 874 / 300 ₸".
   - Show tiyn only when non-zero in the UI ("1 250 000 ₸"). Documents always show them ("1 250 000,00 ₸").
   - Screen readers: the ₸ is `aria-hidden`, followed by visually hidden "тенге".
3. **Identifiers are atomic.** Document numbers (`КП-2026-0012`), ИИН/БИН and ИИК are set in `font.mono` with `.dc-code`, **one identifier per element**. Otherwise "СЧ-2026- / 0014" breaks at the hyphen, and a whole line set no-wrap scrolls sideways.
4. **Fonts.**
   - Onest (UI, numbers) and IBM Plex Mono (identifiers).
   - Load the `cyrillic`, `cyrillic-ext` (Kazakh letters) and `latin-ext` (₸ U+20B8) subsets. Leaving out `latin-ext` silently swaps ₸ for a system font.
   - Headless Chrome confirmed that the ₸, Kazakh, Ё and № glyphs are drawn by the web fonts.
5. **Saffron is a fill, not a signal.**
   - `accent` buttons always carry an `on-accent` (ink) label.
   - Switches, checkboxes, progress bars and selected indicators use `control-on` (ink), because saffron is 1.8:1 on white.
   - Text links use `accent-text`.
6. **Touch.** Every tap target is at least 48×48. Primary actions are 56 px tall in the bottom action bar, inside the thumb zone. Leave 8 px between adjacent targets.
7. **Sunlight.** Text is always `text` or `text-muted` (6:1 or better), never lighter. No grey-on-grey disabled text: disabled = `surface-sunken` fill + `text-muted` + a reason nearby.

### Layout shell

| | phone (< lg) | desktop (≥ lg 1024) |
| --- | --- | --- |
| navigation | bottom **TabBar** 64 px + safe area: Главная · Документы · **[+]** · Клиенты · Ещё | left **Sidebar** 248 px: Главная, Коммерческие предложения, Счета, Акты, Клиенты, Каталог, Компания |
| create | the centre **[+]**: a 56 px saffron square (radius lg) opening a sheet: КП, Клиент, Работа в каталог | a "Создать КП" primary button at the top of the sidebar |
| page header | **TopBar** 56 px: back, title, one trailing action, overflow "⋯" | 64 px, title left, actions right |
| content | one column, 16 px gutters | max 1120 px; editors split into form + 520 px live preview |
| primary actions | sticky **ActionBar** above the TabBar (or alone on full-screen editors), 56 px buttons, max 2 | in the TopBar or the form footer |

"Документы" on a phone opens one screen with a segmented control: **КП · Счета · Акты**. A deep link opens the right segment.

---

## 1. Primitives

Compact specs, used by the four screens below.

```
Button
  variants  primary (accent fill, on-accent label), secondary (surface, border-input, text),
            ghost (transparent, accent-text), danger (danger fill, on-danger), ink (ink fill, on-ink)
  sizes     sm 40px (desktop tables only), md 48px, lg 56px (ActionBar)
  states    default, hover (accent-hover), pressed (accent-pressed), focus-visible (3px focus ring, 2px offset),
            disabled (surface-sunken + text-muted, reason shown nearby), loading (spinner replaces the icon, label stays)
  layout    icon 20px + label, gap 8. Label is .dc-label: wraps to 2 lines, never truncates
  a11y      real <button>; loading sets aria-busy="true" and keeps the label; icon-only only for secondary actions, with aria-label
  used on   all

IconButton
  48×48 hit area (24px icon). Always has aria-label. Tooltip on desktop hover. Used for back, overflow ⋯, clear, reorder ↑↓

Field (label + control + helper/error)
  label     above, sm/600, text. Required fields are marked by "необязательно" on the optional ones instead of *
  control   48px, surface, 1px border-input, radius md, 16px text (no iOS zoom)
  states    default, focus (border focus 2px + ring), error (border danger, message below in danger with an icon), disabled, read-only (no border, sunken)
  a11y      <label for>, aria-describedby for helper and error, aria-invalid on error. Errors are words, not just red

MoneyInput
  right-aligned, tabular, lg/600. The ₸ suffix is text-muted and not part of the value
  accepts "18500", "18 500", "18500,5", "18500.5"; formats with NBSP on blur; stores integer tiyn
  inputmode="decimal"; max 2 decimals; negative values rejected
  used on   S07, S16 (payment), S24

QuantityInput (stepper)
  [−] 48 | value 72 | [+] 48 with a unit chip after it ("м²" opens the unit sheet)
  accepts comma or dot, up to 3 decimals; − disabled at the step minimum; long-press repeats
  a11y      role=spinbutton semantics via <input type=text inputmode=decimal> + labelled buttons "Меньше" / "Больше"

PickerSheet (replaces <select> on phones)
  bottom sheet, search on top when there are more than 7 options, recent items first, 56px rows, a checkmark on the selected row
  desktop   a popover listbox under the field
  a11y      focus trapped in the sheet, Esc and swipe-down close it, returns focus to the field; listbox/option roles

Switch
  track 52×32, on = control-on (ink) with a white thumb, off = surface-sunken with border-input
  the whole row (label + helper) is the hit area. role="switch" aria-checked

Checkbox
  24px box inside a 48px row hit area, border-input; checked = control-on fill + white check
  the label is clickable, multi-line allowed

SegmentedControl
  2–5 options, 48px, sunken track, selected = surface + 1px border-input + text/600
  phone: if the labels don't fit, it becomes horizontally scrollable chips. Never truncated
  role=tablist when it switches views, radiogroup when it sets a value

FilterChips
  horizontally scrolling row, 40px visual / 48px hit area, pill radius; selected = ink fill + on-ink label + check icon
  toggle buttons with aria-pressed. The last chip, "Сбросить", appears only when a filter is active

StatusBadge
  pill, caption/600, tinted background + same-hue text (all pass AA, see contrast-report). Always text, an icon is optional
  quote    Черновик (neutral) · Отправлен (info) · Открыт ×N (info, eye icon) · Подписан (success) · Отклонён (danger)
           · Срок истёк (warning) · Аннулирован (neutral)
  invoice  Черновик (neutral) · Ждёт оплаты (info) · Оплачен на N% (warning) · Оплачен (success)
           · Просрочен N дн. (danger) · Аннулирован (neutral)
  act      Черновик (neutral) · Выставлен (info) · Подписан (success) · Аннулирован (neutral)
  "Срок истёк" and "Просрочен" are derived on the client from dates in the company time zone; the API also returns paymentState

Card
  surface, 1px border, radius lg, no shadow. Padding 16. Sections inside are separated by 1px border lines

ListRow
  min 72px, padding 14/16, 2-column grid: [title · meta] [amount · badge]. The whole row is one link/button.
  The title clamps to 2 lines. Amounts are right-aligned .dc-money. Trailing ⋯ (48px) opens row actions, which is
  the accessible alternative to the swipe actions

ProgressBar (payment)
  4px, sunken track, control-on fill. role=progressbar with aria-valuenow and aria-valuetext "Оплачено 40%, остаток 147 840 тенге"

BottomSheet
  radius lg on top, grabber, scrim, shadow sheet, slides 280ms (opacity only under reduced motion). Max 90vh, inner scroll
  the primary action is pinned to the sheet bottom. Desktop: becomes a centred dialog (≤ 560px) or a right side panel (≤ 480px)

Dialog (confirm)
  only for destructive or irreversible actions: annul, delete a draft, delete a payment. The title names the object:
  "Аннулировать СЧ-2026-0014?". Buttons: [Отмена] [Аннулировать] (danger). Focus starts on Отмена

Toast
  bottom, above the ActionBar, ink fill + on-ink text, 4s (8s with an action). One at a time. role=status.
  Undo pattern: "Строка удалена · Вернуть"

Banner (inline)
  full-width inside the content: info / success / warning / danger tint + icon + text + optional action.
  Used for version conflicts, offline, a document that is signed or locked

EmptyState
  no illustrations in v1: a 48px Lucide icon in text-muted, a title (lg), one sentence, one primary action. Written for this exact place

Skeleton
  sunken blocks shaped like the real content, no shimmer under reduced motion. Shown after 300ms, never for a fast load

KPI tile
  Card; label sm text-muted; value `figure` .dc-money; one sub-line (sm). The value steps down to `xl` when it is longer than
  11 characters, so "12 500 000 ₸" fits a 328px tile. Phone: one per row; ≥ md: 2 per row; ≥ lg: 4 per row

SignaturePad
  see the signing page, section 3

Money (display)
  <span class="dc-money">1 874 300<span aria-hidden="true">&nbsp;₸</span><span class="sr-only"> тенге</span></span>

Icons
  Lucide (ISC licence), 24px, stroke 2, currentColor. Главная house · Документы files · Клиенты users · Каталог package ·
  КП file-text · Счёт receipt · Акт clipboard-check · Подписать pen-line · Отправить send · Поделиться share-2 ·
  Оплата wallet · Скачать download · Просмотр eye · Ещё ellipsis · Предупреждение triangle-alert · Ошибка circle-alert ·
  Готово circle-check. No brand logos (WhatsApp is a text label on a generic message-circle icon)
```

---

## 2. Quote editor (S07, with S08 preview and S09 send sheet)

**Job:** a tradesperson standing in a client's kitchen builds a КП with one thumb in under a minute (recon target: ≤ 6 taps, under 60 s), then
either hands the phone over for a signature or sends a link.

**Entry:** the **[+]** sheet → "Коммерческое предложение"; "Новое КП" from a client record (client pre-filled); "Дублировать" on any quote.
**Routes:** `POST/PUT/GET …/documents`, `POST …/documents/{id}/issue`. Autosave sends `PUT` with `version`.

### Phone layout, top to bottom

```
┌ TopBar ─────────────────────────────────────┐
│ ←  Новое КП            Черновик   ⋯         │  title becomes "КП-2026-0012" once issued
│    Сохранено · 14:32                         │  save status line, caption, text-muted
├─────────────────────────────────────────────┤
│ КЛИЕНТ                                       │  section label (sm/600, not caps)
│ ┌ Card ───────────────────────────────────┐ │
│ │ Қайрат Әбілқасымов            Изменить  │ │  empty: [Выбрать клиента] full-width secondary
│ │ +7 701 123 45 67                         │ │
│ └─────────────────────────────────────────┘ │
│ РАБОТЫ И МАТЕРИАЛЫ                           │
│ ┌ LineItem (collapsed) ───────────────────┐ │
│ │ Укладка ламината              231 250 ₸ │ │
│ │ 12,5 м² × 18 500 ₸        НДС 37 000 ₸  │ │
│ └─────────────────────────────────────────┘ │
│ [＋ Из каталога]        [Своя строка]        │  2-up secondary buttons, md
│ УСЛОВИЯ                                      │
│ Действует   [3 дня][7][14 дней][30][Дата]   │  SegmentedControl, default from settings
│ НДС 16 %                              (●)   │  Switch row with helper
│ Примечание для клиента (необязательно)       │  textarea, autosize, 3 lines min
├ TotalsBar (ink, sticky) ────────────────────┤
│ Итого  323 930 ₸ · 2 строки           ⌃     │  tap expands: Без НДС / НДС 16% / Итого
├ ActionBar ──────────────────────────────────┤
│ [ ⇪ Отправить ]   [ ✎ Подписать сейчас ]    │  secondary + primary, lg 56px
└─────────────────────────────────────────────┘
```

### LineItem

- **Collapsed** (Card row, the whole row is a button): title (2 lines max), "qty unit × price" (sm, muted), the line total (right, .dc-money/600). When VAT is on, a muted "НДС …" line.
- **Expanded** (tap; one line open at a time):
  - Название: textarea, autosize.
  - Тип: segmented Работа / Материал.
  - Количество: QuantityInput with a unit chip (шт, м, м², м³, п.м., кг, т, л, ч, смена, компл., услуга).
  - Цена за единицу: MoneyInput.
  - "Добавить скидку" is a ghost link that reveals Скидка, % (0–100).
  - Footer: [↑] [↓] reorder IconButtons, "Удалить" (ghost, danger text) → toast "Строка удалена · Вернуть".
  - For a manual line, a checkbox "Сохранить в каталог".
- **From catalogue:** a PickerSheet with search ("Найти работу или материал"), Работа/Материал chips, recent items first. Tapping an item adds the line with qty 1 and opens it so the quantity can be set: 2 taps per line.
- **Desktop:** a drag handle on hover (the ↑↓ buttons stay for keyboard users). Lines show as an editable table: Наименование · Кол-во · Ед. · Цена · Скидка · Сумма.

### Behaviour

- **Autosave.** Saves 1.5 s after the last change and on blur, then shows "Сохранено · HH:MM". Without a connection it shows "Нет сети · копия на телефоне": a localStorage draft, restored on the next open with a Banner "Восстановлен несохранённый черновик".
- **Version conflict (409).** Banner, warning: "КП изменили на другом устройстве." [Показать новую версию]. The local edits stay visible until the user chooses.
- **Editing a sent quote.** Banner, info: "Клиент уже получил ссылку. Он увидит изменения, когда откроет её снова." Signing an older version is blocked by the API.
- **VAT.** If the company isn't a VAT payer, the switch is replaced by the text "Без НДС" and the helper "Вы не плательщик НДС. Изменить можно в настройках компании" (link).
- **Validation, inline, on blur and on send:**
  - "Укажите название"
  - "Количество больше нуля"
  - "Цена не может быть отрицательной"
  - "Выберите клиента"

  On send, the screen scrolls to the first error and focuses it. Server 422 errors are mapped by field path (`lines[1].qty`).
- **The keyboard is open.** The ActionBar and TotalsBar hide while an input has focus, and come back on blur. `scroll-padding-bottom` = the ActionBar height, so the focused field is never covered.
- **"Подписать сейчас".** If it's a draft: issue (number assigned), then open the signing page in hand-over mode (section 3). If anything is invalid, show the errors instead.
- **"Отправить".** Issue if needed, then open the **send sheet** (S09):
  - title "Отправить КП-2026-0012"
  - large rows: WhatsApp · SMS · Электронная почта · Копировать ссылку
  - an editable message preview: "Здравствуйте, Қайрат! Отправляю коммерческое предложение на 323 930 ₸, действует до 02.11: {ссылка}"

  WhatsApp opens `wa.me/{phone}?text=`, SMS opens `sms:`, email opens `mailto:`. Copy shows the toast "Ссылка скопирована".
- **Overflow ⋯:** Предпросмотр, Дублировать, Удалить черновик (drafts) or Аннулировать (sent), with a Dialog.

### States

| state | what changes |
| --- | --- |
| new, empty | client empty button; EmptyState inside the lines section: "Добавьте первую работу", with the two add buttons; Send/Sign disabled with the hint "Нужен клиент и хотя бы одна строка" |
| draft, filled | as drawn above |
| saving / saved / offline | the status line under the title |
| loading | skeleton: client card + 2 line cards + totals |
| load error | Banner danger "Не удалось открыть КП" [Повторить] |
| sent | badge Отправлен / Открыт ×N; info Banner as above; ActionBar: [Ссылка] [Подписать сейчас] |
| signed | read-only (fields become text). Success banner "Подписано 19.10 в 14:05 · Қайрат Ә." [Подпись]. ActionBar: [Создать акт] [Выставить счёт] (convert sheet: Полная сумма / Предоплата % / Предоплата ₸) |
| declined | danger banner with the client's reason; ActionBar: [Дублировать и изменить] |
| expired | warning banner "Срок действия истёк 02.11" [Продлить] (duplicate with new dates) |
| cancelled | read-only, neutral banner "Аннулирован" |

### Desktop (≥ lg)

- Two columns: the form (max 640) and a sticky 520 px **live A4 preview**, the same renderer as the PDF, scaled to fit.
- The TopBar holds status and actions: [Предпросмотр] is hidden, because the preview is always visible; [Отправить] and [Подписать сейчас] stay. TotalsBar sits in the form footer.

### Accessibility

- Lines are an `<ol>`. Each collapsed line is a button named "Строка 1: Укладка ламината, 231 250 тенге".
- Reorder buttons are named "Переместить выше" / "Переместить ниже"; after a move, focus follows the line.
- Totals change in a polite live region, debounced 1 s: "Итого 323 930 тенге".
- The order follows the visual layout. Sheets trap focus and return it.

---

## 3. Signing page (S11 public, S10 hand-over mode)

**Job:** a client who has never heard of Docura opens a link from WhatsApp on a mid-range Android phone, on mobile data, understands
what they're agreeing to, and signs with a finger. The page must feel like *the tradesperson's* document. Docura stays in a small footer:
"Документ подготовлен в Docura".

**Routes:** `GET /api/public/{token}`, `POST …/sign`, `POST …/decline`. No login, no app chrome, no tab bar.

### Phone layout

```
┌─────────────────────────────────────────────┐
│ [logo] ИП Сейткали Б.                        │  company block: logo 40px, name lg/600
│ БИН 123456789012 · +7 701 …  (tap to call)   │  .dc-code for the БИН; phone is a tel: link
├─────────────────────────────────────────────┤
│ Коммерческое предложение                     │  xl
│ № КП-2026-0012 от 19.10.2026                 │
│ 323 930 ₸                                    │  figure, .dc-money
│ Действует до 02.11.2026 · с НДС 16 %         │  sm muted
├─────────────────────────────────────────────┤
│ Document body: the responsive version of     │  NOT a shrunken A4 image: lines as cards
│ the КП, readable at 360px                    │  (title, qty × price, sum), then totals
│ Итого / НДС / Всего                          │  and the note from the tradesperson
│ [Скачать PDF]  (ghost)                       │
├ ActionBar ──────────────────────────────────┤
│ [          ✎ Подписать          ]           │  primary lg, full width
│            Отказаться                        │  ghost text button under it
└─────────────────────────────────────────────┘
  Документ подготовлен в Docura · Подпись фиксируется с датой, временем и IP-адресом
```

### Signing sheet (full screen on a phone, a 480 px side panel on desktop)

1. **Имя и фамилия**: Field, pre-filled from the client record, editable. Error: "Укажите имя".
2. **Подпись**: the SignaturePad (below). Hint "Распишитесь пальцем в рамке". Buttons [Очистить] (ghost) and, on a phone, "Повернуть экран — будет удобнее" (a hint shown only in portrait).
3. **Two consent Checkboxes**, both required. The amount is filled in by the app:
   - "Я ознакомился с коммерческим предложением № КП-2026-0012 на сумму 323 930 ₸ и принимаю его."
   - "Согласен на обработку моих персональных данных (имя, подпись, IP-адрес) для подтверждения подписи."
4. **[Подписать]**: primary lg. Disabled until the name, a non-empty pad and both checkboxes are filled; the disabled hint lists what is missing. While sending: loading "Подписываем…". The signature stays in memory if the request fails.

**Success screen:**
- a large circle-check in `success`
- "Подписано"
- "19 октября 2026, 14:05"
- "Исполнитель увидит подпись сразу. Копия документа — по кнопке ниже." [Скачать PDF]

### SignaturePad

- Canvas on `surface`, a 1px `border-input` frame, radius md, a baseline with a small "×" in `border-input`.
- Height 200 px on a phone in portrait, 240 in landscape and on desktop.
- Pointer events: mouse, touch and stylus. Stroke 2.5 px `signature-ink`, smoothed. Page scrolling is locked while drawing (`touch-action: none` on the canvas only).
- **Blank detection:** at least 2 strokes or 40 points, and a bounding box at least 60 × 20 px. Otherwise "Подпись слишком короткая".
- **Export:** a cropped PNG, max 1200 × 400, ≤ 200 KB (the API limit), base64 in `signaturePng`.
- **a11y:** `role="img"`, `aria-label="Поле для подписи"`, and a live text "Подпись добавлена" or "Поле пустое". **Gap:** people who can't draw have no alternative in v1. Recommendation for the architect: add a `typed` signature method (the name in a script style plus the same consent record). That needs `signatures.method` to allow `'typed'`.

### States

| state | screen |
| --- | --- |
| loading | skeleton of the company block, title, amount and 3 line cards. On slow networks the text appears before the logo |
| ready | as drawn above |
| already signed | read-only; success banner "Подписано 19.10.2026 в 14:05 · Қайрат Әбілқасымов" + the signature image; [Скачать PDF] |
| declined | neutral banner "Вы отказались от предложения 20.10.2026"; the tradesperson's phone to call |
| expired (410 `link_expired`) | warning banner "Срок действия предложения истёк 02.11.2026. Свяжитесь с исполнителем, чтобы получить новое." with a call button; the document is still visible, signing is hidden |
| revoked or not found (410/404) | a full-page EmptyState "Ссылка больше не действует", no document data; "Попросите исполнителя прислать новую ссылку" |
| changed (409 `version_conflict`) | a warning dialog over the sheet: "Исполнитель изменил документ, пока вы его читали. Посмотрите новую версию перед подписью." [Показать новую версию] reloads the document and clears the pad |
| network error on sign | a danger banner inside the sheet: "Не удалось отправить подпись. Проверьте интернет и нажмите ещё раз." The pad and fields are kept |
| rate limited (429) | "Слишком много попыток. Подождите минуту." |

**Decline:** "Отказаться" opens a small sheet with an optional "Причина (необязательно)" textarea and [Отказаться от предложения] (danger) + [Назад].

### Hand-over mode (S10, `?handover=1`)

- It's the same page on the tradesperson's phone: full screen, no Docura navigation, and a top strip "Передайте телефон клиенту" (info).
- Type is one step larger (base 18), and the signature pad is landscape-first.
- After success: "Готово! Верните телефон исполнителю" + [Вернуться к КП] (ink button), which goes back to the quote screen with a toast "КП подписан".
- No view is counted (the API sees the owner's token).

### Desktop

Centred reading column (max 720). The signing panel is a sticky card on the right at ≥ xl, or the side panel at lg.

### Trust and security cues

- The company's БИН, address and phone are always visible; the amount appears before any action.
- The footer explains what is recorded: date, time, IP.
- `<meta name="robots" content="noindex">`. No analytics scripts on this page.

---

## 4. Invoice list (S15, S21 unpaid)

**Job:** answer "кто мне должен?" in one glance and record a payment in three taps (recon F05: 4 → target 3).
**Routes:** `GET …/documents?type=invoice&paymentState=&q=…`, `POST …/documents/{id}/payments`.

### Phone layout

```
┌ TopBar: Документы ──────────────────────────┐
│ [ КП ][ Счета ][ Акты ]                      │  SegmentedControl (tablist)
├─────────────────────────────────────────────┤
│ Ждём 2 316 000 ₸ · просрочено 1 250 000 ₸    │  summary strip, Card; each figure is a filter link
│ 🔍 Клиент, номер или сумма                   │  SearchField
│ (Все)(Ждут оплаты)(Просрочены)(Оплачены)(…) │  FilterChips, scroll; last chip: Способ оплаты ▾
├ Октябрь 2026 ───────────────────────────────┤  sticky month header (sm/600, sunken)
│ Қайрат Әбілқасымов             246 400 ₸    │  ListRow (invoice)
│ СЧ-2026-0014 · до 24.10   [Оплачен на 40%]  │
│ ███████░░░░░░░░░░░                           │  ProgressBar only when partly paid
│ ТОО «Алатау Құрылыс Сервис»  1 250 000 ₸    │
│ СЧ-2026-0011 · до 12.10  [Просрочен 7 дн.]  │
└─────────────────────────────────────────────┘
```

### Row (ListRow, invoice variant)

- **Line 1:** the client name (2 lines max) and the **total** (`.dc-money`, 600).
- **Line 2:** the number (`.dc-code`, muted) and a date: "до 24.10" when unpaid, "оплачен 03.10" when paid. Then the StatusBadge.
- **Partly paid:** a ProgressBar under it, and the muted line shows "остаток 147 840 ₸".
- **Overdue:** the badge says how late, "Просрочен 7 дн.". The row background doesn't change, so a list of red rows doesn't turn into noise.
- **Tap** opens the invoice (S16).
- **Swipe left** shows [Оплата] (ink). The **⋯** button (48 px) opens the same actions (Записать оплату, Отправить ещё раз, Открыть PDF, Аннулировать), so swiping is never the only way.

### Record payment sheet

- Title: "Оплата по СЧ-2026-0014". Sub-line: "Остаток 147 840 ₸ из 246 400 ₸".
- **Сумма:** MoneyInput, pre-filled with the balance and selected, so typing replaces it.
- **Способ:** chips Наличные · Kaspi · Перевод · Карта · Другое. The last-used method is pre-selected.
- **Дата:** today, in the company's time zone. A tap opens the date picker. **Комментарий** is optional.
- **[Записать 147 840 ₸]:** primary lg, and the label follows the amount.
- On success: the toast "Оплата записана · Отменить" (8 s; undo calls `DELETE …/payments/{id}`). The row updates its badge and progress in place.
- **Errors:**
  - 409 `overpayment`, inline under the amount: "Больше остатка на 12 000 ₸. Проверьте сумму."
  - Amount zero: "Укажите сумму".
- Idempotency: the sheet makes one `clientRequestId` when it opens and reuses it on retry.

### Filters, search, sort

- **Chips:**
  - Все
  - Ждут оплаты: unpaid and partly paid
  - Просрочены
  - Оплачены
  - Черновики
  - Аннулированы
  - Способ оплаты ▾: a sheet, multi-select

  Filters persist per device (localStorage); the "Сбросить" chip appears when one is active.
- **Search:**
  - Text matches the client and the number.
  - A numeric query ("246400", "246 400") also matches the total or the balance, exactly. That's how a bank transfer is matched to its invoice (recon V2.3).
  - The result count is announced: "Найдено 3 счёта".
- **Sort:**
  - default: issue date, newest first, grouped by month
  - in "Ждут оплаты" and "Просрочены": due date, oldest first, with no month groups (overdue first)

### States

| state | screen |
| --- | --- |
| loading | 5 skeleton rows + skeleton strip |
| empty, no invoices yet | EmptyState: receipt icon, "Счетов пока нет", "Счёт создаётся из подписанного КП в одно касание.", [К коммерческим предложениям] |
| empty, because of a filter | "Нет счетов с такими условиями" [Сбросить фильтры] |
| error | Banner danger "Не удалось загрузить счета" [Повторить]; cached rows stay visible below |
| offline | Banner warning "Нет сети. Показаны данные на 14:32". Recording a payment is disabled with that reason |

### Desktop (≥ lg)

- A table with a sticky header:

  | № | Клиент | Выставлен | Срок | Сумма | Оплачено | Остаток | Статус | ⋯ |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |

- Numerals are right-aligned and tabular. Срок and Сумма are sortable (`aria-sort`).
- Hovering a row shows a sm [Оплата] button in the ⋯ column. "Показать ещё" loads the next 50.
- The summary strip becomes 3 KPI tiles: Ждём, Просрочено, Получено за месяц.

### Accessibility

- Each row is one link; its accessible name reads in order: client, number, total, status.
- The progress bar has text. Chips are `aria-pressed` toggle buttons. Swipe actions have button equivalents.

---

## 5. Dashboard (S04)

**Job:** in five seconds, answer three questions: how much came in, how much I'm owed, what to do next. A simple dashboard: numbers and to-dos, **no charts in v1**.
**Route:** `GET …/dashboard?from&to`. Fields: `awaitingSignature`, `signed`, `acceptanceRate`, `invoicedTiyn`, `cashedTiyn`, `outstanding`, `overdue`, `toInvoice[]`, `recentEvents[]`.

### Phone layout

```
┌ TopBar ─────────────────────────────────────┐
│ ИП Сейткали Б.            [Октябрь 2026 ▾]  │  period chip → sheet: Этот месяц, Прошлый месяц,
├─────────────────────────────────────────────┤  Квартал, Год, Выбрать даты
│ НУЖНО СДЕЛАТЬ                                │
│ ⚠ 2 счёта просрочены · 1 250 000 ₸       ›  │  danger icon, links to the filtered invoice list
│ ✎ 3 КП подписаны, счёт не выставлен  ›     │  → toInvoice list
│ ⏱ 2 КП ждут подписи дольше 3 дней       ›  │  → quotes filtered
│ ⌛ 1 КП истекает завтра                  ›  │
├─────────────────────────────────────────────┤
│ ┌ KPI ────────────────────────────────────┐ │  one per row on phones
│ │ Получено в октябре                       │ │
│ │ 1 874 300 ₸                              │ │  figure
│ │ 12 оплат · +12 % к сентябрю              │ │  delta: arrow icon + text, success/danger
│ └─────────────────────────────────────────┘ │
│ ┌ Ждём оплаты: 2 316 000 ₸ · из них        │ │
│ │ просрочено 1 250 000 ₸ (danger)          │ │
│ ┌ Выставлено счетов: 2 940 000 ₸ · 9 шт.   │ │
│ ┌ КП: подписано 5 из 8 · 62 %              │ │
├─────────────────────────────────────────────┤
│ ПОДПИСАНО — ВЫСТАВЬТЕ СЧЁТ                   │  toInvoice, top 5
│ Қайрат Ә. · КП-2026-0012   323 930 ₸ [Счёт] │  sm secondary button opens the convert sheet
├─────────────────────────────────────────────┤
│ ПОСЛЕДНИЕ СОБЫТИЯ                            │  recentEvents, 10, a Timeline
│ ● Қайрат Ә. открыл КП-2026-0012 · 5 мин     │
│ ● Оплата 98 560 ₸ по СЧ-2026-0014 · 2 ч     │
└─────────────────────────────────────────────┘
```

### "Нужно сделать"

- It's the first block, because it's the one people act on.
- Rows are generated from the payload, in this order: overdue, signed but not invoiced, waiting for a signature for more than 3 days, expiring within 2 days.
- Each row: an icon, a counted phrase with proper Russian plurals ("1 счёт / 2 счёта / 5 счетов"), a chevron. Use `Intl.PluralRules('ru')`.
- When nothing is pending: one success row, "Всё под контролем. Новых дел нет."

### KPI tiles

- Values come from the API in tiyn and are formatted with Money.
- Deltas compare with the previous period of the same length. A delta is shown only if the previous value is non-zero, and always as text ("+12 % к сентябрю"), never colour alone.
- A tile is a link: Получено goes to payments (later) or invoices filtered to paid; Ждём goes to Ждут оплаты.

### States

| state | screen |
| --- | --- |
| first run (no documents) | the KPIs are replaced by a **Начало работы** checklist Card, "1 из 3": ✓ Реквизиты компании (БИН, банк) · Добавьте 3–5 работ в каталог · Создайте первое КП. Each row links to its screen. Done steps are struck through in text-muted with a check |
| loading | 4 skeleton tiles + 3 skeleton to-do rows |
| error | Banner danger [Повторить]; nothing else is shown, no fake zeros |
| empty period | the tiles show "0 ₸" with the sub-line "За октябрь пока ничего". "Нужно сделать" still shows (it doesn't depend on the period) |

### Desktop (≥ lg)

- Row 1: 4 KPI tiles. Row 2: two columns, "Нужно сделать" + "Подписано — выставьте счёт" (7/12) and "Последние события" (5/12).
- The period selector is a SegmentedControl in the page header: Месяц · Квартал · Год · Период.

### Accessibility

- Each tile is a heading (label) followed by a value. To-do rows are links with complete sentences.
- The period change is announced: "Показаны данные за октябрь 2026".

---

## 6. Copy rules for the Russian UI (fresh, Docura's own voice)

- **Voice.** Plain, friendly-professional, "вы" in lower case. Verbs on buttons: Отправить, Подписать, Выставить счёт, Записать оплату. No exclamation marks except on success screens.
- **Length.** Primary buttons are 1–3 words. Tab labels are at most 9 letters (Главная, Документы, Клиенты, Ещё). Badges are at most 16 characters ("Оплачен на 40%").
- **Plurals.** Always through `Intl.PluralRules('ru')`: 1 счёт, 2 счёта, 5 счетов; 1 день, 2 дня, 5 дней.
- **Dates and numbers.**
  - Dates: `dd.mm.yyyy` on documents; "19 окт." or "до 24.10" in lists; relative ("5 мин назад") only in the activity feed.
  - Money and identifiers: rules 2 and 3 above.
- **Spelling.** Use the letter "ё" (Подписан, Отклонён, Ещё), and «ёлочки» quotes for organisation names: ТОО «…».
- **Errors.** Say what happened and what to do, in one or two sentences. Never "Error 409".
- **Abbreviations.** НДС, ИИН/БИН, ИИК, БИК, Кбе, КНП, КП, АВР stay as is. They are the words users know.
