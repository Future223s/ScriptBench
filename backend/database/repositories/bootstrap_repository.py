from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.sql.schema import Table

from ..tables.derivative_groups_table import derivative_groups
from ..tables.derivatives_table import derivatives
from ..tables.documents_table import documents
from ..tables.membership_mapping_table import membership_mapping
from ..tables.output_specs_table import output_specs
from ..tables.payload_templates_table import payload_templates
from ..tables.sample_set_samples_table import sample_set_samples
from ..tables.sample_sets_table import sample_sets
from ..tables.samples_table import samples
from ..tables.step_executors_table import step_executors
from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_steps_table import workflow_steps
from ..tables.workflows_table import workflows


class BootstrapRepository:
    """Persistence operations used by the idempotent development seed scripts."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def transaction(self) -> AbstractContextManager[Connection]:
        return self.engine.begin()

    @staticmethod
    def _inserted_id(result, label: str) -> int:
        inserted_id = (
            result.inserted_primary_key[0] if result.inserted_primary_key else None
        )
        if inserted_id is None:
            raise RuntimeError(f"Failed to insert {label}")
        return int(inserted_id)

    @staticmethod
    def _single_named_row(
        conn: Connection, table: Table, name: str, label: str
    ) -> dict[str, Any] | None:
        rows = (
            conn.execute(select(table).where(table.c.name == name)).mappings().all()
        )
        if len(rows) > 1:
            raise ValueError(
                f"Multiple {label} rows named '{name}' exist; resolve them before seeding"
            )
        return dict(rows[0]) if rows else None

    @classmethod
    def _upsert_named(
        cls,
        conn: Connection,
        table: Table,
        *,
        name: str,
        values: dict[str, object],
        label: str,
    ) -> int:
        existing = cls._single_named_row(conn, table, name, label)
        if existing is None:
            return cls._inserted_id(
                conn.execute(insert(table).values(name=name, **values)), label
            )
        row_id = int(existing["id"])
        conn.execute(update(table).where(table.c.id == row_id).values(**values))
        return row_id

    def upsert_sample(
        self,
        sample_id: str,
        values: dict[str, object],
        *,
        conn: Connection,
    ) -> None:
        document_id = values.get("document_id")
        if document_id is not None:
            existing_document = conn.execute(
                select(documents.c.id).where(documents.c.id == document_id)
            ).scalar_one_or_none()
            if existing_document is None:
                conn.execute(
                    insert(documents).values(
                        id=document_id,
                        name=document_id,
                        metadata={"source": "EMMO"},
                    )
                )
        existing = conn.execute(
            select(samples.c.id).where(samples.c.id == sample_id)
        ).scalar_one_or_none()
        if existing is not None:
            conn.execute(
                update(samples).where(samples.c.id == sample_id).values(**values)
            )
            return
        conflicting_sample_id = conn.execute(
            select(samples.c.id).where(samples.c.name == values["name"])
        ).scalar_one_or_none()
        if conflicting_sample_id is not None:
            raise ValueError(
                f"Sample name '{values['name']}' is already owned by sample ID "
                f"'{conflicting_sample_id}'"
            )
        conn.execute(insert(samples).values(id=sample_id, **values))

    def upsert_derivative_group(
        self,
        *,
        name: str,
        values: dict[str, object],
        mapping_values: dict[str, object],
        conn: Connection,
    ) -> int:
        group_id = self._upsert_named(
            conn,
            derivative_groups,
            name=name,
            values=values,
            label="derivative group",
        )
        existing = (
            conn.execute(
                select(membership_mapping).where(
                    membership_mapping.c.derivative_group_id == group_id
                )
            )
            .mappings()
            .one_or_none()
        )
        if existing is None:
            conn.execute(
                insert(membership_mapping).values(
                    derivative_group_id=group_id, **mapping_values
                )
            )
        else:
            conn.execute(
                update(membership_mapping)
                .where(membership_mapping.c.derivative_group_id == group_id)
                .values(**mapping_values)
            )
        return group_id

    def upsert_derivative(
        self,
        *,
        sample_id: str,
        name: str,
        values: dict[str, object],
        conn: Connection,
    ) -> None:
        existing = conn.execute(
            select(derivatives.c.id).where(
                derivatives.c.sample_id == sample_id,
                derivatives.c.name == name,
            )
        ).scalar_one_or_none()
        if existing is None:
            conn.execute(
                insert(derivatives).values(
                    name=name, sample_id=sample_id, **values
                )
            )
        else:
            conn.execute(
                update(derivatives).where(derivatives.c.id == existing).values(**values)
            )

    def upsert_sample_set(
        self,
        *,
        name: str,
        values: dict[str, object],
        sample_ids: list[str],
        label: str,
        conn: Connection,
    ) -> int:
        sample_set_id = self._upsert_named(
            conn, sample_sets, name=name, values=values, label=label
        )
        conn.execute(
            delete(sample_set_samples).where(
                sample_set_samples.c.sample_set_id == sample_set_id
            )
        )
        if sample_ids:
            conn.execute(
                insert(sample_set_samples),
                [
                    {
                        "sample_set_id": sample_set_id,
                        "sample_id": sample_id,
                        "position": position,
                    }
                    for position, sample_id in enumerate(sample_ids)
                ],
            )
        return sample_set_id

    def fetch_sample_set_id(self, name: str, *, conn: Connection) -> int | None:
        row = self._single_named_row(conn, sample_sets, name, "sample set")
        return int(row["id"]) if row is not None else None

    def list_sample_ids(self, sample_set_id: int, *, conn: Connection) -> list[str]:
        return [
            str(value)
            for value in conn.execute(
                select(sample_set_samples.c.sample_id)
                .where(sample_set_samples.c.sample_set_id == sample_set_id)
                .order_by(sample_set_samples.c.position)
            )
            .scalars()
            .all()
        ]

    def fetch_executor(self, executor_id: str, *, conn: Connection) -> dict[str, Any]:
        row = (
            conn.execute(
                select(step_executors).where(step_executors.c.id == executor_id)
            )
            .mappings()
            .one()
        )
        return dict(row)

    def upsert_payload_template(
        self, name: str, values: dict[str, object], *, conn: Connection
    ) -> int:
        return self._upsert_named(
            conn,
            payload_templates,
            name=name,
            values=values,
            label="smoke-test payload template",
        )

    def upsert_output_spec(
        self, name: str, values: dict[str, object], *, conn: Connection
    ) -> int:
        return self._upsert_named(
            conn,
            output_specs,
            name=name,
            values=values,
            label="smoke-test output specification",
        )

    def upsert_workflow_step(
        self, name: str, values: dict[str, object], *, conn: Connection
    ) -> int:
        return self._upsert_named(
            conn,
            workflow_steps,
            name=name,
            values=values,
            label="smoke-test workflow step",
        )

    def upsert_workflow(
        self, name: str, values: dict[str, object], *, conn: Connection
    ) -> int:
        return self._upsert_named(
            conn,
            workflows,
            name=name,
            values=values,
            label="smoke-test workflow",
        )

    def replace_workflow_graph(
        self, workflow_id: int, workflow_step_id: int, *, conn: Connection
    ) -> None:
        conn.execute(
            delete(workflow_dag_edges).where(
                workflow_dag_edges.c.workflow_id == workflow_id
            )
        )
        nodes = (
            conn.execute(
                select(workflow_dag_nodes.c.id).where(
                    workflow_dag_nodes.c.workflow_id == workflow_id
                )
            )
            .scalars()
            .all()
        )
        if nodes:
            conn.execute(
                update(workflow_dag_nodes)
                .where(workflow_dag_nodes.c.id == nodes[0])
                .values(workflow_step_id=workflow_step_id, row=2, col=4)
            )
            if len(nodes) > 1:
                conn.execute(
                    delete(workflow_dag_nodes).where(
                        workflow_dag_nodes.c.id.in_(nodes[1:])
                    )
                )
        else:
            conn.execute(
                insert(workflow_dag_nodes).values(
                    workflow_id=workflow_id,
                    workflow_step_id=workflow_step_id,
                    row=2,
                    col=4,
                )
            )
