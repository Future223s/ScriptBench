from __future__ import annotations

import base64
import os
from functools import lru_cache
from pathlib import Path
from threading import Lock
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from backend.database.engine import make_engine
from backend.database.schema import metadata
from backend.database.tables.sample_set_samples_table import sample_set_samples  # noqa: F401
from backend.database.tables.sample_sets_table import sample_sets  # noqa: F401
from backend.database.tables.sample_uploads_table import sample_uploads  # noqa: F401
from backend.database.tables.samples_table import samples  # noqa: F401
from backend.database.tables.transcription_job_samples_table import transcription_job_samples  # noqa: F401
from backend.database.tables.transcription_jobs_table import transcription_jobs  # noqa: F401
from backend.database.tables.transcriptions_table import transcriptions  # noqa: F401
from backend.database.tables.workflow_metrics_table import workflow_metrics  # noqa: F401
from backend.database.tables.workflow_samples_table import workflow_samples  # noqa: F401
from backend.database.tables.workflows_table import workflows  # noqa: F401
from backend.services.job_events import JobEventHub

_engine_lock = Lock()
_repo_root = Path(__file__).resolve().parents[2]
_default_database_path = _repo_root / "backend" / "database" / "economic_upheaval.db"


def json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def row_to_dict(row: Any, exclude: set[str] | None = None) -> dict[str, Any]:
    mapping = getattr(row, "_mapping", row)
    excluded = exclude or set()
    return {
        str(key): json_safe(value)
        for key, value in dict(mapping).items()
        if key not in excluded
    }


def rows_to_dicts(rows: Sequence[Any], exclude: set[str] | None = None) -> list[dict[str, Any]]:
    return [row_to_dict(row, exclude=exclude) for row in rows]


def cap_values(values: Sequence[str], limit: int) -> list[str]:
    return list(values[:limit])


def _ensure_workflows_sample_set_id_column(engine: Engine) -> None:
    inspector = inspect(engine)
    workflow_columns = {column["name"] for column in inspector.get_columns("workflows")}
    if "sample_set_id" in workflow_columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE workflows ADD COLUMN sample_set_id INTEGER"))


def _ensure_transcriptions_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    transcription_columns = {column["name"] for column in inspector.get_columns("transcriptions")}
    missing_columns: list[str] = []

    column_definitions = {
        "job_id": "job_id INTEGER",
        "sample_ids": "sample_ids JSON",
        "sample_set_id": "sample_set_id INTEGER",
        "group_name": "group_name VARCHAR(255)",
        "group_value": "group_value VARCHAR(255)",
        "output_index": "output_index INTEGER",
        "cer": "cer FLOAT",
        "wer": "wer FLOAT",
        "hallucinations": "hallucinations FLOAT",
        "line_omission_count": "line_omission_count FLOAT",
        "line_addition_count": "line_addition_count FLOAT",
    }

    for column_name, column_definition in column_definitions.items():
        if column_name not in transcription_columns:
            missing_columns.append(column_definition)

    if not missing_columns:
        return

    with engine.begin() as conn:
        for column_definition in missing_columns:
            conn.execute(text(f"ALTER TABLE transcriptions ADD COLUMN {column_definition}"))


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    with _engine_lock:
        database_url_or_path = os.getenv("DATABASE_URL", _default_database_path)
        engine = make_engine(database_url_or_path)
        metadata.create_all(engine)
        _ensure_workflows_sample_set_id_column(engine)
        _ensure_transcriptions_columns(engine)
        return engine


def get_job_event_hub(request: Request) -> JobEventHub | None:
    hub = getattr(request.app.state, "job_event_hub", None)
    if not isinstance(hub, JobEventHub):
        hub = JobEventHub()
        request.app.state.job_event_hub = hub
    return hub
