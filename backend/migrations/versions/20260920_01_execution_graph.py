"""Add document hierarchy and resolved execution graphs without replacing source rows.

Revision ID: 20260920_01
Revises: None
"""
from __future__ import annotations

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260920_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {str(row["name"]) for row in sa.inspect(op.get_bind()).get_columns(table_name)}


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
    return names


def _add_column(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def _create_support_tables() -> None:
    tables = _tables()
    if "documents" not in tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.String(255), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False, unique=True),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        )
        op.create_index("ix_documents_name", "documents", ["name"], unique=True)
    if "workflow_runs" not in tables:
        op.create_table(
            "workflow_runs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("workflow_id", sa.Integer(), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
            sa.Column("execution_mode", sa.String(32), nullable=False, server_default="continuous"),
            sa.Column("status", sa.String(32), nullable=False, server_default="stopped"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
            sa.UniqueConstraint("workflow_id", name="uq_workflow_runs_workflow_id"),
            sa.CheckConstraint("execution_mode IN ('continuous', 'stage_by_stage')", name="ck_workflow_runs_execution_mode"),
            sa.CheckConstraint("status IN ('stopped', 'running', 'completed')", name="ck_workflow_runs_status"),
        )
        op.create_index("ix_workflow_runs_workflow_id", "workflow_runs", ["workflow_id"])
        op.create_index("ix_workflow_runs_status", "workflow_runs", ["status"])
    if "workflow_run_nodes" not in tables:
        op.create_table(
            "workflow_run_nodes",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("workflow_run_id", sa.Integer(), sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("workflow_dag_node_id", sa.Integer(), sa.ForeignKey("workflow_dag_nodes.id", ondelete="CASCADE"), nullable=False),
            sa.Column("topological_depth", sa.Integer(), nullable=False),
            sa.Column("released", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
            sa.UniqueConstraint("workflow_run_id", "workflow_dag_node_id", name="uq_workflow_run_nodes_run_node"),
        )
        op.create_index("ix_workflow_run_nodes_workflow_run_id", "workflow_run_nodes", ["workflow_run_id"])
        op.create_index("ix_workflow_run_nodes_workflow_dag_node_id", "workflow_run_nodes", ["workflow_dag_node_id"])
    if "execution_job_dependencies" not in tables:
        op.create_table(
            "execution_job_dependencies",
            sa.Column("execution_job_id", sa.Integer(), sa.ForeignKey("execution_jobs.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("depends_on_execution_job_id", sa.Integer(), sa.ForeignKey("execution_jobs.id", ondelete="CASCADE"), primary_key=True),
        )


def upgrade() -> None:
    bind = op.get_bind()
    if "workflows" not in _tables():
        # A new installation is still established by this revision, not application startup.
        from backend.database.schema import metadata
        from backend.api import dependencies as _table_registry  # noqa: F401
        metadata.create_all(bind)
        return

    _create_support_tables()

    _add_column("workflows", sa.Column("execution_mode", sa.String(32), nullable=True, server_default="continuous"))
    bind.execute(sa.text("UPDATE workflows SET execution_mode = 'continuous' WHERE execution_mode IS NULL"))
    op.alter_column("workflows", "execution_mode", nullable=False, server_default="continuous")
    if "ck_workflows_execution_mode" not in _constraint_names("workflows"):
        op.create_check_constraint("ck_workflows_execution_mode", "workflows", "execution_mode IN ('continuous', 'stage_by_stage')")

    _add_column("workflow_dag_nodes", sa.Column("execution_scope", sa.String(32), nullable=True, server_default="samples"))
    bind.execute(sa.text("UPDATE workflow_dag_nodes SET execution_scope = 'samples' WHERE execution_scope IS NULL"))
    op.alter_column("workflow_dag_nodes", "execution_scope", nullable=False, server_default="samples")
    if "ck_workflow_dag_nodes_scope" not in _constraint_names("workflow_dag_nodes"):
        op.create_check_constraint(
            "ck_workflow_dag_nodes_scope",
            "workflow_dag_nodes",
            "execution_scope IN ('documents_batch', 'documents', 'samples_batch', 'samples', 'derivatives_batch', 'derivatives')",
        )

    _add_column("samples", sa.Column("document_id", sa.String(255), nullable=True))
    _add_column("samples", sa.Column("document_position", sa.Integer(), nullable=True))
    if op.get_context().dialect.name != "sqlite":
        foreign_keys = {item.get("name") for item in sa.inspect(bind).get_foreign_keys("samples")}
        if "fk_samples_document_id" not in foreign_keys:
            op.create_foreign_key("fk_samples_document_id", "samples", "documents", ["document_id"], ["id"], ondelete="SET NULL")
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes("samples")}
    if "ix_samples_document_id" not in indexes:
        op.create_index("ix_samples_document_id", "samples", ["document_id"])

    job_columns = {
        "workflow_run_id": sa.Column("workflow_run_id", sa.Integer(), nullable=True),
        "workflow_run_node_id": sa.Column("workflow_run_node_id", sa.Integer(), nullable=True),
        "workflow_step_id": sa.Column("workflow_step_id", sa.Integer(), nullable=True),
        "execution_scope": sa.Column("execution_scope", sa.String(32), nullable=True, server_default="samples"),
        "input_key": sa.Column("input_key", sa.String(1024), nullable=True),
        "input_refs": sa.Column("input_refs", sa.JSON(), nullable=True),
        "skip_reason": sa.Column("skip_reason", sa.Text(), nullable=True),
    }
    for column in job_columns.values():
        _add_column("execution_jobs", column)
    bind.execute(sa.text("UPDATE execution_jobs SET execution_scope = 'samples' WHERE execution_scope IS NULL"))
    rows = bind.execute(sa.text("SELECT id, sample_id FROM execution_jobs WHERE input_refs IS NULL")).mappings()
    for row in rows:
        refs = [] if row["sample_id"] is None else [{"entity_type": "sample", "entity_id": str(row["sample_id"])}]
        bind.execute(sa.text("UPDATE execution_jobs SET input_refs = :refs, input_key = COALESCE(input_key, :input_key) WHERE id = :id").bindparams(
            sa.bindparam("refs", value=refs, type_=sa.JSON()),
            sa.bindparam("input_key", value=(str(row["sample_id"]) if row["sample_id"] is not None else f"legacy:{row['id']}")),
            sa.bindparam("id", value=int(row["id"])),
        ))
    bind.execute(sa.text("UPDATE execution_jobs SET status = 'pending' WHERE status = 'failed'"))
    constraints = _constraint_names("execution_jobs")
    if "uq_execution_jobs_workflow_sample" in constraints:
        op.drop_constraint("uq_execution_jobs_workflow_sample", "execution_jobs", type_="unique")
    if "ck_execution_jobs_status" in constraints:
        op.drop_constraint("ck_execution_jobs_status", "execution_jobs", type_="check")
    op.create_check_constraint("ck_execution_jobs_status", "execution_jobs", "status IN ('blocked', 'pending', 'queued', 'running', 'completed')")
    if "ck_execution_jobs_scope" not in constraints:
        op.create_check_constraint("ck_execution_jobs_scope", "execution_jobs", "execution_scope IN ('documents_batch', 'documents', 'samples_batch', 'samples', 'derivatives_batch', 'derivatives')")
    op.alter_column("execution_jobs", "sample_id", nullable=True)
    op.alter_column("execution_jobs", "current_workflow_dag_node_id", nullable=True)
    op.alter_column("execution_jobs", "execution_scope", nullable=False, server_default="samples")
    op.alter_column("execution_jobs", "input_refs", nullable=False)
    if op.get_context().dialect.name != "sqlite":
        foreign_keys = {item.get("name") for item in sa.inspect(bind).get_foreign_keys("execution_jobs")}
        for name, column, remote in (
            ("fk_execution_jobs_workflow_run_id", "workflow_run_id", "workflow_runs"),
            ("fk_execution_jobs_workflow_run_node_id", "workflow_run_node_id", "workflow_run_nodes"),
            ("fk_execution_jobs_workflow_step_id", "workflow_step_id", "workflow_steps"),
        ):
            if name not in foreign_keys:
                op.create_foreign_key(name, "execution_jobs", remote, [column], ["id"], ondelete="CASCADE")
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes("execution_jobs")}
    for name, column in (
        ("ix_execution_jobs_workflow_run_id", "workflow_run_id"),
        ("ix_execution_jobs_workflow_run_node_id", "workflow_run_node_id"),
        ("ix_execution_jobs_workflow_step_id", "workflow_step_id"),
    ):
        if name not in indexes:
            op.create_index(name, "execution_jobs", [column])
    if "uq_execution_jobs_run_node_input" not in constraints:
        op.create_unique_constraint("uq_execution_jobs_run_node_input", "execution_jobs", ["workflow_run_node_id", "input_key"])

    _add_column("step_outputs", sa.Column("raw_individual_outputs", sa.JSON(), nullable=True))
    _add_column("step_outputs", sa.Column("complete_output", sa.JSON(), nullable=True))
    bind.execute(sa.text("UPDATE step_outputs SET complete_output = parsed_output WHERE complete_output IS NULL"))
    op.alter_column("step_outputs", "sample_id", nullable=True)


def downgrade() -> None:
    raise RuntimeError("This data-preserving migration is intentionally irreversible.")
