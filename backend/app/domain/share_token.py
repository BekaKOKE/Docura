"""Share-link tokens: 256 random bits, URL-safe (replica/schema.sql `share_links.token`, architecture "Public links").

The token in the link is the credential, so it is made with `secrets` and compared in constant time.
"""

import hmac
import re
import secrets

TOKEN_BYTES = 32
# 32 bytes in unpadded base64url: 43 characters.
TOKEN_LENGTH = 43
_TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")


def new_share_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def is_well_formed_token(token: object) -> bool:
    """Cheap shape check, so garbage never reaches the storage layer."""
    return isinstance(token, str) and _TOKEN.fullmatch(token) is not None


def tokens_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode(), right.encode())


def share_url(public_base_url: str, token: str) -> str:
    """The link the client opens: `<PUBLIC_BASE_URL>/p/<token>`."""
    return f"{public_base_url.rstrip('/')}/p/{token}"
