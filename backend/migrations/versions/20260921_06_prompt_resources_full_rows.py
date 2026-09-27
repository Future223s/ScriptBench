"""Resolve complete prompt-resource rows at runtime.

Revision ID: 20260921_06
Revises: 20260921_05
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260921_06"
down_revision: Union[str, None] = "20260921_05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "prompt_resources" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("prompt_resources")}
    if "fields" not in columns:
        return
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("prompt_resources") as batch:
            batch.drop_column("fields")
    else:
        op.drop_column("prompt_resources", "fields")


def downgrade() -> None:
    raise RuntimeError(
        "Prompt resources now resolve complete rows; field allowlists cannot be restored."
    )
