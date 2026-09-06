from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, TypeAlias


FileTransport: TypeAlias = Literal["auto", "inline", "uploaded"]


@dataclass
class File:
    """A deferred provider-file upload request.

    ``source_type`` and ``source_id`` identify what the orchestrator should
    fetch. The client does not interpret either field. ``uploaded_ref`` and
    ``uploaded_at`` are transaction data that the orchestrator may persist
    after the client refreshes the file.
    """

    source_type: str
    source_id: str
    mime_type: str
    blob: bytes | None = None
    transport: FileTransport = "auto"
    uploaded_ref: str | None = None
    uploaded_uri: str | None = None
    uploaded_at: datetime | None = None

