from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.transcriptions_table import transcriptions
from ..tables.transcription_job_samples_table import transcription_job_samples
from ..tables.transcription_jobs_table import transcription_jobs
from ..tables.workflow_metrics_table import workflow_metrics
from ..tables.workflows_table import workflows


class WorkflowsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert_workflow(
        self,
        *,
        workflow_name: str,
        workflow_stage: str,
        sample_set_id: int | None = None,
        model_family: str,
        model: str | None,
        groups: list[str] | None,
        status: str,
        prompt_spec: Mapping[str, Any],
    ) -> int:
        now = datetime.now(timezone.utc)
        stmt = workflows.insert().values(
            workflow_name=workflow_name,
            workflow_stage=workflow_stage,
            sample_set_id=sample_set_id,
            model_family=model_family,
            model=model,
            groups=list(groups or []),
            prompt_spec=dict(prompt_spec),
            status=status,
            created_at=now,
            updated_at=now,
        )
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
            return int(result.inserted_primary_key[0])

    def fetch_workflow(self, workflow_id: int) -> RowMapping | None:
        stmt = select(workflows).where(workflows.c.workflow_id == workflow_id)
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def list_workflows(self) -> list[RowMapping]:
        stmt = select(workflows).order_by(
            workflows.c.updated_at.desc(),
            workflows.c.workflow_id.desc(),
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def list_workflows_for_sample_set(self, sample_set_id: int) -> list[RowMapping]:
        stmt = (
            select(workflows)
            .where(workflows.c.sample_set_id == sample_set_id)
            .order_by(workflows.c.updated_at.desc(), workflows.c.workflow_id.desc())
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def delete_workflow(self, workflow_id: int) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                delete(workflow_metrics).where(
                    workflow_metrics.c.workflow_id == workflow_id
                )
            )
            transcriptions_deleted = conn.execute(
                delete(transcriptions).where(transcriptions.c.workflow_id == workflow_id)
            ).rowcount

            transcription_job_samples_deleted = conn.execute(
                delete(transcription_job_samples).where(
                    transcription_job_samples.c.job_id.in_(
                        select(transcription_jobs.c.job_id).where(
                            transcription_jobs.c.workflow_id == workflow_id
                        )
                    )
                )
            ).rowcount

            transcription_jobs_deleted = conn.execute(
                delete(transcription_jobs).where(transcription_jobs.c.workflow_id == workflow_id)
            ).rowcount

            # `workflow_samples` was retired during the sample-set migration.
            workflow_samples_deleted = 0

            workflows_deleted = conn.execute(
                delete(workflows).where(workflows.c.workflow_id == workflow_id)
            ).rowcount

            return {
                "transcriptions_deleted": transcriptions_deleted,
                "transcription_job_samples_deleted": transcription_job_samples_deleted,
                "transcription_jobs_deleted": transcription_jobs_deleted,
                "workflow_samples_deleted": workflow_samples_deleted,
                "workflows_deleted": workflows_deleted,
            }

    def delete_workspace_jobs(self, workflow_id: int, *, kind: str) -> dict[str, int]:
        status_groups = {
            "pending": {"pending"},
            "queued": {"queued", "running"},
            "completed": {"completed", "failed"},
            "all": {"pending", "queued", "running", "completed", "failed"},
        }
        statuses = status_groups.get(kind)
        if statuses is None:
            raise ValueError(f"Unknown workspace job kind: {kind}")

        job_filter = transcription_jobs.c.workflow_id == workflow_id
        job_filter = job_filter & transcription_jobs.c.status.in_(statuses)
        job_ids = select(transcription_jobs.c.job_id).where(job_filter)

        with self.engine.begin() as conn:
            transcriptions_deleted = conn.execute(
                delete(transcriptions).where(transcriptions.c.job_id.in_(job_ids))
            ).rowcount
            transcription_job_samples_deleted = conn.execute(
                delete(transcription_job_samples).where(
                    transcription_job_samples.c.job_id.in_(job_ids)
                )
            ).rowcount
            transcription_jobs_deleted = conn.execute(
                delete(transcription_jobs).where(job_filter)
            ).rowcount

        return {
            "transcriptions_deleted": int(transcriptions_deleted or 0),
            "transcription_job_samples_deleted": int(transcription_job_samples_deleted or 0),
            "transcription_jobs_deleted": int(transcription_jobs_deleted or 0),
        }

    def mark_workflow_opened(self, workflow_id: int) -> None:
        stmt = (
            workflows.update()
            .where(workflows.c.workflow_id == workflow_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)
