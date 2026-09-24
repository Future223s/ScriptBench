"""Allow document records to be selected as prompt resources.

Revision ID: 20260920_02
Revises: 20260920_01
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260920_02"
down_revision: Union[str, None] = "20260920_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CHECK_SQL = "source_table IN ('assets', 'documents', 'derivatives', 'samples', 'step_outputs')"


def upgrade() -> None:
    checks = sa.inspect(op.get_bind()).get_check_constraints("prompt_resources")
    current = next(
        (item for item in checks if item.get("name") == "ck_prompt_resources_source_table"),
        None,
    )
    if current is not None and "documents" in str(current.get("sqltext", "")):
        return
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("prompt_resources") as batch:
            if current is not None:
                batch.drop_constraint("ck_prompt_resources_source_table", type_="check")
            batch.create_check_constraint("ck_prompt_resources_source_table", CHECK_SQL)
        return
    if current is not None:
        op.drop_constraint(
            "ck_prompt_resources_source_table", "prompt_resources", type_="check"
        )
    op.create_check_constraint(
        "ck_prompt_resources_source_table", "prompt_resources", CHECK_SQL
    )


def downgrade() -> None:
    raise RuntimeError("Document prompt resources may contain data; downgrade is unsafe.")
