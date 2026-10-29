"""Status transition tables for the three document types (docs/spec.md section 5, decision D5).

Only the MVP transitions are allowed:

    quote    draft -> sent -> signed
    invoice  draft -> issued
    act      draft -> issued

The schema also allows `declined` and `cancelled` (quote), `cancelled` (invoice) and `signed` (act); those moves, and
the client signing an act, are post-MVP and are rejected here until they are added to the table. The payment state of
an invoice (unpaid / partial / paid / overdue) is derived, never stored (see `payments.py`).
"""

from app.domain.errors import InvalidTransition
from app.domain.numbering import DocumentType

# Every status the database accepts (replica/schema.sql check constraints), including the post-MVP ones.
STATUSES: dict[DocumentType, frozenset[str]] = {
    "quote": frozenset({"draft", "sent", "signed", "declined", "cancelled"}),
    "invoice": frozenset({"draft", "issued", "cancelled"}),
    "act": frozenset({"draft", "issued", "signed", "cancelled"}),
}

TRANSITIONS: dict[DocumentType, dict[str, frozenset[str]]] = {
    "quote": {"draft": frozenset({"sent"}), "sent": frozenset({"signed"})},
    "invoice": {"draft": frozenset({"issued"})},
    "act": {"draft": frozenset({"issued"})},
}

# The status a document has when it leaves draft: the number is assigned and the share link is made on this move.
ISSUED_STATUS: dict[DocumentType, str] = {"quote": "sent", "invoice": "issued", "act": "issued"}

# A quote can be edited while draft or sent; invoices and acts only as drafts (architecture, "Locking").
_EDITABLE: dict[DocumentType, frozenset[str]] = {
    "quote": frozenset({"draft", "sent"}),
    "invoice": frozenset({"draft"}),
    "act": frozenset({"draft"}),
}


def can_transition(document_type: DocumentType, current: str, target: str) -> bool:
    return target in TRANSITIONS[document_type].get(current, frozenset())


def assert_transition(document_type: DocumentType, current: str, target: str) -> None:
    if not can_transition(document_type, current, target):
        raise InvalidTransition(f"{document_type}: {current} -> {target} is not allowed")


def is_editable(document_type: DocumentType, status: str) -> bool:
    return status in _EDITABLE[document_type]


def is_deletable(status: str) -> bool:
    """Only drafts can be deleted; anything else is an accounting record."""
    return status == "draft"
