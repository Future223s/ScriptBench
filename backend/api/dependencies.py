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
from backend.database.tables.artifact_groups_table import artifact_groups  # noqa: F401
from backend.database.tables.artifacts_table import artifacts  # noqa: F401
from backend.database.tables.assets_table import assets  # noqa: F401
from backend.database.tables.execution_rows_table import execution_rows  # noqa: F401
from backend.database.tables.membership_mapping_table import membership_mapping  # noqa: F401
from backend.database.tables.object_uploads_table import object_uploads  # noqa: F401
from backend.database.tables.payload_inputs_table import payload_inputs  # noqa: F401
from backend.database.tables.payload_templates_table import payload_templates  # noqa: F401
from backend.database.tables.output_specs_table import output_specs  # noqa: F401
from backend.database.tables.sample_mapping_table import sample_mapping  # noqa: F401
from backend.database.tables.sample_set_samples_table import sample_set_samples  # noqa: F401
from backend.database.tables.sample_sets_table import sample_sets  # noqa: F401
from backend.database.tables.samples_table import samples  # noqa: F401
from backend.database.tables.workflow_steps_table import workflow_steps  # noqa: F401
from backend.database.tables.workflow_dag_edges_table import workflow_dag_edges  # noqa: F401
from backend.database.tables.workflow_dag_nodes_table import workflow_dag_nodes  # noqa: F401
from backend.database.tables.workflows_table import workflows  # noqa: F401
from backend.services.file_upload_worker import FileUploadWorker
from backend.services.upload_events import FileUploadEventHub

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


def _ensure_samples_blob_nullable(engine: Engine) -> None:
    inspector = inspect(engine)
    if "samples" not in inspector.get_table_names():
        return

    columns = {column["name"]: column for column in inspector.get_columns("samples")}
    sample_blob = columns.get("sample_blob")
    sample_mime_type = columns.get("sample_mime_type")
    if sample_blob is None or sample_mime_type is None:
        return
    if bool(sample_blob.get("nullable")) and bool(sample_mime_type.get("nullable")):
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE samples RENAME TO samples__legacy"))
        conn.execute(
            text(
                """
                CREATE TABLE samples (
                    sample_id VARCHAR(255) NOT NULL PRIMARY KEY,
                    sample_name VARCHAR(255) NOT NULL,
                    sample_blob BLOB NULL,
                    sample_mime_type VARCHAR(255) NULL,
                    ground_truth_text TEXT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(text("CREATE UNIQUE INDEX uq_samples_sample_name_migrated ON samples (sample_name)"))
        conn.execute(
            text(
                """
                INSERT INTO samples (
                    sample_id,
                    sample_name,
                    sample_blob,
                    sample_mime_type,
                    ground_truth_text,
                    created_at,
                    updated_at
                )
                SELECT
                    sample_id,
                    sample_name,
                    sample_blob,
                    sample_mime_type,
                    ground_truth_text,
                    created_at,
                    updated_at
                FROM samples__legacy
                """
            )
        )
        conn.execute(text("DROP TABLE samples__legacy"))


def _ensure_assets_blob_nullable(engine: Engine) -> None:
    inspector = inspect(engine)
    if "assets" not in inspector.get_table_names():
        return

    columns = {column["name"]: column for column in inspector.get_columns("assets")}
    asset_blob = columns.get("asset_blob")
    asset_mime_type = columns.get("asset_mime_type")
    if asset_blob is None or asset_mime_type is None:
        return
    if bool(asset_blob.get("nullable")) and bool(asset_mime_type.get("nullable")):
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE assets RENAME TO assets__legacy"))
        conn.execute(
            text(
                """
                CREATE TABLE assets (
                    asset_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    asset_name VARCHAR(255) NOT NULL,
                    asset_type VARCHAR(255) NOT NULL,
                    asset_blob BLOB NULL,
                    asset_mime_type VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(text("CREATE UNIQUE INDEX uq_assets_asset_name_migrated ON assets (asset_name)"))
        conn.execute(text("CREATE INDEX ix_assets_asset_name_migrated ON assets (asset_name)"))
        conn.execute(text("CREATE INDEX ix_assets_asset_type_migrated ON assets (asset_type)"))
        conn.execute(
            text(
                """
                INSERT INTO assets (
                    asset_id,
                    asset_name,
                    asset_type,
                    asset_blob,
                    asset_mime_type,
                    created_at,
                    updated_at
                )
                SELECT
                    asset_id,
                    asset_name,
                    asset_type,
                    asset_blob,
                    asset_mime_type,
                    created_at,
                    updated_at
                FROM assets__legacy
                """
            )
        )
        conn.execute(text("DROP TABLE assets__legacy"))

@lru_cache(maxsize=1)
def get_engine() -> Engine:
    with _engine_lock:
        database_url_or_path = os.getenv("DATABASE_URL", _default_database_path)
        engine = make_engine(database_url_or_path)
        metadata.create_all(engine)
        _ensure_samples_blob_nullable(engine)
        _ensure_assets_blob_nullable(engine)
        return engine

def get_upload_event_hub(request: Request) -> FileUploadEventHub | None:
    hub = getattr(request.app.state, "file_upload_event_hub", None)
    if not isinstance(hub, FileUploadEventHub):
        hub = FileUploadEventHub()
        request.app.state.file_upload_event_hub = hub
    return hub


def get_file_upload_worker(request: Request) -> FileUploadWorker | None:
    worker = getattr(request.app.state, "file_upload_worker", None)
    if not isinstance(worker, FileUploadWorker):
        return None
    return worker
