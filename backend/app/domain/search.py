"""Search key for clients, articles and documents.

SQLite `lower()` and `LIKE` fold ASCII only, so the app stores `search_key(name)` next to the name and queries with
`LIKE` on that, which behaves the same on SQLite and PostgreSQL (replica/architecture.md, "Search").

Mirror of `frontend/src/domain/searchKey.ts`: case-fold, then e-with-diaeresis -> e. Kazakh letters
(Ә Ғ Қ Ң Ө Ұ Ү Һ І) are only case-folded, never replaced, and «ёлочки» quotes stay as typed. For Cyrillic, Kazakh and
Latin text `casefold()` equals JavaScript's `toLowerCase()` (they differ only for letters like the German sharp s).
"""


def search_key(text: str) -> str:
    return text.casefold().replace("ё", "е")
