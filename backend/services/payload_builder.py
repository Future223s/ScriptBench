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
        sample_id: str | None,
        workflow_dag_node_id: int,
        execution_job_id: int | None = None,
    ) -> dict[str, Any]:
        node = self.repository.fetch_node(workflow_id, workflow_dag_node_id)
        step = self.repository.fetch_step(int(node["workflow_step_id"]))
        template = self.repository.fetch_template(int(step["payload_template_id"]))
        sample = (
            self.repository.fetch_primary_sample(execution_job_id, sample_id)
            if execution_job_id is not None
            else self.repository.fetch_sample(str(sample_id))
        )
        resources = {}
        for resource in self.repository.list_prompt_resources(
            int(step["payload_template_id"])
        ):
            rows = (
                self.repository.list_prompt_resource_rows(
                    resource, sample, execution_job_id, workflow_id
                )
                if execution_job_id is not None
                else self.repository.list_prompt_resource_rows(
                    resource, sample, workflow_id=workflow_id
                )
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
            rendered_items = []
            for item in value:
                if (
                    isinstance(item, dict)
                    and set(item) == {"$each"}
                    and isinstance(item["$each"], dict)
                    and "into" not in item["$each"]
                ):
                    rule = item["$each"]
                    resource_name = self._each_value(rule, "resource")
                    template = self._each_value(rule, "template")
                    for row in resources.get(resource_name, []):
                        rendered_items.append(
                            self._render(
                                template,
                                resources,
                                sample,
                                {**local, resource_name: row},
                            )
                        )
                    continue
                rendered_items.append(self._render(item, resources, sample, local))
            return rendered_items
        if not isinstance(value, dict):
            return value

        rendered = {
            key: self._render(item, resources, sample, local)
            for key, item in value.items()
            if key != "$each"
        }
        rules = value.get("$each")
        for rule in rules if isinstance(rules, list) else [rules] if rules else []:
            if "into" not in rule:
                raise ValueError("Inline $each must be the only value in an array item")
            resource_name = self._each_value(rule, "resource")
            target_name = self._each_value(rule, "into")
            template = self._each_value(rule, "template")
            if target_name not in rendered or not isinstance(rendered[target_name], list):
                raise ValueError(f"$each target must be an array: {target_name}")
            for row in resources.get(resource_name, []):
                rendered[target_name].append(
                    self._render(
                        template,
                        resources,
                        sample,
                        {**local, resource_name: row},
                    )
                )
        return rendered

    @staticmethod
    def _each_value(rule: dict[str, Any], name: str) -> Any:
        if name not in rule:
            raise ValueError(f"$each requires '{name}'")
        return rule[name]

    @staticmethod
    def _value(
        reference: str,
        resources: dict[str, list[dict[str, Any]]],
        sample: dict[str, Any],
        local: dict[str, dict[str, Any]],
    ) -> Any:
        name, field_name = reference.split(".", 1)
        row = local.get(name) or (sample if name == "sample" else None)
        if row is None:
            if name not in resources:
                raise ValueError(f"Unknown prompt resource: {name}")
            rows = resources.get(name, [])
            row = rows[0] if len(rows) == 1 else {}
        return row.get(field_name)
