"""Record JSON repair provenance for raw model outputs.

Revision ID: 20260927_10
Revises: 20260927_09
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260927_10"
down_revision: Union[str, None] = "20260927_09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names() -> set[str]:
    return {
        str(column["name"])
        for column in sa.inspect(op.get_bind()).get_columns("raw_outputs")
    }


def upgrade() -> None:
    columns = _column_names()
    if "repair_applied" not in columns:
        op.add_column(
            "raw_outputs",
            sa.Column(
                "repair_applied",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "repair_details" not in columns:
        op.add_column(
            "raw_outputs",
            sa.Column("repair_details", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    columns = _column_names()
    if "repair_details" in columns:
        op.drop_column("raw_outputs", "repair_details")
    if "repair_applied" in columns:
        op.drop_column("raw_outputs", "repair_applied")
