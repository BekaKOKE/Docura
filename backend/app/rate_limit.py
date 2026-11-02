"""An in-process rate limit (replica/architecture.md, "Rate limits"). It is per process, which is fine for one uvicorn
worker; more workers would need a shared store.

A key may be counted `limit` times in any `window_seconds`. A refused try isn't counted, so it doesn't push the wait
back. A key with a try inside its window is live, and a live key is never forgotten because of other keys: forgetting
it would hand its count back, and with it the attacker's next five password guesses.

The memory stays bounded by refusing new keys instead. Each key belongs to a group (the client's address), and a group
may hold at most `max_keys_per_group` live keys, so one client can't fill the store and lock everyone else out; the
whole store holds at most `max_keys`. Past either cap a try with a new key is refused, while the keys already there
go on counting. Keys whose tries have all left the window are dropped as new tries come in.
"""

import threading
import time
from collections import Counter, OrderedDict, deque
from collections.abc import Callable, Hashable

AUTH_LIMIT = 5
AUTH_WINDOW_SECONDS = 60.0
MAX_KEYS = 10_000
MAX_KEYS_PER_GROUP = 20


class RateLimiter:
    def __init__(
        self,
        limit: int = AUTH_LIMIT,
        window_seconds: float = AUTH_WINDOW_SECONDS,
        *,
        max_keys: int = MAX_KEYS,
        max_keys_per_group: int = MAX_KEYS_PER_GROUP,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._max_keys = max_keys
        self._max_keys_per_group = max_keys_per_group
        self._clock = clock
        self._lock = threading.Lock()
        # Ordered by the newest counted try, oldest first, so the finished keys are always at the front.
        self._tries: OrderedDict[Hashable, deque[float]] = OrderedDict()
        self._group_of: dict[Hashable, Hashable] = {}
        self._keys_in_group: Counter[Hashable] = Counter()

    def __len__(self) -> int:
        return len(self._tries)

    def keys_in_group(self, group: Hashable) -> int:
        return self._keys_in_group[group]

    def allow(self, key: Hashable, group: Hashable | None = None) -> bool:
        """Count this try and say whether it may go ahead. Without a group, the key is a group of its own."""
        group = key if group is None else group
        now = self._clock()
        with self._lock:
            self._drop_finished(now)
            tries = self._tries.get(key)
            if tries is None:
                if len(self._tries) >= self._max_keys or self._keys_in_group[group] >= self._max_keys_per_group:
                    return False
                tries = self._tries[key] = deque()
                self._group_of[key] = group
                self._keys_in_group[group] += 1
            while tries and now - tries[0] >= self._window:
                tries.popleft()
            if len(tries) >= self._limit:
                return False
            tries.append(now)
            self._tries.move_to_end(key)
            return True

    def reset(self) -> None:
        with self._lock:
            self._tries.clear()
            self._group_of.clear()
            self._keys_in_group.clear()

    def _drop_finished(self, now: float) -> None:
        while self._tries:
            key, tries = next(iter(self._tries.items()))
            if now - tries[-1] < self._window:
                return
            del self._tries[key]
            group = self._group_of.pop(key)
            self._keys_in_group[group] -= 1
            if not self._keys_in_group[group]:
                del self._keys_in_group[group]
