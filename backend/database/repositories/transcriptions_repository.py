from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.engine.row import RowMapping

from ..tables.transcriptions_table import transcriptions


class TranscriptionsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def upsert_transcription(
        self,
        *,
        workflow_id: int,
        sample_id: str | None,
        transcription_text: str,
        metrics: Mapping[str, Any] | None = None,
        job_id: int | None = None,
        sample_set_id: int | None = None,
        sample_ids: list[str] | None = None,
        group_name: str | None = None,
        group_value: str | None = None,
        output_index: int | None = None,
        cer: float | None = None,
        wer: float | None = None,
        hallucinations: float | None = None,
        line_omission_count: float | None = None,
        line_addition_count: float | None = None,
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        created_at = created_at or now
        updated_at = updated_at or now

        insert_stmt = (
            postgresql_insert(transcriptions)
            if self.engine.dialect.name == "postgresql"
            else sqlite_insert(transcriptions)
        )
        stmt = insert_stmt.values(
            workflow_id=workflow_id,
            sample_id=sample_id,
            job_id=job_id,
            sample_set_id=sample_set_id,
            sample_ids=list(sample_ids or []),
            group_name=group_name,
            group_value=group_value,
            output_index=output_index,
            transcription_text=transcription_text,
            metrics=dict(metrics) if metrics is not None else None,
            cer=cer,
            wer=wer,
            hallucinations=hallucinations,
            line_omission_count=line_omission_count,
            line_addition_count=line_addition_count,
            created_at=created_at,
            updated_at=updated_at,
        )
        if job_id is not None and output_index is not None:
            stmt = stmt.on_conflict_do_update(
                index_elements=[
                    transcriptions.c.workflow_id,
                    transcriptions.c.job_id,
                    transcriptions.c.output_index,
                ],
                set_={
                    "sample_id": stmt.excluded.sample_id,
                    "sample_set_id": stmt.excluded.sample_set_id,
                    "sample_ids": stmt.excluded.sample_ids,
                    "group_name": stmt.excluded.group_name,
                    "group_value": stmt.excluded.group_value,
                    "transcription_text": stmt.excluded.transcription_text,
                    "metrics": stmt.excluded.metrics,
                    "cer": stmt.excluded.cer,
                    "wer": stmt.excluded.wer,
                    "hallucinations": stmt.excluded.hallucinations,
                    "line_omission_count": stmt.excluded.line_omission_count,
                    "line_addition_count": stmt.excluded.line_addition_count,
                    "updated_at": updated_at,
                },
            )
        else:
            stmt = stmt.on_conflict_do_update(
                index_elements=[transcriptions.c.workflow_id, transcriptions.c.sample_id],
                set_={
                    "job_id": stmt.excluded.job_id,
                    "sample_set_id": stmt.excluded.sample_set_id,
                    "sample_ids": stmt.excluded.sample_ids,
                    "group_name": stmt.excluded.group_name,
                    "group_value": stmt.excluded.group_value,
                    "output_index": stmt.excluded.output_index,
                    "transcription_text": stmt.excluded.transcription_text,
                    "metrics": stmt.excluded.metrics,
                    "cer": stmt.excluded.cer,
                    "wer": stmt.excluded.wer,
                    "hallucinations": stmt.excluded.hallucinations,
                    "line_omission_count": stmt.excluded.line_omission_count,
                    "line_addition_count": stmt.excluded.line_addition_count,
                    "updated_at": updated_at,
                },
            )
        with self.engine.begin() as conn:
            result = conn.execute(stmt)
            inserted_primary_key = result.inserted_primary_key
            if inserted_primary_key and inserted_primary_key[0] is not None:
                return int(inserted_primary_key[0])

        row = self.fetch_transcription_by_sample(workflow_id, sample_id)
        if row is None:
            raise RuntimeError("Failed to fetch transcription after upsert")
        return int(row["transcription_id"])

    def fetch_transcription(self, transcription_id: int) -> RowMapping | None:
        stmt = select(transcriptions).where(
            transcriptions.c.transcription_id == transcription_id
        )
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def fetch_transcription_by_sample(
        self,
        workflow_id: int,
        sample_id: str,
    ) -> RowMapping | None:
        stmt = select(transcriptions).where(
            transcriptions.c.workflow_id == workflow_id,
            transcriptions.c.sample_id == sample_id,
        )
        with self.engine.begin() as conn:
            row = conn.execute(stmt).mappings().one_or_none()
        return row

    def fetch_transcriptions_for_workflow(
        self,
        workflow_id: int,
    ) -> list[RowMapping]:
        stmt = (
            select(transcriptions)
            .where(transcriptions.c.workflow_id == workflow_id)
            .order_by(transcriptions.c.output_index, transcriptions.c.transcription_id)
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def fetch_transcriptions_for_job(self, job_id: int) -> list[RowMapping]:
        stmt = (
            select(transcriptions)
            .where(transcriptions.c.job_id == job_id)
            .order_by(transcriptions.c.output_index, transcriptions.c.transcription_id)
        )
        with self.engine.begin() as conn:
            rows = conn.execute(stmt).mappings().all()
        return rows

    def update_transcription_metrics(
        self,
        transcription_id: int,
        *,
        cer: float | None = None,
        wer: float | None = None,
        hallucinations: float | None = None,
        line_omission_count: float | None = None,
        line_addition_count: float | None = None,
        metrics: Mapping[str, Any] | None = None,
    ) -> None:
        fields: dict[str, Any] = {}
        if cer is not None:
            fields["cer"] = cer
        if wer is not None:
            fields["wer"] = wer
        if hallucinations is not None:
            fields["hallucinations"] = hallucinations
        if line_omission_count is not None:
            fields["line_omission_count"] = line_omission_count
        if line_addition_count is not None:
            fields["line_addition_count"] = line_addition_count
        if metrics is not None:
            fields["metrics"] = dict(metrics)
        if not fields:
            return
        fields["updated_at"] = datetime.now(timezone.utc)
        stmt = (
            transcriptions.update()
            .where(transcriptions.c.transcription_id == transcription_id)
            .values(**fields)
        )
        with self.engine.begin() as conn:
            conn.execute(stmt)
