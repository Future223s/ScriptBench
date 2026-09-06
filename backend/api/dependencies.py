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
from sqlalchemy import insert, inspect, text
from sqlalchemy.engine import Engine

from backend.database.engine import make_engine
from backend.database.schema import metadata
from backend.database.tables.artifact_groups_table import artifact_groups  # noqa: F401
from backend.database.tables.artifacts_table import artifacts  # noqa: F401
from backend.database.tables.assets_table import assets  # noqa: F401
from backend.database.tables.execution_jobs_table import execution_jobs  # noqa: F401
from backend.database.tables.membership_mapping_table import (
    membership_mapping,
)  # noqa: F401
from backend.database.tables.model_outputs_table import model_outputs  # noqa: F401
from backend.database.tables.step_outputs_table import step_outputs  # noqa: F401
from backend.database.tables.object_uploads_table import object_uploads  # noqa: F401
from backend.database.tables.payload_templates_table import (
    payload_templates,
)  # noqa: F401
from backend.database.tables.prompt_resources_table import (
    prompt_resources,
)  # noqa: F401
from backend.database.tables.prompt_resource_conditions_table import (
    prompt_resource_conditions,
)  # noqa: F401
from backend.database.tables.output_specs_table import output_specs  # noqa: F401
from backend.database.tables.sample_mapping_table import sample_mapping  # noqa: F401
from backend.database.tables.sample_set_samples_table import (
    sample_set_samples,
)  # noqa: F401
from backend.database.tables.sample_sets_table import sample_sets  # noqa: F401
from backend.database.tables.samples_table import samples  # noqa: F401
from backend.database.tables.workflow_steps_table import workflow_steps  # noqa: F401
from backend.database.tables.workflow_dag_edges_table import (
    workflow_dag_edges,
)  # noqa: F401
from backend.database.tables.workflow_dag_nodes_table import (
    workflow_dag_nodes,
)  # noqa: F401
from backend.database.tables.workflows_table import workflows  # noqa: F401

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
        conn.execute(
            text(
                "CREATE UNIQUE INDEX uq_samples_sample_name_migrated ON samples (sample_name)"
            )
        )
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
        conn.execute(
            text(
                "CREATE UNIQUE INDEX uq_assets_asset_name_migrated ON assets (asset_name)"
            )
        )
        conn.execute(
            text("CREATE INDEX ix_assets_asset_name_migrated ON assets (asset_name)")
        )
        conn.execute(
            text("CREATE INDEX ix_assets_asset_type_migrated ON assets (asset_type)")
        )
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


def _ensure_workflow_dag_node_positions(engine: Engine) -> None:
    inspector = inspect(engine)
    if "workflow_dag_nodes" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("workflow_dag_nodes")}
    if "workflow_step_id" not in columns:
        with engine.begin() as conn:
            node_count = int(
                conn.execute(
                    text("SELECT COUNT(*) FROM workflow_dag_nodes")
                ).scalar_one()
            )
            edge_count = (
                int(
                    conn.execute(
                        text("SELECT COUNT(*) FROM workflow_dag_edges")
                    ).scalar_one()
                )
                if "workflow_dag_edges" in inspector.get_table_names()
                else 0
            )
            if node_count or edge_count:
                raise RuntimeError(
                    "Cannot migrate populated legacy workflow_dag_nodes table without workflow_step_id"
                )
            conn.execute(text("DROP TABLE workflow_dag_nodes"))
        workflow_dag_nodes.create(engine, checkfirst=True)
        return

    if "row" not in columns or "col" not in columns or "updated_at" not in columns:
        with engine.begin() as conn:
            if "row" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE workflow_dag_nodes ADD COLUMN row INTEGER NOT NULL DEFAULT 1"
                    )
                )
            if "col" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE workflow_dag_nodes ADD COLUMN col INTEGER NOT NULL DEFAULT 1"
                    )
                )
            if "updated_at" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE workflow_dag_nodes ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    )
                )


