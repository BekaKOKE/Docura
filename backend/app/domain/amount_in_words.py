"""The total in words for the счёт and the АВР (spec section 6; docs/kz-rules.md row 4).

Mirror of `frontend/src/domain/amountInWords.ts`. Tenge in Russian words with a capital first letter, "тенге" never
changes, tiyn as two digits followed by тиын / тиына / тиынов. Zero tiyn is written "00 тиын", as on accounting
documents (owner's decision, 20.10.2026).
"""

from app.domain.money import TIYN_PER_TENGE, Tiyn, assert_tiyn

_HUNDREDS = ("", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот")
_TENS = ("", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто")
_TEENS = (
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
)
_UNITS_MASCULINE = ("", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять")
_UNITS_FEMININE = ("", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять")

# Index 0 is the tenge themselves (no scale word); thousands are feminine, the rest masculine.
_SCALES: tuple[tuple[tuple[str, str, str], bool], ...] = (
    (("", "", ""), False),
    (("тысяча", "тысячи", "тысяч"), True),
    (("миллион", "миллиона", "миллионов"), False),
    (("миллиард", "миллиарда", "миллиардов"), False),
    (("триллион", "триллиона", "триллионов"), False),
)


def _plural_index(n: int) -> int:
    """1, 21 -> 0 (first form); 2-4, 22-24 -> 1; 0, 5-20, 25-30 ... -> 2."""
    last_two = n % 100
    last = n % 10
    if 11 <= last_two <= 14:
        return 2
    if last == 1:
        return 0
    if 2 <= last <= 4:
        return 1
    return 2


def _triplet(n: int, feminine: bool) -> list[str]:
    """1-999 in words."""
    hundreds, tens, units = n // 100, n // 10 % 10, n % 10
    words = [_HUNDREDS[hundreds]]
    if tens == 1:
        words.append(_TEENS[units])
    else:
        words.append(_TENS[tens])
        words.append((_UNITS_FEMININE if feminine else _UNITS_MASCULINE)[units])
    return [word for word in words if word]


def _tenge_in_words(tenge: int) -> str:
    if tenge == 0:
        return "ноль"
    groups: list[int] = []
    rest = tenge
    while rest > 0:
        groups.append(rest % 1000)
        rest //= 1000
    if len(groups) > len(_SCALES):
        raise ValueError("Amount is too large to write in words")

    words: list[str] = []
    for scale in range(len(groups) - 1, -1, -1):
        group = groups[scale]
        if group == 0:
            continue
        forms, feminine = _SCALES[scale]
        words.extend(_triplet(group, feminine))
        if scale > 0:
            words.append(forms[_plural_index(group)])
    return " ".join(words)


def _tiyn_word(tiyn: int) -> str:
    return ("тиын", "тиына", "тиынов")[0 if tiyn == 0 else _plural_index(tiyn)]


def amount_in_words(amount_tiyn: Tiyn) -> str:
    """32393000 -> "Триста двадцать три тысячи девятьсот тридцать тенге 00 тиын"."""
    assert_tiyn(amount_tiyn)
    if amount_tiyn < 0:
        raise ValueError("Amount in words expects a non-negative amount")

    tenge, tiyn = divmod(amount_tiyn, TIYN_PER_TENGE)
    sentence = f"{_tenge_in_words(tenge)} тенге {tiyn:02d} {_tiyn_word(tiyn)}"
    return sentence[0].upper() + sentence[1:]
