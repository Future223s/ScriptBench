from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.workflow_metrics_table import workflow_metrics


class WorkflowMetricsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def upsert_workflow_metrics(
        self,
        *,
        workflow_id: int,
        scorer: str | None = None,
        sample_count: int | None = None,
        cer: float | None = None,
        wer: float | None = None,
        hallucinations: float | None = None,
        line_omission_count: float | None = None,
        line_addition_count: float | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        insert_stmt = (
            postgresql_insert(workflow_metrics)
            if self.engine.dialect.name == "postgresql"
            else sqlite_insert(workflow_metrics)
        )
        stmt = insert_stmt.values(
            workflow_id=workflow_id,
            scorer=scorer,
            sample_count=sample_count,
            cer=cer,
            wer=wer,
            hallucinations=hallucinations,
            line_omission_count=line_omission_count,
            line_addition_count=line_addition_count,
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[workflow_metrics.c.workflow_id],
            set_={
                "scorer": stmt.excluded.scorer,
                "sample_count": stmt.excluded.sample_count,
                "cer": stmt.excluded.cer,
                "wer": stmt.excluded.wer,
                "hallucinations": stmt.excluded.hallucinations,
                "line_omission_count": stmt.excluded.line_omission_count,
                "line_addition_count": stmt.excluded.line_addition_count,
                "updated_at": now,
            },
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)

    def fetch_workflow_metrics(self, workflow_id: int) -> RowMapping | None:
        stmt = select(workflow_metrics).where(workflow_metrics.c.workflow_id == workflow_id)
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row
