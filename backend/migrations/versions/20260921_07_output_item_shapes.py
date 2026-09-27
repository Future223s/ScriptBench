"""Replace output transport types with item shapes.

Revision ID: 20260921_07
Revises: 20260921_06
"""
from __future__ import annotations

from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260921_07"
down_revision: Union[str, None] = "20260921_06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _shape(output_type: str, schema: Any) -> dict[str, Any]:
    if output_type == "plain-text":
        return {"type": "string"}
    if isinstance(schema, dict) and schema.get("type") in {"string", "object"}:
        return schema
    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    properties = {
        str(field["name"]): {
            "type": "string",
            "required": True,
            **({"description": str(field["description"])} if field.get("description") else {}),
        }
        for field in fields
        if isinstance(field, dict) and str(field.get("name") or "").strip()
    }
    return {"type": "object", "properties": properties}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "output_specs" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("output_specs")}
    if "type" not in columns:
        return
    table = sa.Table("output_specs", sa.MetaData(), autoload_with=bind)
    for row in bind.execute(sa.select(table)).mappings():
        bind.execute(
            table.update().where(table.c.id == row["id"]).values(
                item_schema=_shape(str(row["type"]), row.get("item_schema"))
            )
        )
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("output_specs") as batch:
            batch.alter_column("item_schema", nullable=False, server_default='{"type":"string"}')
            batch.drop_column("type")
    else:
        indexes = {index["name"] for index in inspector.get_indexes("output_specs")}
        checks = {check["name"] for check in inspector.get_check_constraints("output_specs")}
        if "ix_output_specs_type" in indexes:
            op.drop_index("ix_output_specs_type", table_name="output_specs")
        if "ck_output_specs_type" in checks:
            op.drop_constraint("ck_output_specs_type", "output_specs", type_="check")
        op.alter_column("output_specs", "item_schema", nullable=False, server_default='{"type":"string"}')
        op.drop_column("output_specs", "type")


def downgrade() -> None:
    raise RuntimeError("Output item-shape migration is intentionally irreversible.")
