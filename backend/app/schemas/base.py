"""The base of every wire model: Python snake_case fields, camelCase JSON (replica/architecture.md, Wire format)."""

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Reads camelCase (or snake_case, for code) and, serialised `by_alias`, writes camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    def to_wire(self) -> dict[str, Any]:
        """The JSON-ready dict with camelCase keys."""
        return self.model_dump(mode="json", by_alias=True)
