from app.domain.logo import LOGO_MAX_BYTES, TOO_BIG, WRONG_TYPE, detect_logo_type, logo_problem

PNG = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8\xff\xe0"


def test_png_and_jpeg_are_known_by_their_first_bytes() -> None:
    assert detect_logo_type(PNG + b"rest") == "image/png"
    assert detect_logo_type(JPEG + b"rest") == "image/jpeg"


def test_anything_else_is_not_a_logo() -> None:
    assert detect_logo_type(b"GIF89a") is None
    assert detect_logo_type(b"hello, I am text") is None
    assert detect_logo_type(b"") is None
    assert detect_logo_type(PNG[:7]) is None


def test_up_to_300_kb_is_fine() -> None:
    assert logo_problem(PNG.ljust(LOGO_MAX_BYTES, b"\0")) is None
    assert logo_problem(PNG.ljust(LOGO_MAX_BYTES + 1, b"\0")) == TOO_BIG


def test_the_type_is_checked_before_the_size() -> None:
    assert logo_problem(b"GIF89a".ljust(LOGO_MAX_BYTES + 1, b"\0")) == WRONG_TYPE
