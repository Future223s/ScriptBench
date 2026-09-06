from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.engine import Engine

from ..tables.artifacts_table import artifacts
from ..tables.payload_templates_table import payload_templates
from ..tables.prompt_resource_conditions_table import prompt_resource_conditions
from ..tables.prompt_resources_table import prompt_resources
from ..tables.samples_table import samples
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
                workflow_dag_nodes.c.workflow_dag_node_id == node_id,
            )
        )

    def fetch_step(self, step_id: int) -> dict[str, Any]:
        return self._one(
            select(workflow_steps).where(workflow_steps.c.workflow_step_id == step_id)
        )

    def fetch_template(self, template_id: int) -> dict[str, Any]:
        return self._one(
            select(payload_templates).where(
                payload_templates.c.payload_template_id == template_id
            )
        )

    def fetch_sample(self, sample_id: str) -> dict[str, Any]:
        return self._one(select(samples).where(samples.c.sample_id == sample_id))

    def list_prompt_resources(self, template_id: int) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            resources = connection.execute(
                select(prompt_resources)
                .where(prompt_resources.c.payload_template_id == template_id)
                .order_by(prompt_resources.c.prompt_resource_id.asc())
            ).mappings().all()
            conditions = connection.execute(
                select(prompt_resource_conditions)
                .join(prompt_resources)
                .where(prompt_resources.c.payload_template_id == template_id)
                .order_by(
                    prompt_resource_conditions.c.prompt_resource_id.asc(),
                    prompt_resource_conditions.c.position.asc(),
                )
            ).mappings().all()
        conditions_by_resource: dict[int, list[dict[str, Any]]] = {}
        for condition in conditions:
            conditions_by_resource.setdefault(
                int(condition["prompt_resource_id"]), []
            ).append(
                {
                    "field": condition["field_name"],
                    "operator": condition["operator"],
                    "valueType": condition["value_type"],
                    "value": condition["value"],
                }
            )
        return [
            {
                "name": resource["resource_name"],
                "table": resource["source_table"],
                "batchLimit": resource["batch_limit"],
                "conditions": conditions_by_resource.get(
                    int(resource["prompt_resource_id"]), []
                ),
            }
            for resource in resources
        ]

    def list_prompt_resource_rows(
        self,
        resource: dict[str, Any],
        sample: dict[str, Any],
    ) -> list[dict[str, Any]]:
        table_name = str(resource["table"])
        table = {"artifacts": artifacts, "samples": samples}.get(table_name)
        if table is None:
            raise ValueError(f"Unsupported prompt resource table: {table_name}")
        statement = select(table)
        for condition in resource.get("conditions", []):
            field = str(condition["field"])
            if field not in table.c:
                raise ValueError(f"Unsupported prompt resource field: {table_name}.{field}")
            value = (
                sample.get(str(condition["value"]))
                if condition["valueType"] == "sample-field"
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
        name_field = "artifact_name" if table_name == "artifacts" else "sample_name"
        statement = statement.order_by(table.c[name_field].asc()).limit(
            int(resource["batchLimit"])
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
