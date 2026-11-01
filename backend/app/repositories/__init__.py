"""The storage seam: `base.py` says what services may ask, `memory.py` answers it in memory (`sql.py` in M4)."""

from app.config import Settings
from app.repositories.base import Storage
from app.repositories.memory import MemoryStorage


def build_storage(settings: Settings) -> Storage:
    """The storage `STORAGE` asks for. `sql` refuses to start rather than quietly keep real data in memory."""
    if settings.storage == "memory":
        return MemoryStorage()
    raise RuntimeError(f"STORAGE={settings.storage} is not available yet: the SQL repositories arrive in M4")
