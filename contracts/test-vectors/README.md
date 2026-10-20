# Test vectors

Expected results shared by the TypeScript tests (`frontend/src/domain`, #12) and the Python tests (`backend/app/domain`, #37).
Both sides load **every case of every file** here and must produce exactly the `expected` values (AGENTS.md rule 3). The values
come from spec §6 and `docs/kz-rules.md`; each file or case names its `source`.

## Units

| field suffix / name | unit |
| --- | --- |
| `…Tiyn` | integer tiyn (1 ₸ = 100 tiyn) |
| `qtyMilli` | quantity in thousandths (12,5 → `12500`) |
| `…Bp` | basis points (`1600` = 16 %, `5000` = 50 %) |
| `qtyText` | the quantity as a user types it (`"12,5"`, `"12.5"`); parsing it must give `qtyMilli` |

Every file is `{ "description", "source"?, "cases": [ … ] }`, and every case has an `id` that is unique within its file.

## Files

### `totals.json`: line and document totals

Case: `{ id, description, source, vatEnabled, vatRateBp, lines: [{ qtyText, qtyMilli, unitPriceTiyn, discountBp }], expected }`.

`expected` is `{ lines: [{ netTiyn, vatTiyn, grossTiyn }], netTiyn, vatTiyn, grossTiyn }`, computed per line with half-up rounding:

```
net   = round_half_up(qtyMilli × unitPriceTiyn × (10000 − discountBp) / (1000 × 10000))
vat   = vatEnabled ? round_half_up(net × vatRateBp / 10000) : 0
gross = net + vat
document totals = sums of the lines
```

`discountBp` is always `0` in the MVP (line discounts are post-MVP, #70).

### `prepayment.json`: one-line invoices from a signed quote

Case: `{ id, description, source, quoteGrossTiyn, vatEnabled, vatRateBp, alreadyInvoicedTiyn, basis, basisValue?, basisUnit?, expected }`.

- `basis`: `percent` (`basisValue` in basis points, `basisUnit: "bp"`), `amount` (`basisValue` in tiyn, `basisUnit: "tiyn"`) or `remaining` (no value).
- `alreadyInvoicedTiyn`: the sum of the non-cancelled invoices already made from the quote.
- Gross: `percent` → `round_half_up(quoteGrossTiyn × basisValue / 10000)`; `amount` → `basisValue`; `remaining` → `quoteGrossTiyn − alreadyInvoicedTiyn`.
- VAT split: `vat = vatEnabled ? round_half_up(gross × vatRateBp / (10000 + vatRateBp)) : 0`, `net = gross − vat`.
- `expected` is `{ grossTiyn, vatTiyn, netTiyn }`, or `{ error: "exceeds_quote_total" }` when the gross is more than what is left
  (or nothing is left).

### `bin-iin.json`: ИИН/БИН

Case: `{ id, value, valid, reason }`. Valid means 12 digits whose 12th digit is the control digit: Σ aᵢ·i mod 11 over digits 1–11;
if that is 10, Σ with weights 3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2; if that is 10 again, the number is invalid
(`docs/kz-rules.md` row 6). The values are made up. `second-cycle` and `both-cycles-ten` cover the two-cycle rule;
`qa-md-old-*` are the old `docs/team/qa.md` values, which fail.

### `iik.json`: ИИК

Case: `{ id, value, valid, reason }`. Valid means 20 characters, starts with `KZ`, upper case letters and digits only, and IBAN mod-97
equals 1. The values are made up.

### `amount-in-words.json`: total in words

Case: `{ id, amountTiyn, expected }`. Format: the tenge amount in Russian words with a capital first letter, then `тенге` (never changes),
then the tiyn as two digits, then `тиын` / `тиына` / `тиынов` by Russian plural rules (1, 21 → тиын; 2–4, 22–24 → тиына; 5–20 → тиынов), except zero, which is written `00 тиын` as in accounting documents (owner's decision, 20.10.2026; spec §6).
`тысяча` is feminine (одна тысяча, две тысячи). Example: `32393000` → `Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын`.
Tiyn are digits because payment documents write them that way (`docs/kz-rules.md` row 4).
