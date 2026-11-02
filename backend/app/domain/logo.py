"""The company logo: PNG or JPEG, at most 300 KB. Mirror of `frontend/src/domain/logo.ts`, with the same messages.

The type is read from the first bytes, never from the file name or the type the client declared: a text file renamed
`logo.png` is refused.
"""

LOGO_MAX_BYTES = 300 * 1024

_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"

WRONG_TYPE = "Логотип должен быть в формате PNG или JPEG."
TOO_BIG = "Файл больше 300 КБ. Выберите логотип поменьше."


def detect_logo_type(head: bytes) -> str | None:
    """The image type the first bytes say it is, or None for anything else (a GIF, a text file, ...)."""
    if head.startswith(_PNG):
        return "image/png"
    if head.startswith(_JPEG):
        return "image/jpeg"
    return None


def logo_problem(content: bytes) -> str | None:
    """What is wrong with this logo, or None when it can be stored. The type is checked first: a big GIF is the wrong
    type."""
    if detect_logo_type(content) is None:
        return WRONG_TYPE
    if len(content) > LOGO_MAX_BYTES:
        return TOO_BIG
    return None
