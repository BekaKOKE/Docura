"""Document numbers: `КП-2026-0001`, `СЧ-2026-0001`, `АВР-2026-0001`, per company, type and year of the issue date.

A number is assigned when a document leaves draft, from the `document_counters` row in the same transaction, so a
draft that is deleted or never issued uses none up (replica/architecture.md, "Numbering"). This module only formats;
taking the next sequence number is the repository's job.
"""

from typing import Literal

DocumentType = Literal["quote", "invoice", "act"]

NUMBER_PREFIX: dict[DocumentType, str] = {
    "quote": "КП",
    "invoice": "СЧ",
    "act": "АВР",
}


def format_document_number(document_type: DocumentType, year: int, sequence: int) -> str:
    if sequence < 1:
        raise ValueError("sequence starts at 1")
    return f"{NUMBER_PREFIX[document_type]}-{year}-{sequence:04d}"


def year_of(issue_date: str) -> int:
    """The year of a `YYYY-MM-DD` day."""
    return int(issue_date[:4])
