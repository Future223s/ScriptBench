"""Increase workflow canvas coordinate granularity.

Revision ID: 20260927_09
Revises: 20260921_08
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260927_09"
down_revision: Union[str, None] = "20260921_08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    nodes = sa.Table("workflow_dag_nodes", sa.MetaData(), autoload_with=bind)
    bind.execute(
        nodes.update().values(row=nodes.c.row * 3, col=nodes.c.col * 3)
    )


def downgrade() -> None:
    bind = op.get_bind()
    nodes = sa.Table("workflow_dag_nodes", sa.MetaData(), autoload_with=bind)
    bind.execute(
        nodes.update().values(
            row=sa.cast(nodes.c.row / 3, sa.Integer),
            col=sa.cast(nodes.c.col / 3, sa.Integer),
        )
    )
