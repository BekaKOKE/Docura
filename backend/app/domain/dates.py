"""Calendar days. Business dates (`issue_date`, `valid_until`, `due_date`, `paid_on`) are `YYYY-MM-DD` strings: days in
the company's time zone, never timestamps (replica/architecture.md, "Times"). The zone is an IANA name such as
`Asia/Almaty`, never a fixed offset. Kazakhstan has been on UTC+5 since 2024-03-01; the `tzdata` package keeps
`zoneinfo` right on Windows.

Mirror of `frontend/src/domain/dates.ts`.
"""

import re
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

COMPANY_TIME_ZONE = "Asia/Almaty"

_DATE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})")


def _parse(value: str) -> date | None:
    match = _DATE.fullmatch(value) if isinstance(value, str) else None
    if match is None:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def is_iso_date(value: object) -> bool:
    """True for a real calendar day written `YYYY-MM-DD` (2026-02-30 is not one)."""
    return isinstance(value, str) and _parse(value) is not None


def today_in_zone(time_zone: str = COMPANY_TIME_ZONE, now: datetime | None = None) -> str:
    """The calendar day it is at `now` in the zone: 2026-10-20T19:00:00Z is 2026-10-21 in Asia/Almaty (UTC+5)."""
    moment = now if now is not None else datetime.now(UTC)
    if moment.tzinfo is None:
        raise ValueError("now must be timezone-aware (UTC timestamps)")
    return moment.astimezone(ZoneInfo(time_zone)).date().isoformat()


def add_days(value: str, days: int) -> str:
    """`value` plus a number of calendar days (negative goes back)."""
    parsed = _parse(value)
    if parsed is None:
        raise ValueError(f"not a date: {value}")
    return (parsed + timedelta(days=days)).isoformat()


def days_between(start: str, end: str) -> int:
    """Whole days from `start` to `end` (negative when `end` is earlier)."""
    first, last = _parse(start), _parse(end)
    if first is None:
        raise ValueError(f"not a date: {start}")
    if last is None:
        raise ValueError(f"not a date: {end}")
    return (last - first).days
