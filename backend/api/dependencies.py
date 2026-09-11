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
from sqlalchemy.engine import Engine

from backend.database.engine import make_engine
from backend.database.schema import metadata
from backend.database.tables.derivative_groups_table import derivative_groups  # noqa: F401
from backend.database.tables.derivatives_table import derivatives  # noqa: F401
from backend.database.tables.assets_table import assets  # noqa: F401
from backend.database.tables.execution_jobs_table import execution_jobs  # noqa: F401
from backend.database.tables.membership_mapping_table import (
    membership_mapping,
)  # noqa: F401
from backend.database.tables.step_outputs_table import step_outputs  # noqa: F401
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
from backend.database.repositories.execution_jobs_repository import ExecutionJobsRepository

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


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    with _engine_lock:
        database_url_or_path = os.getenv("DATABASE_URL", _default_database_path)
        engine = make_engine(database_url_or_path)
        metadata.create_all(engine)
        from backend.services.step_executor_catalog import seed_step_executors
        with engine.begin() as connection:
            seed_step_executors(connection)
        ExecutionJobsRepository(engine).recover_interrupted_jobs()
        return engine
