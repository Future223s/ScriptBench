"""Separate raw execution attempts from published step outputs.

Revision ID: 20260921_04
Revises: 20260921_03
"""
from __future__ import annotations

from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260921_04"
down_revision: Union[str, None] = "20260921_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCOPES = (
    "documents_batch",
    "documents",
    "samples_batch",
    "samples",
    "derivatives_batch",
    "derivatives",
)
SCOPE_VALUES_SQL = ", ".join(f"'{value}'" for value in SCOPES)


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {
        str(row["name"])
        for row in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _column_info(table_name: str) -> dict[str, dict[str, Any]]:
    return {
        str(row["name"]): dict(row)
        for row in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _constraint_names(table_name: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    names = {
        str(item["name"])
        for item in inspector.get_unique_constraints(table_name)
        if item.get("name")
    }
    names.update(
        str(item["name"])
        for item in inspector.get_check_constraints(table_name)
        if item.get("name")
    )
    names.update(
        str(item["name"])
        for item in inspector.get_foreign_keys(table_name)
        if item.get("name")
    )
    return names


def _index_names(table_name: str) -> set[str]:
    return {
        str(item["name"])
        for item in sa.inspect(op.get_bind()).get_indexes(table_name)
        if item.get("name")
    }


def _add_workflow_step_scopes(bind) -> None:
    columns = _columns("workflow_steps")
    if "execution_scope" not in columns:
        op.add_column(
            "workflow_steps",
            sa.Column("execution_scope", sa.String(32), nullable=True),
        )
    if "output_scope" not in columns:
        op.add_column(
            "workflow_steps",
            sa.Column("output_scope", sa.String(32), nullable=True),
        )

    step_ids = bind.execute(sa.text("SELECT id FROM workflow_steps")).scalars().all()
    node_columns = _columns("workflow_dag_nodes")
    for step_id in step_ids:
        scopes: set[str] = set()
        if "execution_scope" in node_columns:
            scopes = {
                str(value)
                for value in bind.execute(
                    sa.text(
                        "SELECT DISTINCT execution_scope FROM workflow_dag_nodes "
                        "WHERE workflow_step_id = :step_id AND execution_scope IS NOT NULL"
                    ),
                    {"step_id": int(step_id)},
                ).scalars()
            }
        if len(scopes) > 1:
            raise RuntimeError(
                "Workflow step "
                f"{step_id} has conflicting DAG-node execution scopes: {sorted(scopes)}. "
                "Split that reusable step before applying this migration."
            )
        scope = next(iter(scopes), "samples")
        bind.execute(
            sa.text(
                "UPDATE workflow_steps SET execution_scope = COALESCE(execution_scope, :scope), "
                "output_scope = COALESCE(output_scope, :scope) WHERE id = :step_id"
            ),
            {"scope": scope, "step_id": int(step_id)},
        )

    constraints = _constraint_names("workflow_steps")
    info = _column_info("workflow_steps")
    needs_alter = info["execution_scope"]["nullable"] or info["output_scope"]["nullable"]
    missing_execution_check = "ck_workflow_steps_execution_scope" not in constraints
    missing_output_check = "ck_workflow_steps_output_scope" not in constraints
    if op.get_context().dialect.name == "sqlite" and (
        needs_alter or missing_execution_check or missing_output_check
    ):
        with op.batch_alter_table("workflow_steps") as batch:
            batch.alter_column("execution_scope", nullable=False, server_default="samples")
            batch.alter_column("output_scope", nullable=False, server_default="samples")
            if missing_execution_check:
                batch.create_check_constraint(
                    "ck_workflow_steps_execution_scope",
                    f"execution_scope IN ({SCOPE_VALUES_SQL})",
                )
            if missing_output_check:
                batch.create_check_constraint(
                    "ck_workflow_steps_output_scope",
                    f"output_scope IN ({SCOPE_VALUES_SQL})",
                )
    else:
        if info["execution_scope"]["nullable"]:
            op.alter_column("workflow_steps", "execution_scope", nullable=False, server_default="samples")
        if info["output_scope"]["nullable"]:
            op.alter_column("workflow_steps", "output_scope", nullable=False, server_default="samples")
        if missing_execution_check:
            op.create_check_constraint(
                "ck_workflow_steps_execution_scope",
                "workflow_steps",
                f"execution_scope IN ({SCOPE_VALUES_SQL})",
            )
        if missing_output_check:
            op.create_check_constraint(
                "ck_workflow_steps_output_scope",
                "workflow_steps",
                f"output_scope IN ({SCOPE_VALUES_SQL})",
            )


def _add_job_output_resolution(bind) -> None:
    columns = _columns("execution_jobs")
    if "output_scope" not in columns:
        op.add_column(
            "execution_jobs",
            sa.Column("output_scope", sa.String(32), nullable=True),
        )
    if "output_refs" not in columns:
        op.add_column(
            "execution_jobs",
            sa.Column("output_refs", sa.JSON(), nullable=True),
        )
    jobs = sa.Table("execution_jobs", sa.MetaData(), autoload_with=bind)
    for row in bind.execute(
        sa.select(
            jobs.c.id,
            jobs.c.execution_scope,
            jobs.c.input_refs,
            jobs.c.output_scope,
            jobs.c.output_refs,
        )
    ).mappings():
        bind.execute(
            jobs.update()
            .where(jobs.c.id == row["id"])
            .values(
                output_scope=row["output_scope"] or row["execution_scope"] or "samples",
                output_refs=(
                    row["output_refs"]
                    if row["output_refs"] is not None
                    else row["input_refs"] or []
                ),
            )
        )
    info = _column_info("execution_jobs")
    missing_check = (
        "ck_execution_jobs_output_scope" not in _constraint_names("execution_jobs")
    )
    needs_alter = info["output_scope"]["nullable"] or info["output_refs"]["nullable"]
    if op.get_context().dialect.name == "sqlite" and (needs_alter or missing_check):
        with op.batch_alter_table("execution_jobs") as batch:
            batch.alter_column("output_scope", nullable=False, server_default="samples")
            batch.alter_column("output_refs", nullable=False)
            if missing_check:
                batch.create_check_constraint(
                    "ck_execution_jobs_output_scope",
                    f"output_scope IN ({SCOPE_VALUES_SQL})",
                )
    else:
        if info["output_scope"]["nullable"]:
            op.alter_column("execution_jobs", "output_scope", nullable=False, server_default="samples")
        if info["output_refs"]["nullable"]:
            op.alter_column("execution_jobs", "output_refs", nullable=False)
        if missing_check:
            op.create_check_constraint(
                "ck_execution_jobs_output_scope",
                "execution_jobs",
                f"output_scope IN ({SCOPE_VALUES_SQL})",
            )


def _create_raw_outputs() -> None:
    if "raw_outputs" in _tables():
        return
    op.create_table(
        "raw_outputs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("execution_job_id", sa.Integer(), sa.ForeignKey("execution_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workflow_id", sa.Integer(), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workflow_step_id", sa.Integer(), sa.ForeignKey("workflow_steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("assembled_model_payload", sa.JSON(), nullable=False),
        sa.Column("raw_model_response", sa.Text(), nullable=False),
        sa.Column("parsed_output", sa.JSON(), nullable=True),
        sa.Column("raw_individual_outputs", sa.JSON(), nullable=True),
        sa.Column("complete_output", sa.JSON(), nullable=True),
        sa.Column("parse_status", sa.String(32), nullable=False),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("time_elapsed", sa.Float(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.UniqueConstraint("execution_job_id", "attempt_no", name="uq_raw_outputs_job_attempt"),
        sa.CheckConstraint("parse_status IN ('success', 'failed')", name="ck_raw_outputs_parse_status"),
    )
    op.create_index("ix_raw_outputs_execution_job_id", "raw_outputs", ["execution_job_id"])
    op.create_index("ix_raw_outputs_workflow_id", "raw_outputs", ["workflow_id"])
    op.create_index("ix_raw_outputs_workflow_step_id", "raw_outputs", ["workflow_step_id"])
    op.create_index("ix_raw_outputs_parse_status", "raw_outputs", ["parse_status"])


def _entity_type(scope: str) -> str:
    return {
        "documents": "document",
        "samples": "sample",
        "derivatives": "derivative",
    }[scope.removesuffix("_batch")]


def _individual_value(values: Any, entity_id: str, fallback: Any) -> Any:
    if not isinstance(values, list):
        return fallback
    for item in values:
        if not isinstance(item, dict) or str(item.get("entity_id")) != entity_id:
            continue
        if "output" in item:
            return item["output"]
        return {key: value for key, value in item.items() if key != "entity_id"}
    return fallback


def _migrate_step_outputs(bind) -> None:
    columns = _columns("step_outputs")
    legacy_columns = {
        "attempt_no",
        "assembled_model_payload",
        "raw_model_response",
        "parsed_output",
        "parse_status",
        "time_elapsed",
        "started_at",
        "completed_at",
    }
    if not legacy_columns.issubset(columns):
        return

    additions = {
        "raw_output_id": sa.Column("raw_output_id", sa.Integer(), nullable=True),
        "output_scope": sa.Column("output_scope", sa.String(32), nullable=True),
        "entity_type": sa.Column("entity_type", sa.String(32), nullable=True),
        "entity_key": sa.Column("entity_key", sa.String(255), nullable=True),
        "output": sa.Column("output", sa.JSON(), nullable=True),
    }
    for name, column in additions.items():
        if name not in columns:
            op.add_column("step_outputs", column)

    # A legacy batch output may expand into one canonical row per stable entity.
    # Remove the old one-row-per-job constraint before copying those rows.
    constraints = _constraint_names("step_outputs")
    if "uq_step_outputs_job_step" in constraints:
        if op.get_context().dialect.name == "sqlite":
            with op.batch_alter_table("step_outputs") as batch:
                batch.drop_constraint("uq_step_outputs_job_step", type_="unique")
        else:
            op.drop_constraint(
                "uq_step_outputs_job_step", "step_outputs", type_="unique"
            )

    step_table = sa.Table("step_outputs", sa.MetaData(), autoload_with=bind)
    raw_table = sa.Table("raw_outputs", sa.MetaData(), autoload_with=bind)
    jobs = sa.Table("execution_jobs", sa.MetaData(), autoload_with=bind)
    rows = [dict(row) for row in bind.execute(sa.select(step_table)).mappings()]
    for row in rows:
        parse_status = row.get("parse_status") or (
            "failed" if row.get("parse_error") else "success"
        )
        attempt_no = int(row["attempt_no"])
        duplicate_attempt = bind.execute(
            sa.select(raw_table.c.id).where(
                raw_table.c.execution_job_id == row["execution_job_id"],
                raw_table.c.attempt_no == attempt_no,
            )
        ).scalar_one_or_none()
        if duplicate_attempt is not None:
            attempt_no = int(
                bind.execute(
                    sa.select(sa.func.max(raw_table.c.attempt_no)).where(
                        raw_table.c.execution_job_id == row["execution_job_id"]
                    )
                ).scalar_one()
            ) + 1
        complete_output = row.get("complete_output")
        if complete_output is None:
            complete_output = row.get("parsed_output")
        raw_output_id = int(
            bind.execute(
                raw_table.insert()
                .values(
                    execution_job_id=row["execution_job_id"],
                    workflow_id=row["workflow_id"],
                    workflow_step_id=row["workflow_step_id"],
                    attempt_no=attempt_no,
                    assembled_model_payload=row["assembled_model_payload"],
                    raw_model_response=row["raw_model_response"],
                    parsed_output=row.get("parsed_output"),
                    raw_individual_outputs=row.get("raw_individual_outputs"),
                    complete_output=complete_output,
                    parse_status=parse_status,
                    parse_error=row.get("parse_error"),
                    time_elapsed=row["time_elapsed"],
                    started_at=row["started_at"],
                    completed_at=row["completed_at"],
                    created_at=row.get("created_at"),
                )
                .returning(raw_table.c.id)
            ).scalar_one()
        )
        if parse_status != "success":
            bind.execute(step_table.delete().where(step_table.c.id == row["id"]))
            continue
        job = bind.execute(
            sa.select(jobs).where(jobs.c.id == row["execution_job_id"])
        ).mappings().one()
        scope = str(job["output_scope"] or job["execution_scope"] or "samples")
        refs = list(job["output_refs"] or [])
        if not refs and row.get("sample_id") is not None:
            refs = [{"entity_type": "sample", "entity_id": str(row["sample_id"])}]
        if not refs:
            refs = [{
                "entity_type": _entity_type(scope),
                "entity_id": f"legacy:{row['id']}",
            }]
        fallback = complete_output
        for index, ref in enumerate(refs):
            entity_id = str(ref["entity_id"])
            canonical = {
                "raw_output_id": raw_output_id,
                "output_scope": scope,
                "entity_type": str(ref["entity_type"]),
                "entity_key": entity_id,
                "output": _individual_value(
                    row.get("raw_individual_outputs"), entity_id, fallback
                ),
            }
            if index == 0:
                bind.execute(
                    step_table.update()
                    .where(step_table.c.id == row["id"])
                    .values(**canonical)
                )
            else:
                duplicate = {
                    key: value
                    for key, value in row.items()
                    if key in step_table.c and key != "id"
                }
                duplicate.update(canonical)
                bind.execute(step_table.insert().values(**duplicate))

    constraints = _constraint_names("step_outputs")
    indexes = _index_names("step_outputs")
    with op.batch_alter_table("step_outputs") as batch:
        if "ck_step_outputs_parse_status" in constraints:
            batch.drop_constraint("ck_step_outputs_parse_status", type_="check")
        if "ix_step_outputs_parse_status" in indexes:
            batch.drop_index("ix_step_outputs_parse_status")
        for column_name in (
            "attempt_no",
            "assembled_model_payload",
            "raw_model_response",
            "parsed_output",
            "raw_individual_outputs",
            "complete_output",
            "parse_status",
            "parse_error",
            "time_elapsed",
            "started_at",
            "completed_at",
        ):
            if column_name in columns:
                batch.drop_column(column_name)
        batch.alter_column("raw_output_id", nullable=False)
        batch.alter_column("output_scope", nullable=False)
        batch.alter_column("entity_type", nullable=False)
        batch.alter_column("entity_key", nullable=False)
        batch.create_foreign_key(
            "fk_step_outputs_raw_output_id",
            "raw_outputs",
            ["raw_output_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.create_unique_constraint(
            "uq_step_outputs_job_entity",
            ["execution_job_id", "workflow_step_id", "entity_type", "entity_key"],
        )
        batch.create_check_constraint(
            "ck_step_outputs_output_scope",
            f"output_scope IN ({SCOPE_VALUES_SQL})",
        )
        batch.create_check_constraint(
            "ck_step_outputs_entity_type",
            "entity_type IN ('document', 'sample', 'derivative')",
        )
        batch.create_index("ix_step_outputs_raw_output_id", ["raw_output_id"])
        batch.create_index("ix_step_outputs_entity_key", ["entity_key"])


def upgrade() -> None:
    bind = op.get_bind()
    if "workflow_steps" not in _tables():
        return
    _add_workflow_step_scopes(bind)
    _add_job_output_resolution(bind)
    _create_raw_outputs()
    _migrate_step_outputs(bind)


def downgrade() -> None:
    raise RuntimeError(
        "This data-preserving raw/published output split is intentionally irreversible."
    )
