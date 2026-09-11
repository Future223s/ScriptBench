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

OUTPUT_SPEC_TYPES: tuple[str, ...] = (
    "plain-text",
    "json",
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
    "sample",
    "derivative",
    "step_output",
)

PROMPT_RESOURCE_TABLES: tuple[str, ...] = (
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
    "pending",
    "queued",
    "running",
    "completed",
    "failed",
)

EXECUTION_SCOPES: tuple[str, ...] = (
    "source",
    "decomposed_item",
)

PARSE_STATUSES: tuple[str, ...] = (
    "success",
    "failed",
)

STATUS_CHECK_SQL = "status IN ('draft', 'active')"
WORKFLOW_STATUS_CHECK_SQL = "status IN ('draft', 'finalized')"
OUTPUT_SPEC_TYPE_CHECK_SQL = "type IN ('plain-text', 'json')"
DERIVATIVE_CATEGORY_CHECK_SQL = "category IN ('companion', 'decomposition')"
MAPPING_TYPE_CHECK_SQL = "mapping_type IN ('one-to-one', 'one-to-many')"
MAPPING_OPERATOR_CHECK_SQL = (
    "operator IN ('equals', 'contains', 'starts_with', 'ends_with')"
)
PAYLOAD_BINDING_MODE_CHECK_SQL = "binding_mode IN ('fixed', 'sample-bound')"
PAYLOAD_SOURCE_TYPE_CHECK_SQL = (
    "source_type IN ('asset', 'sample', 'derivative', 'step_output', 'table_rows')"
)
PROMPT_RESOURCE_TABLE_CHECK_SQL = "source_table IN ('derivatives', 'samples', 'step_outputs')"
PROMPT_RESOURCE_OPERATOR_CHECK_SQL = (
    "operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains')"
)
PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL = "value_type IN ('manual', 'sample-field')"
EXECUTION_JOB_STATUS_CHECK_SQL = (
    "status IN ('pending', 'queued', 'running', 'completed', 'failed')"
)
EXECUTION_SCOPE_CHECK_SQL = "execution_scope IN ('source', 'decomposed_item')"
PARSE_STATUS_CHECK_SQL = "parse_status IN ('success', 'failed')"
metadata = MetaData()
