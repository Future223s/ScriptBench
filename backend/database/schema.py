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

ARTIFACT_CATEGORIES: tuple[str, ...] = (
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
    "artifact",
    "model_output",
)

EXECUTION_ROW_STATUSES: tuple[str, ...] = (
    "not_started",
    "queued",
    "in_progress",
    "completed",
)

EXECUTION_SCOPES: tuple[str, ...] = (
    "source",
    "decomposed_item",
)

PARSE_STATUSES: tuple[str, ...] = (
    "success",
    "failed",
)

OBJECT_UPLOAD_TYPES: tuple[str, ...] = (
    "sample",
    "artifact",
)

STATUS_CHECK_SQL = "status IN ('draft', 'active')"
WORKFLOW_STATUS_CHECK_SQL = "status IN ('draft', 'finalized')"
OUTPUT_SPEC_TYPE_CHECK_SQL = "type IN ('plain-text', 'json')"
ARTIFACT_CATEGORY_CHECK_SQL = "artifact_category IN ('companion', 'decomposition')"
MAPPING_TYPE_CHECK_SQL = "mapping_type IN ('one-to-one', 'one-to-many')"
MAPPING_OPERATOR_CHECK_SQL = (
    "operator IN ('equals', 'contains', 'starts_with', 'ends_with')"
)
PAYLOAD_BINDING_MODE_CHECK_SQL = "binding_mode IN ('fixed', 'sample-bound')"
PAYLOAD_SOURCE_TYPE_CHECK_SQL = (
    "source_type IN ('asset', 'sample', 'artifact', 'model_output')"
)
EXECUTION_ROW_STATUS_CHECK_SQL = (
    "status IN ('not_started', 'queued', 'in_progress', 'completed')"
)
EXECUTION_SCOPE_CHECK_SQL = "execution_scope IN ('source', 'decomposed_item')"
PARSE_STATUS_CHECK_SQL = "parse_status IN ('success', 'failed')"
OBJECT_UPLOAD_TYPE_CHECK_SQL = "object_type IN ('sample', 'artifact')"

metadata = MetaData()
