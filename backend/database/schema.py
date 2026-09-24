from __future__ import annotations

from sqlalchemy import MetaData

CONFIG_STATUSES: tuple[str, ...] = (
    "draft",
    "active",
)

WORKFLOW_STATUSES: tuple[str, ...] = (
    "draft",
    "finalized",
)

DERIVATIVE_CATEGORIES: tuple[str, ...] = (
    "companion",
    "decomposition",
)

MAPPING_TYPES: tuple[str, ...] = (
    "one-to-one",
    "one-to-many",
)

MAPPING_OPERATORS: tuple[str, ...] = (
    "equals",
    "contains",
    "starts_with",
    "ends_with",
)

PAYLOAD_BINDING_MODES: tuple[str, ...] = (
    "fixed",
    "sample-bound",
)

PAYLOAD_SOURCE_TYPES: tuple[str, ...] = (
    "asset",
    "document",
    "sample",
    "derivative",
    "step_output",
)

PROMPT_RESOURCE_TABLES: tuple[str, ...] = (
    "documents",
    "derivatives",
    "samples",
    "step_outputs",
)

PROMPT_RESOURCE_OPERATORS: tuple[str, ...] = (
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "contains",
)

PROMPT_RESOURCE_VALUE_TYPES: tuple[str, ...] = (
    "manual",
    "sample-field",
)

EXECUTION_JOB_STATUSES: tuple[str, ...] = (
    "blocked",
    "pending",
    "queued",
    "running",
    "completed",
)

EXECUTION_SCOPES: tuple[str, ...] = (
    "documents_batch",
    "documents",
    "samples_batch",
    "samples",
    "derivatives_batch",
    "derivatives",
)

WORKFLOW_EXECUTION_MODES: tuple[str, ...] = (
    "continuous",
    "stage_by_stage",
)

WORKFLOW_RUN_STATUSES: tuple[str, ...] = (
    "stopped",
    "running",
    "completed",
)

PARSE_STATUSES: tuple[str, ...] = (
    "success",
    "failed",
)

STATUS_CHECK_SQL = "status IN ('draft', 'active')"
WORKFLOW_STATUS_CHECK_SQL = "status IN ('draft', 'finalized')"
DERIVATIVE_CATEGORY_CHECK_SQL = "category IN ('companion', 'decomposition')"
MAPPING_TYPE_CHECK_SQL = "mapping_type IN ('one-to-one', 'one-to-many')"
MAPPING_OPERATOR_CHECK_SQL = (
    "operator IN ('equals', 'contains', 'starts_with', 'ends_with')"
)
PAYLOAD_BINDING_MODE_CHECK_SQL = "binding_mode IN ('fixed', 'sample-bound')"
PAYLOAD_SOURCE_TYPE_CHECK_SQL = (
    "source_type IN ('asset', 'document', 'sample', 'derivative', 'step_output', 'table_rows')"
)
PROMPT_RESOURCE_TABLE_CHECK_SQL = "source_table IN ('assets', 'documents', 'derivatives', 'samples', 'step_outputs')"
PROMPT_RESOURCE_TYPE_CHECK_SQL = "type IN ('content', 'binding')"
PROMPT_RESOURCE_TARGET_CHECK_SQL = (
    "(type = 'content' AND row_key IS NOT NULL) OR "
    "(type = 'binding' AND row_key IS NULL)"
)
PROMPT_RESOURCE_OPERATOR_CHECK_SQL = (
    "operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains')"
)
PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL = "value_type IN ('manual', 'sample-field')"
EXECUTION_JOB_STATUS_CHECK_SQL = (
    "status IN ('blocked', 'pending', 'queued', 'running', 'completed')"
)
EXECUTION_SCOPE_CHECK_SQL = (
    "execution_scope IN ('documents_batch', 'documents', 'samples_batch', "
    "'samples', 'derivatives_batch', 'derivatives')"
)
OUTPUT_SCOPE_CHECK_SQL = (
    "output_scope IN ('documents_batch', 'documents', 'samples_batch', "
    "'samples', 'derivatives_batch', 'derivatives')"
)
OUTPUT_ENTITY_TYPE_CHECK_SQL = (
    "entity_type IN ('document', 'sample', 'derivative')"
)
WORKFLOW_EXECUTION_MODE_CHECK_SQL = (
    "execution_mode IN ('continuous', 'stage_by_stage')"
)
WORKFLOW_RUN_STATUS_CHECK_SQL = "status IN ('stopped', 'running', 'completed')"
PARSE_STATUS_CHECK_SQL = "parse_status IN ('success', 'failed')"
metadata = MetaData()
