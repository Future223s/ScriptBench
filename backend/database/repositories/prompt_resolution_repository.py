from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.engine import Engine

from ..tables.derivatives_table import derivatives
from ..tables.documents_table import documents
from ..tables.execution_jobs_table import execution_jobs
from ..tables.execution_job_dependencies_table import execution_job_dependencies
from ..tables.assets_table import assets
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

    def fetch_execution_job(self, execution_job_id: int) -> dict[str, Any]:
        return self._one(
            select(execution_jobs).where(execution_jobs.c.id == execution_job_id)
        )

    def fetch_primary_sample(
        self, execution_job_id: int, fallback_sample_id: str | None = None
    ) -> dict[str, Any]:
        job = self.fetch_execution_job(execution_job_id)
        if job.get("sample_id") is not None:
            return self.fetch_sample(str(job["sample_id"]))
        refs = list(job.get("input_refs") or [])
        for ref in refs:
            entity_type = str(ref.get("entity_type"))
            entity_id = str(ref.get("entity_id"))
            if entity_type == "sample":
                return self.fetch_sample(entity_id)
            if entity_type == "derivative":
                with self.engine.connect() as connection:
                    sample_id = connection.execute(
                        select(derivatives.c.sample_id).where(
                            derivatives.c.id == int(entity_id)
                        )
                    ).scalar_one_or_none()
                if sample_id is not None:
                    return self.fetch_sample(str(sample_id))
            if entity_type == "document":
                with self.engine.connect() as connection:
                    sample_id = connection.execute(
                        select(samples.c.id)
                        .where(samples.c.document_id == entity_id)
                        .order_by(samples.c.document_position, samples.c.id)
                        .limit(1)
                    ).scalar_one_or_none()
                if sample_id is not None:
                    return self.fetch_sample(str(sample_id))
        if fallback_sample_id is not None:
            return self.fetch_sample(fallback_sample_id)
        return {}

    def list_prompt_resources(self, template_id: int) -> list[dict[str, Any]]:
        return PromptResourcesRepository(self.engine).list_for_template(template_id)

    def list_prompt_resource_rows(
        self,
        resource: dict[str, Any],
        sample: dict[str, Any],
        execution_job_id: int | None = None,
        workflow_id: int | None = None,
    ) -> list[dict[str, Any]]:
        table_name = str(resource["source_table"])
        table = {
            "assets": assets,
            "documents": documents,
            "derivatives": derivatives,
            "samples": samples,
            "step_outputs": step_outputs,
        }.get(table_name)
        if table is None:
            raise ValueError(f"Unsupported prompt resource table: {table_name}")
        statement = select(table)

        resource_type = str(resource.get("type") or "binding")
        if resource_type == "content":
            row_id = resource.get("row_id")
            if row_id is None:
                raise ValueError(f"Content prompt resource has no row_id: {resource['name']}")
            try:
                typed_row_id = table.c.id.type.python_type(row_id)
            except (TypeError, ValueError) as error:
                raise ValueError(f"Invalid content row ID: {row_id}") from error
            statement = statement.where(table.c.id == typed_row_id)
            refs: list[dict[str, Any]] = []
        else:
            if table_name == "assets":
                raise ValueError("Assets cannot be runtime prompt bindings")
            if execution_job_id is None:
                raise ValueError("Prompt bindings require an execution job")
            job = self.fetch_execution_job(execution_job_id)
            refs = list(job.get("input_refs") or [])
            if not refs:
                return []

        ref_ids: dict[str, list[str]] = {}
        for ref in refs:
            ref_ids.setdefault(str(ref.get("entity_type")), []).append(
                str(ref.get("entity_id"))
            )
        if resource_type == "binding" and table_name == "step_outputs":
            statement = statement.where(
                step_outputs.c.execution_job_id.in_(
                    select(
                        execution_job_dependencies.c.depends_on_execution_job_id
                    ).where(
                        execution_job_dependencies.c.execution_job_id
                        == execution_job_id
                    )
                )
            )
        elif resource_type == "binding" and table_name == "documents":
            filters = []
            if ref_ids.get("document"):
                filters.append(documents.c.id.in_(ref_ids["document"]))
            if ref_ids.get("sample"):
                filters.append(
                    documents.c.id.in_(
                        select(samples.c.document_id).where(samples.c.id.in_(ref_ids["sample"]))
                    )
                )
            if ref_ids.get("derivative"):
                filters.append(
                    documents.c.id.in_(
                        select(samples.c.document_id)
                        .join(derivatives, derivatives.c.sample_id == samples.c.id)
                        .where(derivatives.c.id.in_([int(value) for value in ref_ids["derivative"]]))
                    )
                )
            if filters:
                statement = statement.where(or_(*filters))
        elif resource_type == "binding" and table_name == "samples":
            filters = []
            if ref_ids.get("sample"):
                filters.append(samples.c.id.in_(ref_ids["sample"]))
            if ref_ids.get("document"):
                filters.append(samples.c.document_id.in_(ref_ids["document"]))
            if ref_ids.get("derivative"):
                filters.append(
                    samples.c.id.in_(
                        select(derivatives.c.sample_id).where(
                            derivatives.c.id.in_([int(value) for value in ref_ids["derivative"]])
                        )
                    )
                )
            if filters:
                statement = statement.where(or_(*filters))
        elif resource_type == "binding" and table_name == "derivatives":
            filters = []
            if ref_ids.get("derivative"):
                filters.append(derivatives.c.id.in_([int(value) for value in ref_ids["derivative"]]))
            if ref_ids.get("sample"):
                filters.append(derivatives.c.sample_id.in_(ref_ids["sample"]))
            if ref_ids.get("document"):
                filters.append(
                    derivatives.c.sample_id.in_(
                        select(samples.c.id).where(samples.c.document_id.in_(ref_ids["document"]))
                    )
                )
            if filters:
                statement = statement.where(or_(*filters))
        name_field = {
            "assets": "name",
            "documents": "name",
            "derivatives": "name",
            "samples": "name",
            "step_outputs": "id",
        }[table_name]
        statement = statement.order_by(table.c[name_field].asc())
        with self.engine.connect() as connection:
            rows = connection.execute(statement).mappings().all()
        result = [dict(row) for row in rows]
        if table_name == "assets":
            for row in result:
                blob = row.get("blob")
                row["text"] = (
                    bytes(blob).decode("utf-8", errors="replace")
                    if blob is not None
                    else ""
                )
        return result

    def _one(self, statement) -> dict[str, Any]:
        with self.engine.connect() as connection:
            row = connection.execute(statement).mappings().one_or_none()
        if row is None:
            raise LookupError("Prompt resolution record was not found")
        return dict(row)
