"""An in-process rate limit (replica/architecture.md, "Rate limits"). It is per process, which is fine for one uvicorn
worker; more workers would need a shared store.

A key may be counted `limit` times in any `window_seconds`. A refused try isn't counted, so it doesn't push the wait
back. At most `max_keys` keys are kept: finished ones are dropped as new tries come in, and past the cap the key that
has been quiet longest goes first, so the memory stays bounded whatever a client sends.
"""

import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable, Hashable

AUTH_LIMIT = 5
AUTH_WINDOW_SECONDS = 60.0
MAX_KEYS = 10_000


class RateLimiter:
    def __init__(
        self,
        limit: int = AUTH_LIMIT,
        window_seconds: float = AUTH_WINDOW_SECONDS,
        *,
        max_keys: int = MAX_KEYS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._max_keys = max_keys
        self._clock = clock
        self._lock = threading.Lock()
        # Ordered by the newest counted try, oldest first.
        self._tries: OrderedDict[Hashable, deque[float]] = OrderedDict()

    def __len__(self) -> int:
        return len(self._tries)

    def allow(self, key: Hashable) -> bool:
        """Count this try and say whether it may go ahead."""
        now = self._clock()
        with self._lock:
            self._drop_finished(now)
            tries = self._tries.get(key)
            if tries is None:
                tries = self._tries[key] = deque()
            while tries and now - tries[0] >= self._window:
                tries.popleft()
            if len(tries) >= self._limit:
                return False
            tries.append(now)
            self._tries.move_to_end(key)
            while len(self._tries) > self._max_keys:
                self._tries.popitem(last=False)
            return True

    def reset(self) -> None:
        with self._lock:
            self._tries.clear()

    def _drop_finished(self, now: float) -> None:
        while self._tries:
            key, tries = next(iter(self._tries.items()))
            if now - tries[-1] < self._window:
                return
            del self._tries[key]
