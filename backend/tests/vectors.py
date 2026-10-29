"""Loads the shared test vectors from `contracts/test-vectors/` (relative to the repository root).

The TypeScript tests (`frontend/src/domain`) run the same files, so a change to a vector changes both sides.
"""

import json
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
VECTORS_DIR = REPO_ROOT / "contracts" / "test-vectors"


def load_cases(name: str) -> list[dict[str, Any]]:
    data = json.loads((VECTORS_DIR / f"{name}.json").read_text(encoding="utf-8"))
    return data["cases"]


def vector_params(name: str) -> list[Any]:
    """One pytest param per case, with the case id as the test id."""
    return [pytest.param(case, id=case["id"]) for case in load_cases(name)]
