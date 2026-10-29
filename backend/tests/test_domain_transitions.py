"""Status transition tables: only the MVP moves are allowed (spec section 5, D5), everything else is rejected."""

import ast
import itertools
import subprocess
import sys
from pathlib import Path

import pytest

from app.domain.errors import InvalidTransition
from app.domain.numbering import DocumentType
from app.domain.transitions import (
    ISSUED_STATUS,
    STATUSES,
    TRANSITIONS,
    assert_transition,
    can_transition,
    is_deletable,
    is_editable,
)

ALLOWED = {
    ("quote", "draft", "sent"),
    ("quote", "sent", "signed"),
    ("invoice", "draft", "issued"),
    ("act", "draft", "issued"),
}


@pytest.mark.parametrize(("document_type", "current", "target"), sorted(ALLOWED))
def test_the_mvp_transitions_are_allowed(document_type: DocumentType, current: str, target: str) -> None:
    assert can_transition(document_type, current, target)
    assert_transition(document_type, current, target)


@pytest.mark.parametrize(
    ("document_type", "current", "target"),
    [
        ("quote", "draft", "signed"),  # skipping "sent"
        ("quote", "signed", "sent"),  # going back
        ("quote", "sent", "cancelled"),  # cancel is post-MVP
        ("quote", "sent", "declined"),  # decline is post-MVP
        ("quote", "draft", "cancelled"),
        ("quote", "signed", "cancelled"),
        ("quote", "sent", "draft"),
        ("quote", "draft", "draft"),
        ("invoice", "issued", "cancelled"),
        ("invoice", "draft", "cancelled"),
        ("invoice", "issued", "draft"),
        ("invoice", "draft", "sent"),  # a status of another type
        ("invoice", "draft", "signed"),
        ("act", "issued", "signed"),  # the client signing an act is post-MVP
        ("act", "issued", "cancelled"),
        ("act", "draft", "signed"),
        ("quote", "paid", "sent"),  # not a status at all
        ("quote", "draft", "nonsense"),
    ],
)
def test_every_other_transition_is_rejected(document_type: DocumentType, current: str, target: str) -> None:
    assert not can_transition(document_type, current, target)
    with pytest.raises(InvalidTransition) as excinfo:
        assert_transition(document_type, current, target)
    assert excinfo.value.code == "document_locked"


def test_exactly_the_four_mvp_moves_exist_over_all_known_statuses() -> None:
    found = {
        (document_type, current, target)
        for document_type, statuses in STATUSES.items()
        for current, target in itertools.product(statuses, statuses)
        if can_transition(document_type, current, target)
    }
    assert found == ALLOWED


def test_tables_only_name_statuses_the_schema_allows() -> None:
    for document_type, table in TRANSITIONS.items():
        for current, targets in table.items():
            assert current in STATUSES[document_type]
            assert targets <= STATUSES[document_type]


def test_leaving_draft_is_the_issue_move() -> None:
    for document_type, status in ISSUED_STATUS.items():
        assert can_transition(document_type, "draft", status)


def test_editing_and_deleting_follow_the_locking_rules() -> None:
    assert is_editable("quote", "draft")
    assert is_editable("quote", "sent")
    assert not is_editable("quote", "signed")
    assert not is_editable("quote", "declined")
    assert not is_editable("quote", "cancelled")
    for document_type in ("invoice", "act"):
        assert is_editable(document_type, "draft")  # type: ignore[arg-type]
        assert not is_editable(document_type, "issued")  # type: ignore[arg-type]
    assert is_deletable("draft")
    assert not is_deletable("sent")
    assert not is_deletable("issued")


# ---------------------------------------------------------------- the domain imports no framework or storage code

DOMAIN_DIR = Path(__file__).resolve().parents[1] / "app" / "domain"
BACKEND_DIR = DOMAIN_DIR.parents[1]
FORBIDDEN = ("fastapi", "starlette", "sqlalchemy", "alembic", "pydantic", "app.repositories", "app.db", "app.api")


def _imported_modules(source: str) -> list[str]:
    modules: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def test_domain_source_imports_no_storage_or_framework_code() -> None:
    offenders = [
        f"{path.name}: {module}"
        for path in DOMAIN_DIR.glob("*.py")
        for module in _imported_modules(path.read_text(encoding="utf-8"))
        if any(module == name or module.startswith(name + ".") for name in FORBIDDEN)
    ]
    assert offenders == []


def test_importing_the_domain_in_a_clean_interpreter_loads_no_framework() -> None:
    lines = [
        "import sys",
        f"sys.path.insert(0, {str(BACKEND_DIR)!r})",
        "import app.domain",
        "names = ('fastapi', 'starlette', 'sqlalchemy', 'alembic', 'pydantic', 'app.main', 'app.errors')",
        "print(','.join(m for m in names if m in sys.modules))",
    ]
    result = subprocess.run(
        [sys.executable, "-I", "-c", chr(10).join(lines)], capture_output=True, text=True, check=True
    )
    assert result.stdout.strip() == ""
