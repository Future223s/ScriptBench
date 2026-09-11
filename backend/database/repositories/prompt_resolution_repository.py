from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.engine import Engine

from ..tables.derivatives_table import derivatives
from ..tables.payload_templates_table import payload_templates
from .prompt_resources_repository import PromptResourcesRepository
from ..tables.samples_table import samples
from ..tables.step_outputs_table import step_outputs
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes
from ..tables.workflow_steps_table import workflow_steps


class PromptResolutionRepository:
    """The database reads needed for field interpolation only."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def fetch_node(self, workflow_id: int, node_id: int) -> dict[str, Any]:
        return self._one(
            select(workflow_dag_nodes).where(
                workflow_dag_nodes.c.workflow_id == workflow_id,
                workflow_dag_nodes.c.id == node_id,
            )
        )

    def fetch_step(self, step_id: int) -> dict[str, Any]:
        return self._one(
            select(workflow_steps).where(workflow_steps.c.id == step_id)
        )

    def fetch_template(self, template_id: int) -> dict[str, Any]:
        return self._one(
            select(payload_templates).where(
                payload_templates.c.id == template_id
            )
        )

    def fetch_sample(self, sample_id: str) -> dict[str, Any]:
        return self._one(select(samples).where(samples.c.id == sample_id))

    def list_prompt_resources(self, template_id: int) -> list[dict[str, Any]]:
        return PromptResourcesRepository(self.engine).list_for_template(template_id)

    def list_prompt_resource_rows(
        self,
        resource: dict[str, Any],
        sample: dict[str, Any],
        execution_job_id: int | None = None,
    ) -> list[dict[str, Any]]:
        table_name = str(resource["source_table"])
        table = {
            "derivatives": derivatives,
            "samples": samples,
            "step_outputs": step_outputs,
        }.get(table_name)
        if table is None:
            raise ValueError(f"Unsupported prompt resource table: {table_name}")
        statement = select(table)
        if table_name == "step_outputs" and execution_job_id is not None:
            statement = statement.where(
                step_outputs.c.execution_job_id == execution_job_id
            )
        for condition in resource.get("conditions", []):
            field = str(condition["field_name"])
            if field not in table.c:
                raise ValueError(f"Unsupported prompt resource field: {table_name}.{field}")
            value = (
                sample.get(str(condition["value"]))
                if condition["value_type"] == "sample-field"
                else condition["value"]
            )
            column = table.c[field]
            operator = str(condition["operator"])
            if operator == "equals":
                statement = statement.where(column == value)
            elif operator == "not_equals":
                statement = statement.where(column != value)
            elif operator == "greater_than":
                statement = statement.where(column > value)
            elif operator == "less_than":
                statement = statement.where(column < value)
            elif operator == "contains":
                statement = statement.where(column.contains(str(value)))
            else:
                raise ValueError(f"Unsupported prompt resource operator: {operator}")
        name_field = {
            "derivatives": "name",
            "samples": "name",
            "step_outputs": "id",
        }[table_name]
        statement = statement.order_by(table.c[name_field].asc()).limit(
            int(resource["batch_limit"])
        )
        with self.engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        return [dict(row) for row in rows]

    def _one(self, statement) -> dict[str, Any]:
        with self.engine.connect() as connection:
            row = connection.execute(statement).mappings().one_or_none()
        if row is None:
            raise LookupError("Prompt resolution record was not found")
        return dict(row)
