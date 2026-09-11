from __future__ import annotations

import re
from typing import Any

from sqlalchemy.engine import Engine

from backend.database.repositories.prompt_resolution_repository import (
    PromptResolutionRepository,
)


class PayloadBuilder:
    """Fetch resource rows and interpolate them into a stored JSON payload."""

    def __init__(self, engine: Engine) -> None:
        self.repository = PromptResolutionRepository(engine)

    def build(
        self,
        *,
        workflow_id: int,
        sample_id: str,
        workflow_dag_node_id: int,
        execution_job_id: int | None = None,
    ) -> dict[str, Any]:
        node = self.repository.fetch_node(workflow_id, workflow_dag_node_id)
        step = self.repository.fetch_step(int(node["workflow_step_id"]))
        template = self.repository.fetch_template(int(step["payload_template_id"]))
        sample = self.repository.fetch_sample(sample_id)
        resources = {}
        for resource in self.repository.list_prompt_resources(
            int(step["payload_template_id"])
        ):
            rows = (
                self.repository.list_prompt_resource_rows(
                    resource, sample, execution_job_id
                )
                if execution_job_id is not None
                else self.repository.list_prompt_resource_rows(resource, sample)
            )
            resources[str(resource["name"])] = rows
        return self._render(template["payload"], resources, sample, {})

    def _render(
        self,
        value: Any,
        resources: dict[str, list[dict[str, Any]]],
        sample: dict[str, Any],
        local: dict[str, dict[str, Any]],
    ) -> Any:
        if isinstance(value, str):
            whole_reference = re.fullmatch(r"\{\{\s*([\w]+\.[\w]+)\s*\}\}", value)
            if whole_reference:
                return self._value(
                    whole_reference.group(1),
                    resources,
                    sample,
                    local,
                )
            return re.sub(
                r"\{\{\s*([\w]+\.[\w]+)\s*\}\}",
                lambda match: str(
                    self._value(match.group(1), resources, sample, local) or ""
                ),
                value,
            )
        if isinstance(value, list):
            return [self._render(item, resources, sample, local) for item in value]
        if not isinstance(value, dict):
            return value

        rendered = {
            key: self._render(item, resources, sample, local)
            for key, item in value.items()
            if key != "$each"
        }
        rules = value.get("$each")
        for rule in rules if isinstance(rules, list) else [rules] if rules else []:
            for row in resources.get(rule["resource"], []):
                rendered[rule["into"]].append(
                    self._render(
                        rule["template"],
                        resources,
                        sample,
                        {**local, rule["resource"]: row},
                    )
                )
        return rendered

    @staticmethod
    def _value(
        reference: str,
        resources: dict[str, list[dict[str, Any]]],
        sample: dict[str, Any],
        local: dict[str, dict[str, Any]],
    ) -> Any:
        name, field_name = reference.split(".", 1)
        row = local.get(name) or (
            sample if name == "sample" else None
        )
        if row is None:
            rows = resources.get(name, [])
            row = rows[0] if len(rows) == 1 else {}
        return row.get(field_name)
