"""Distinguish fixed prompt content from runtime bindings.

Revision ID: 20260921_05
Revises: 20260921_04
"""
from __future__ import annotations

import re
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260921_05"
down_revision: Union[str, None] = "20260921_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> dict[str, dict[str, Any]]:
    return {
        str(column["name"]): dict(column)
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _checks(table_name: str) -> set[str]:
    return {
        str(check["name"])
        for check in sa.inspect(op.get_bind()).get_check_constraints(table_name)
        if check.get("name")
    }


def _references(value: Any) -> set[tuple[str, str]]:
    if isinstance(value, str):
        return {
            (match.group(1), match.group(2))
            for match in re.finditer(r"\{\{\s*([\w]+)\.([\w]+)\s*\}\}", value)
        }
    if isinstance(value, list):
        return set().union(*(_references(item) for item in value))
    if isinstance(value, dict):
        return set().union(*(_references(item) for item in value.values()))
    return set()


def upgrade() -> None:
    if "prompt_resources" not in _tables():
        return
    bind = op.get_bind()
    columns = _columns("prompt_resources")
    if "type" not in columns:
        op.add_column(
            "prompt_resources", sa.Column("type", sa.String(32), nullable=True)
        )
    if "row_key" not in columns:
        op.add_column(
            "prompt_resources", sa.Column("row_key", sa.String(255), nullable=True)
        )
    if "fields" not in columns:
        op.add_column(
            "prompt_resources", sa.Column("fields", sa.JSON(), nullable=True)
        )

    resources = sa.Table("prompt_resources", sa.MetaData(), autoload_with=bind)
    templates = sa.Table("payload_templates", sa.MetaData(), autoload_with=bind)
    conditions = (
        sa.Table("prompt_resource_conditions", sa.MetaData(), autoload_with=bind)
        if "prompt_resource_conditions" in _tables()
        else None
    )
    payloads = {
        int(row["id"]): row["payload"]
        for row in bind.execute(
            sa.select(templates.c.id, templates.c.payload)
        ).mappings()
    }
    condition_rows: dict[int, list[dict[str, Any]]] = {}
    if conditions is not None:
        for row in bind.execute(sa.select(conditions)).mappings():
            condition_rows.setdefault(int(row["prompt_resource_id"]), []).append(
                dict(row)
            )

    for row in bind.execute(sa.select(resources)).mappings():
        item = dict(row)
        previous_conditions = condition_rows.get(int(item["id"]), [])
        fixed_id = next(
            (
                str(condition["value"])
                for condition in previous_conditions
                if condition["field_name"] == "id"
                and condition["operator"] == "equals"
                and condition["value_type"] == "manual"
            ),
            None,
        )
        resource_type = item.get("type") or (
            "content" if fixed_id is not None or item["source_table"] == "assets" else "binding"
        )
        row_id = item.get("row_key") or fixed_id
        if resource_type == "content" and row_id is None:
            raise RuntimeError(
                "Prompt resource "
                f"{item['id']} ({item['name']}) is fixed content but has no stable row ID."
            )
        referenced_fields = sorted(
            field
            for name, field in _references(payloads.get(int(item["payload_template_id"]), {}))
            if name == str(item["name"])
        )
        fields = list(item.get("fields") or referenced_fields or ["id"])
        bind.execute(
            resources.update()
            .where(resources.c.id == item["id"])
            .values(
                type=resource_type,
                row_key=(str(row_id) if resource_type == "content" else None),
                fields=fields,
            )
        )

    columns = _columns("prompt_resources")
    checks = _checks("prompt_resources")
    needs_alter = columns["type"]["nullable"] or columns["fields"]["nullable"]
    missing_type_check = "ck_prompt_resources_type" not in checks
    missing_target_check = "ck_prompt_resources_target" not in checks
    if op.get_context().dialect.name == "sqlite" and (
        needs_alter or missing_type_check or missing_target_check
    ):
        with op.batch_alter_table("prompt_resources") as batch:
            batch.alter_column("type", nullable=False, server_default="binding")
            batch.alter_column("fields", nullable=False, server_default="[]")
            if missing_type_check:
                batch.create_check_constraint(
                    "ck_prompt_resources_type", "type IN ('content', 'binding')"
                )
            if missing_target_check:
                batch.create_check_constraint(
                    "ck_prompt_resources_target",
                    "(type = 'content' AND row_key IS NOT NULL) OR "
                    "(type = 'binding' AND row_key IS NULL)",
                )
    else:
        if columns["type"]["nullable"]:
            op.alter_column(
                "prompt_resources", "type", nullable=False, server_default="binding"
            )
        if columns["fields"]["nullable"]:
            op.alter_column(
                "prompt_resources", "fields", nullable=False, server_default="[]"
            )
        if missing_type_check:
            op.create_check_constraint(
                "ck_prompt_resources_type",
                "prompt_resources",
                "type IN ('content', 'binding')",
            )
        if missing_target_check:
            op.create_check_constraint(
                "ck_prompt_resources_target",
                "prompt_resources",
                "(type = 'content' AND row_key IS NOT NULL) OR "
                "(type = 'binding' AND row_key IS NULL)",
            )


def downgrade() -> None:
    raise RuntimeError(
        "Prompt resource type migration is intentionally irreversible."
    )
