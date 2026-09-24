"""Score previously published text outputs at sample granularity.

Revision ID: 20260921_08
Revises: 20260921_07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from backend.services.scoring import compute_metrics

revision: str = "20260921_08"
down_revision: Union[str, None] = "20260921_07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    outputs = sa.Table("step_outputs", metadata, autoload_with=bind)
    samples = sa.Table("samples", metadata, autoload_with=bind)
    rows = bind.execute(
        sa.select(
            outputs.c.id,
            outputs.c.output,
            samples.c.ground_truth_text,
        )
        .select_from(outputs.join(samples, outputs.c.sample_id == samples.c.id))
        .where(
            outputs.c.entity_type == "sample",
            outputs.c.cer.is_(None),
            outputs.c.wer.is_(None),
            samples.c.ground_truth_text.is_not(None),
        )
    ).mappings()
    for row in rows:
        if not isinstance(row["output"], str):
            continue
        metrics = compute_metrics(row["ground_truth_text"], row["output"])
        bind.execute(
            outputs.update().where(outputs.c.id == row["id"]).values(
                cer=metrics.cer,
                wer=metrics.wer,
            )
        )


def downgrade() -> None:
    # Existing scores cannot be distinguished from scores created by this migration.
    pass
