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


def test_past_the_cap_a_new_key_is_refused_and_no_live_key_is_forgotten() -> None:
    """#39 FAIL: dropping the quietest key handed an attacker's count back. A live key is kept, and a new one waits."""
    rate = limiter(FakeClock(), max_keys=3)
    for key in ("a", "b", "c"):
        rate.allow(key)
    rate.allow("a")
    assert not rate.allow("d")
    assert len(rate) == 3
    for _ in range(3):
        assert rate.allow("a")
    assert not rate.allow("a")  # "a" kept its count
    for _ in range(4):
        assert rate.allow("b")
    assert not rate.allow("b")  # and so did "b", the quietest, with its one try


def test_a_full_store_takes_new_keys_again_once_old_ones_finish() -> None:
    clock = FakeClock()
    rate = limiter(clock, max_keys=2)
    rate.allow("a")
    clock.now += 30
    rate.allow("b")
    assert not rate.allow("c")
    clock.now += 30  # "a" is finished, "b" is still live
    assert rate.allow("c")
    assert not rate.allow("d")
    assert len(rate) == 2


def test_a_group_holds_at_most_its_cap_of_live_keys() -> None:
    clock = FakeClock()
    rate = limiter(clock, max_keys_per_group=3)
    assert [rate.allow(email, "10.0.0.1") for email in ("a", "b", "c", "d")] == [True, True, True, False]
    assert rate.keys_in_group("10.0.0.1") == 3
    assert rate.allow("a", "10.0.0.1")  # a key it already has goes on counting
    assert rate.allow("d", "10.0.0.2")  # and another group isn't touched
    clock.now += 60
    assert rate.allow("d", "10.0.0.1")
    assert rate.keys_in_group("10.0.0.1") == 1


def test_a_refused_new_key_is_not_stored() -> None:
    rate = limiter(FakeClock(), max_keys=1)
    rate.allow("a")
    assert not rate.allow("b")
    assert not rate.allow("b")
    assert len(rate) == 1


def test_one_group_cannot_fill_the_store_for_the_others() -> None:
    rate = limiter(FakeClock(), max_keys=100, max_keys_per_group=10)
    flood = [rate.allow(f"junk{number}", "attacker") for number in range(1000)]
    assert flood.count(True) == 10
    assert rate.allow("someone", "elsewhere")
    assert len(rate) == 11


def test_a_key_with_a_few_tries_survives_a_flood_from_its_own_group() -> None:
    """A reset at 3 tries breaks "the sixth attempt" just as much as a reset at 5."""
    rate = limiter(FakeClock(), max_keys=50, max_keys_per_group=5)
    for _ in range(3):
        rate.allow("victim", "ip")
    for number in range(500):
        rate.allow(f"junk{number}", "ip")
    assert [rate.allow("victim", "ip") for _ in range(3)] == [True, True, False]


def test_reset_forgets_everything() -> None:
    rate = limiter(FakeClock())
    for _ in range(6):
        rate.allow("a")
    rate.allow("b", "group")
    rate.reset()
    assert len(rate) == 0
    assert rate.keys_in_group("group") == 0
    assert rate.allow("a")
