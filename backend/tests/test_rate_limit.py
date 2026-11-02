from app.rate_limit import RateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def limiter(clock: FakeClock, **options) -> RateLimiter:
    return RateLimiter(5, 60.0, clock=clock, **options)


def test_the_sixth_try_in_a_window_is_refused() -> None:
    rate = limiter(FakeClock())
    assert [rate.allow("a") for _ in range(6)] == [True] * 5 + [False]


def test_keys_are_counted_apart() -> None:
    rate = limiter(FakeClock())
    for _ in range(6):
        rate.allow("a")
    assert rate.allow("b")


def test_the_window_slides() -> None:
    clock = FakeClock()
    rate = limiter(clock)
    assert rate.allow("a")
    clock.now += 30
    for _ in range(4):
        assert rate.allow("a")
    assert not rate.allow("a")
    clock.now += 30  # the first try is now 60 s old, the other four 30 s
    assert rate.allow("a")
    assert not rate.allow("a")


def test_a_refused_try_does_not_push_the_wait_back() -> None:
    clock = FakeClock()
    rate = limiter(clock)
    for _ in range(5):
        rate.allow("a")
    clock.now += 59.9
    assert not rate.allow("a")
    clock.now += 0.1
    assert rate.allow("a")


def test_finished_keys_are_dropped() -> None:
    clock = FakeClock()
    rate = limiter(clock)
    for number in range(100):
        rate.allow(number)
    assert len(rate) == 100
    clock.now += 60
    rate.allow("new")
    assert len(rate) == 1


def test_the_number_of_keys_is_capped_and_the_quietest_goes_first() -> None:
    rate = limiter(FakeClock(), max_keys=3)
    for key in ("a", "b", "c"):
        rate.allow(key)
    rate.allow("a")
    rate.allow("d")
    assert len(rate) == 3
    for _ in range(3):
        assert rate.allow("a")
    assert not rate.allow("a")  # "a" kept its count; "b" was the one dropped
    for _ in range(5):
        assert rate.allow("b")


def test_reset_forgets_everything() -> None:
    rate = limiter(FakeClock())
    for _ in range(6):
        rate.allow("a")
    rate.reset()
    assert len(rate) == 0
    assert rate.allow("a")