def _ensure_execution_status_model(engine: Engine) -> None:
    """Migrate legacy execution status checks and values for SQLite databases."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if not {"execution_rows", "execution_jobs"}.issubset(table_names):
        return

    with engine.connect() as connection:
        row_check = connection.execute(
            text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='execution_rows'"
            )
        ).scalar_one_or_none()
        job_check = connection.execute(
            text(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='execution_jobs'"
            )
        ).scalar_one_or_none()
    if (
        "not_started" not in str(row_check)
        and "in_progress" not in str(row_check)
        and "not_started" not in str(job_check)
        and "in_progress" not in str(job_check)
    ):
        return

    from backend.database.tables.execution_jobs_table import execution_jobs
    from backend.database.tables.execution_rows_table import execution_rows

    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        try:
            legacy_rows = [
                dict(row)
                for row in connection.execute(text("SELECT * FROM execution_rows"))
                .mappings()
                .all()
            ]
            legacy_jobs = [
                dict(row)
                for row in connection.execute(text("SELECT * FROM execution_jobs"))
                .mappings()
                .all()
            ]
            for row in legacy_rows:
                if row["status"] in {"not_started", "in_progress"}:
                    row["status"] = "pending"
            for job in legacy_jobs:
                if job["status"] == "not_started":
                    job["status"] = "queued"
                elif job["status"] == "in_progress":
                    job["status"] = "failed"

            for table_name in (
                "model_outputs",
                "step_outputs",
                "execution_jobs",
                "execution_rows",
            ):
                for index in inspect(connection).get_indexes(table_name):
                    connection.execute(text(f'DROP INDEX IF EXISTS "{index["name"]}"'))

            legacy_model_outputs = [
                dict(row)
                for row in connection.execute(text("SELECT * FROM model_outputs"))
                .mappings()
                .all()
            ]
            legacy_step_outputs = [
                dict(row)
                for row in connection.execute(text("SELECT * FROM step_outputs"))
                .mappings()
                .all()
            ]

            connection.execute(
                text("ALTER TABLE model_outputs RENAME TO model_outputs__status_legacy")
            )
            connection.execute(
                text("ALTER TABLE step_outputs RENAME TO step_outputs__status_legacy")
            )
            connection.execute(
                text(
                    "ALTER TABLE execution_jobs RENAME TO execution_jobs__status_legacy"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE execution_rows RENAME TO execution_rows__status_legacy"
                )
            )
            connection.execute(text("DROP TABLE model_outputs__status_legacy"))
            connection.execute(text("DROP TABLE step_outputs__status_legacy"))
            connection.execute(text("DROP TABLE execution_jobs__status_legacy"))
            connection.execute(text("DROP TABLE execution_rows__status_legacy"))

            execution_rows.create(connection)
            execution_jobs.create(connection)
            model_outputs.create(connection)
            step_outputs.create(connection)
            if legacy_rows:
                connection.execute(insert(execution_rows), legacy_rows)
            if legacy_jobs:
                connection.execute(insert(execution_jobs), legacy_jobs)
            if legacy_model_outputs:
                connection.execute(insert(model_outputs), legacy_model_outputs)
            if legacy_step_outputs:
                connection.execute(insert(step_outputs), legacy_step_outputs)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")


def _ensure_execution_scope(engine: Engine) -> None:
    inspector = inspect(engine)
    if "execution_rows" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("execution_rows")}
    if "execution_scope" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE execution_rows ADD COLUMN execution_scope VARCHAR(32) NOT NULL DEFAULT 'source'"
                )
            )


def _ensure_execution_row_error_message(engine: Engine) -> None:
    inspector = inspect(engine)
    if "execution_rows" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("execution_rows")}
    if "error_message" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE execution_rows ADD COLUMN error_message TEXT")
            )


def _ensure_model_output_metrics(engine: Engine) -> None:
    inspector = inspect(engine)
    if "model_outputs" not in inspector.get_table_names():
        return
    existing_columns = {
        column["name"] for column in inspector.get_columns("model_outputs")
    }
    additions = {
        "cer": "FLOAT",
        "wer": "FLOAT",
        "hallucination_count": "INTEGER",
    }
    missing = [
        (name, sql_type)
        for name, sql_type in additions.items()
        if name not in existing_columns
    ]
    with engine.begin() as connection:
        for name, sql_type in missing:
            connection.execute(
                text(f'ALTER TABLE model_outputs ADD COLUMN "{name}" {sql_type}')
            )
        connection.execute(text("UPDATE model_outputs SET hallucination_count = NULL"))


def _normalize_execution_job_statuses(engine: Engine) -> None:
    """Convert retired execution statuses in existing databases."""
    if "execution_jobs" not in inspect(engine).get_table_names():
        return
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE execution_jobs SET status = 'pending' "
                "WHERE status = 'skipped'"
            )
        )


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    with _engine_lock:
        database_url_or_path = os.getenv("DATABASE_URL", _default_database_path)
        engine = make_engine(database_url_or_path)
        metadata.create_all(engine)
        _ensure_samples_blob_nullable(engine)
        _ensure_assets_blob_nullable(engine)
        _ensure_workflow_dag_node_positions(engine)
        _normalize_execution_job_statuses(engine)
        _ensure_model_output_metrics(engine)
        return engine
