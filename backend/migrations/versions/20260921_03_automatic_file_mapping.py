"""Adopt automatic document/page/derivative filename mapping.

Revision ID: 20260921_03
Revises: 20260920_02
"""
from __future__ import annotations

import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260921_03"
down_revision: Union[str, None] = "20260920_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {
        str(row["name"])
        for row in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _natural_key(value: str) -> tuple[tuple[int, object], ...]:
    return tuple(
        (0, int(part)) if part.isdigit() else (1, part.casefold())
        for part in re.split(r"(\d+)", value)
        if part
    )


def _rename_legacy_emmo_rows(bind) -> set[str]:
    migrated_sample_ids: set[str] = set()
    sample_rows = bind.execute(sa.text("SELECT id, name FROM samples")).mappings().all()
    names_by_id = {str(row["id"]): str(row["name"]) for row in sample_rows}
    existing_names = set(names_by_id.values())
    for sample_id, old_name in names_by_id.items():
        match = re.fullmatch(r"([^_]+)_([^_]+)_EMMO", old_name)
        if match is None:
            continue
        new_name = f"EMMO-{match.group(1)}_{match.group(2)}"
        if new_name != old_name and new_name in existing_names:
            raise RuntimeError(f"Cannot migrate duplicate sample name: {new_name}")
        bind.execute(
            sa.text("UPDATE samples SET name = :name WHERE id = :id"),
            {"name": new_name, "id": sample_id},
        )
        existing_names.discard(old_name)
        existing_names.add(new_name)
        migrated_sample_ids.add(sample_id)

    derivative_rows = bind.execute(
        sa.text("SELECT id, name FROM derivatives")
    ).mappings().all()
    for row in derivative_rows:
        old_name = str(row["name"])
        match = re.fullmatch(r"([^_]+)_([^_]+)_EMMO_(.+)", old_name)
        if match is None:
            continue
        new_name = f"EMMO-{match.group(1)}_{match.group(2)}_{match.group(3)}"
        bind.execute(
            sa.text("UPDATE derivatives SET name = :name WHERE id = :id"),
            {"name": new_name, "id": int(row["id"])},
        )
    return migrated_sample_ids


def _create_and_assign_documents(bind, migrated_sample_ids: set[str]) -> None:
    if not migrated_sample_ids:
        return
    rows = bind.execute(
        sa.text("SELECT id, name FROM samples")
    ).mappings().all()
    pages_by_document: dict[str, list[tuple[str, str]]] = {}
    for row in rows:
        sample_id = str(row["id"])
        if sample_id not in migrated_sample_ids:
            continue
        match = re.fullmatch(r"([^_]+)_([^_]+)", str(row["name"]))
        if match is None:
            raise RuntimeError(f"Migrated sample has invalid canonical name: {row['name']}")
        document_id, page = match.groups()
        pages_by_document.setdefault(document_id, []).append((page, sample_id))

    known_documents = set(
        str(value)
        for value in bind.execute(sa.text("SELECT id FROM documents")).scalars().all()
    )
    for document_id, pages in pages_by_document.items():
        if document_id not in known_documents:
            bind.execute(
                sa.text(
                    "INSERT INTO documents (id, name, metadata) "
                    "VALUES (:id, :name, :metadata)"
                ).bindparams(sa.bindparam("metadata", type_=sa.JSON())),
                {
                    "id": document_id,
                    "name": document_id,
                    "metadata": {"source": "EMMO", "mapping": "filename"},
                },
            )
            known_documents.add(document_id)
        for position, (_, sample_id) in enumerate(
            sorted(pages, key=lambda item: (_natural_key(item[0]), item[1]))
        ):
            bind.execute(
                sa.text(
                    "UPDATE samples SET document_id = :document_id, "
                    "document_position = :position WHERE id = :id"
                ),
                {
                    "document_id": document_id,
                    "position": position,
                    "id": sample_id,
                },
            )


def _remove_sample_rules_from_position_json(bind) -> None:
    rows = bind.execute(
        sa.text("SELECT id, position_rule FROM derivative_groups")
    ).mappings().all()
    for row in rows:
        position_rule = row["position_rule"]
        if not isinstance(position_rule, dict):
            continue
        cleaned = {
            key: value
            for key, value in position_rule.items()
            if not str(key).startswith("sample_mapping")
        }
        bind.execute(
            sa.text(
                "UPDATE derivative_groups SET position_rule = :position_rule WHERE id = :id"
            ).bindparams(sa.bindparam("position_rule", type_=sa.JSON())),
            {"position_rule": cleaned, "id": int(row["id"])},
        )


def upgrade() -> None:
    bind = op.get_bind()
    if "documents" not in _tables():
        return

    document_columns = _columns("documents")
    if "blob" not in document_columns:
        op.add_column("documents", sa.Column("blob", sa.LargeBinary(), nullable=True))
    if "mime_type" not in document_columns:
        op.add_column("documents", sa.Column("mime_type", sa.String(255), nullable=True))

    migrated_sample_ids = _rename_legacy_emmo_rows(bind)
    _create_and_assign_documents(bind, migrated_sample_ids)
    _remove_sample_rules_from_position_json(bind)

    if "sample_mapping" in _tables():
        op.drop_table("sample_mapping")


def downgrade() -> None:
    raise RuntimeError("This data-preserving migration is intentionally irreversible.")
