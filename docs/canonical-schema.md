# Canonical database and API contracts

Table-owned fields use local names. Every standalone table has `id`; foreign keys keep their related table names and target `<table>.id`. `sample_set_samples` keeps its composite `(sample_set_id, sample_id)` primary key. The physical payload table and its Python symbol are both `payload_templates`, with no singular alias.

## Table inventory

Generated from the SQLAlchemy definitions after the refactor. Column types, nullability, defaults, foreign-key delete actions, indexes, unique constraints, and check constraints are listed below.

### `assets`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `type` | `VARCHAR(255)` | no | `` |  |
| `blob` | `BLOB` | yes | `` |  |
| `mime_type` | `VARCHAR(255)` | yes | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Unique index `ix_assets_name`: `name`.
- Index `ix_assets_type`: `type`.

### `derivative_groups`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `position_rule` | `JSON` | yes | `` |  |
| `mapping_type` | `VARCHAR(32)` | no | `one-to-one` |  |
| `description` | `TEXT` | yes | `` |  |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_derivative_groups_mapping_type`: `mapping_type IN ('one-to-one', 'one-to-many')`.
- Check `ck_derivative_groups_status`: `status IN ('draft', 'active')`.
- Index `ix_derivative_groups_mapping_type`: `mapping_type`.
- Index `ix_derivative_groups_name`: `name`.
- Index `ix_derivative_groups_status`: `status`.

### `derivatives`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `sample_id` | `VARCHAR(255)` | yes | `` | samples.id (ON DELETE CASCADE) |
| `derivative_group_id` | `INTEGER` | yes | `` | derivative_groups.id (ON DELETE SET NULL) |
| `category` | `VARCHAR(64)` | no | `companion` |  |
| `blob` | `BLOB` | no | `` |  |
| `mime_type` | `VARCHAR(255)` | no | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_derivatives_category`: `category IN ('companion', 'decomposition')`.
- Unique `uq_derivatives_sample_id_name`: `sample_id, name`.
- Index `ix_derivatives_category`: `category`.
- Index `ix_derivatives_derivative_group_id`: `derivative_group_id`.
- Index `ix_derivatives_name`: `name`.
- Index `ix_derivatives_sample_id`: `sample_id`.

### `execution_jobs`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `workflow_id` | `INTEGER` | no | `` | workflows.id (ON DELETE CASCADE) |
| `sample_id` | `VARCHAR(255)` | no | `` | samples.id (ON DELETE CASCADE) |
| `current_workflow_dag_node_id` | `INTEGER` | no | `` | workflow_dag_nodes.id (ON DELETE CASCADE) |
| `status` | `VARCHAR(32)` | no | `pending` |  |
| `error_message` | `TEXT` | yes | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_execution_jobs_status`: `status IN ('pending', 'queued', 'running', 'completed', 'failed')`.
- Unique `uq_execution_jobs_workflow_sample`: `workflow_id, sample_id`.
- Index `ix_execution_jobs_current_workflow_dag_node_id`: `current_workflow_dag_node_id`.
- Index `ix_execution_jobs_sample_id`: `sample_id`.
- Index `ix_execution_jobs_status`: `status`.
- Index `ix_execution_jobs_workflow_id`: `workflow_id`.

### `membership_mapping`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `derivative_group_id` | `INTEGER` | no | `` | derivative_groups.id (ON DELETE CASCADE) |
| `derivative_field` | `VARCHAR(64)` | no | `name` |  |
| `operator` | `VARCHAR(32)` | no | `` |  |
| `pattern` | `VARCHAR(255)` | no | `` |  |
| `case_sensitive` | `BOOLEAN` | no | `0` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_membership_mapping_operator`: `operator IN ('equals', 'contains', 'starts_with', 'ends_with')`.
- Check `ck_membership_mapping_pattern_not_empty`: `pattern <> ''`.
- Unique `uq_membership_mapping_derivative_group_id`: `derivative_group_id`.
- Index `ix_membership_mapping_derivative_field`: `derivative_field`.
- Unique index `ix_membership_mapping_derivative_group_id`: `derivative_group_id`.
- Index `ix_membership_mapping_operator`: `operator`.

### `output_specs`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `type` | `VARCHAR(32)` | no | `` |  |
| `item_schema` | `JSON` | yes | `` |  |
| `instructions` | `TEXT` | yes | `` |  |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_output_specs_status`: `status IN ('draft', 'active')`.
- Check `ck_output_specs_type`: `type IN ('plain-text', 'json')`.
- Unique `uq_output_specs_name`: `name`.
- Unique index `ix_output_specs_name`: `name`.
- Index `ix_output_specs_status`: `status`.
- Index `ix_output_specs_type`: `type`.

### `payload_templates`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `model_family` | `VARCHAR(64)` | no | `` |  |
| `payload` | `JSON` | no | `` |  |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_payload_templates_status`: `status IN ('draft', 'active')`.
- Unique `uq_payload_templates_name`: `name`.
- Index `ix_payload_templates_model_family`: `model_family`.
- Unique index `ix_payload_templates_name`: `name`.
- Index `ix_payload_templates_status`: `status`.

### `prompt_resource_conditions`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `prompt_resource_id` | `INTEGER` | no | `` | prompt_resources.id (ON DELETE CASCADE) |
| `field_name` | `VARCHAR(128)` | no | `` |  |
| `operator` | `VARCHAR(32)` | no | `` |  |
| `value_type` | `VARCHAR(32)` | no | `` |  |
| `value` | `VARCHAR(1024)` | no | `` |  |
| `position` | `INTEGER` | no | `` |  |

- Check `ck_prompt_resource_conditions_operator`: `operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains')`.
- Check `ck_prompt_resource_conditions_position`: `position >= 0`.
- Check `ck_prompt_resource_conditions_value_type`: `value_type IN ('manual', 'sample-field')`.
- Unique `uq_prompt_resource_conditions_position`: `prompt_resource_id, position`.
- Index `ix_prompt_resource_conditions_prompt_resource_id`: `prompt_resource_id`.

### `prompt_resources`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `payload_template_id` | `INTEGER` | no | `` | payload_templates.id (ON DELETE CASCADE) |
| `name` | `VARCHAR(128)` | no | `` |  |
| `source_table` | `VARCHAR(64)` | no | `` |  |
| `batch_limit` | `INTEGER` | no | `1` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_prompt_resources_batch_limit`: `batch_limit > 0`.
- Check `ck_prompt_resources_source_table`: `source_table IN ('derivatives', 'samples', 'step_outputs')`.
- Unique `uq_prompt_resources_template_name`: `payload_template_id, name`.
- Index `ix_prompt_resources_payload_template_id`: `payload_template_id`.

### `sample_mapping`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `derivative_group_id` | `INTEGER` | no | `` | derivative_groups.id (ON DELETE CASCADE) |
| `derivative_field` | `VARCHAR(64)` | no | `name` |  |
| `sample_field` | `VARCHAR(64)` | no | `name` |  |
| `operator` | `VARCHAR(32)` | no | `` |  |
| `case_sensitive` | `BOOLEAN` | no | `0` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_sample_mapping_operator`: `operator IN ('equals', 'contains', 'starts_with', 'ends_with')`.
- Unique `uq_sample_mapping_derivative_group_id`: `derivative_group_id`.
- Index `ix_sample_mapping_derivative_field`: `derivative_field`.
- Unique index `ix_sample_mapping_derivative_group_id`: `derivative_group_id`.
- Index `ix_sample_mapping_operator`: `operator`.
- Index `ix_sample_mapping_sample_field`: `sample_field`.

### `sample_set_samples`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `sample_set_id` | `INTEGER` | no | `` | PK; sample_sets.id (ON DELETE CASCADE) |
| `sample_id` | `VARCHAR(255)` | no | `` | PK; samples.id (ON DELETE CASCADE) |
| `position` | `INTEGER` | no | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Index `ix_sample_set_samples_sample_id`: `sample_id`.
- Index `ix_sample_set_samples_sample_set_id_position`: `sample_set_id, position`.

### `sample_sets`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `description` | `TEXT` | yes | `` |  |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_sample_sets_status`: `status IN ('draft', 'active')`.
- Index `ix_sample_sets_name`: `name`.
- Index `ix_sample_sets_status`: `status`.

### `samples`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `VARCHAR(255)` | no | `` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `blob` | `BLOB` | yes | `` |  |
| `mime_type` | `VARCHAR(255)` | yes | `` |  |
| `ground_truth_text` | `TEXT` | yes | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Unique index `ix_samples_name`: `name`.

### `step_executors`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `VARCHAR(64)` | no | `` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `description` | `TEXT` | no | `` |  |
| `config_schema` | `JSON` | no | `` |  |
| `methods` | `JSON` | no | `` |  |
| `input_schema` | `JSON` | no | `` |  |
| `output_schema` | `JSON` | no | `` |  |
| `active` | `BOOLEAN` | no | `true` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |


### `step_outputs`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `execution_job_id` | `INTEGER` | no | `` | execution_jobs.id (ON DELETE CASCADE) |
| `workflow_id` | `INTEGER` | no | `` | workflows.id (ON DELETE CASCADE) |
| `workflow_step_id` | `INTEGER` | no | `` | workflow_steps.id (ON DELETE CASCADE) |
| `sample_id` | `VARCHAR(255)` | no | `` | samples.id (ON DELETE CASCADE) |
| `attempt_no` | `INTEGER` | no | `` |  |
| `assembled_model_payload` | `JSON` | no | `` |  |
| `raw_model_response` | `TEXT` | no | `` |  |
| `parsed_output` | `JSON` | yes | `` |  |
| `parse_status` | `VARCHAR(32)` | yes | `` |  |
| `parse_error` | `TEXT` | yes | `` |  |
| `cer` | `FLOAT` | yes | `` |  |
| `wer` | `FLOAT` | yes | `` |  |
| `hallucination_count` | `INTEGER` | yes | `` |  |
| `time_elapsed` | `FLOAT` | no | `` |  |
| `started_at` | `DATETIME` | no | `` |  |
| `completed_at` | `DATETIME` | no | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_step_outputs_parse_status`: `(parse_status IS NULL) OR (parse_status IN ('success', 'failed'))`.
- Unique `uq_step_outputs_job_step`: `execution_job_id, workflow_step_id`.
- Index `ix_step_outputs_execution_job_id`: `execution_job_id`.
- Index `ix_step_outputs_parse_status`: `parse_status`.
- Index `ix_step_outputs_sample_id`: `sample_id`.
- Index `ix_step_outputs_workflow_id`: `workflow_id`.
- Index `ix_step_outputs_workflow_step_id`: `workflow_step_id`.

### `workflow_dag_edges`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `workflow_id` | `INTEGER` | no | `` | workflows.id (ON DELETE CASCADE) |
| `from_workflow_dag_node_id` | `INTEGER` | no | `` | workflow_dag_nodes.id (ON DELETE CASCADE) |
| `to_workflow_dag_node_id` | `INTEGER` | no | `` | workflow_dag_nodes.id (ON DELETE CASCADE) |
| `condition` | `JSON` | yes | `` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Index `ix_workflow_dag_edges_from_workflow_dag_node_id`: `from_workflow_dag_node_id`.
- Index `ix_workflow_dag_edges_to_workflow_dag_node_id`: `to_workflow_dag_node_id`.
- Index `ix_workflow_dag_edges_workflow_id`: `workflow_id`.

### `workflow_dag_nodes`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `workflow_id` | `INTEGER` | no | `` | workflows.id (ON DELETE CASCADE) |
| `workflow_step_id` | `INTEGER` | no | `` | workflow_steps.id (ON DELETE CASCADE) |
| `row` | `INTEGER` | no | `1` |  |
| `col` | `INTEGER` | no | `1` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Index `ix_workflow_dag_nodes_workflow_id`: `workflow_id`.
- Index `ix_workflow_dag_nodes_workflow_step_id`: `workflow_step_id`.

### `workflow_steps`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `step_executor_id` | `VARCHAR(64)` | no | `` | step_executors.id (ON DELETE RESTRICT) |
| `method` | `VARCHAR(64)` | no | `` |  |
| `executor_config` | `JSON` | no | `` |  |
| `payload_template_id` | `INTEGER` | yes | `` | payload_templates.id (ON DELETE SET NULL) |
| `output_spec_id` | `INTEGER` | yes | `` | output_specs.id (ON DELETE SET NULL) |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_workflow_steps_status`: `status IN ('draft', 'active')`.
- Unique `uq_workflow_steps_name`: `name`.
- Unique index `ix_workflow_steps_name`: `name`.
- Index `ix_workflow_steps_output_spec_id`: `output_spec_id`.
- Index `ix_workflow_steps_payload_template_id`: `payload_template_id`.
- Index `ix_workflow_steps_status`: `status`.
- Index `ix_workflow_steps_step_executor_id`: `step_executor_id`.

### `workflows`

| Column | Type | Nullable | Default | Key / relationship |
| --- | --- | --- | --- | --- |
| `id` | `INTEGER` | no | `autoincrement` | PK |
| `name` | `VARCHAR(255)` | no | `` |  |
| `sample_set_id` | `INTEGER` | no | `` | sample_sets.id (ON DELETE CASCADE) |
| `description` | `TEXT` | yes | `` |  |
| `status` | `VARCHAR(32)` | no | `draft` |  |
| `created_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |
| `updated_at` | `DATETIME` | no | `CURRENT_TIMESTAMP` |  |

- Check `ck_workflows_status`: `status IN ('draft', 'finalized')`.
- Index `ix_workflows_name`: `name`.
- Index `ix_workflows_status`: `status`.

## API shape

Existing `/api/v2` routes and `data` / `items` response envelopes remain in place.
Record fields use the table inventory above. List endpoints return their existing
summary subsets. Binary content uses `blob_base64`, `blob_size`, and `has_blob`;
raw `blob` bytes stay in storage. API timestamps keep their existing serialization.
Unknown request keys, including retired field names, are rejected.

- Derivatives: `id`, `name`, `sample_id`, `derivative_group_id`, `category`,
  `mime_type`, timestamps, and blob metadata. No `originating_sample_id` or
  `derivative_group_name`. Backend name search joins `derivative_groups`; frontend
  lists, filters, and details look up the loaded group by `derivative_group_id`.
- Derivative groups: `id`, `name`, `description`, `position_rule`, `mapping_type`,
  `status`, `created_at`. Mapping records own their `id` and point back through
  `derivative_group_id`. Creating a group from selected derivatives accepts
  `derivative_ids`.
- Workflow steps use `id`, `name`, `step_executor_id`, `method`, `executor_config`,
  `payload_template_id`, `output_spec_id`, `status`, `created_at`.
- Payload templates use `id`, `name`, `model_family`, `payload`, `status`,
  `created_at`, and nested `resources`. Resource records include their `id`,
  `payload_template_id`, `name`, `source_table`, `batch_limit`, `created_at`, and
  `conditions`; conditions include `id`, `prompt_resource_id`, `field_name`,
  `operator`, `value_type`, `value`, and `position`. Creates omit generated IDs,
  timestamps, and condition positions. Template expressions use `{{sample.id}}`,
  `{{sample.name}}`, `{{sample.blob}}`, and `{{sample.mime_type}}`.
- Sample sets retain `sample_ids` as related membership IDs. Workflows retain
  `sample_set_id`; their `name` is the workflow's own name.
- Execution jobs use `id` and retain `workflow_id`, `sample_id`, and
  `current_workflow_dag_node_id`. List responses add `next_step_name`; details add
  canonical `workflow_steps` and `step_outputs`. Job event rows identify the job
  with `id`, including filtered WebSocket subscriptions.
- Batch deletes and execution queue/dequeue/retry requests use `{"ids": [...]}`.
  DAG edge deletion uses `{"id": ...}`. Relationship selections retain qualified
  names, such as `sample_ids` and `derivative_ids`.

## Development database recreation

There are no migrations. `metadata.create_all()` initializes a fresh schema and
startup seeds the executor catalog. Existing databases must be recreated before
running this version; bootstrapping does not convert old columns.

The following commands **delete this Compose project's development database and
frontend cache volumes**. Run them from the repository root. The explicit project
name `scriptbench` matches the default project for this repository; if you started
Compose under a different project name, use that same name on every command.

```bash
docker compose -p scriptbench -f docker-compose-dev.yml down --volumes
docker compose -p scriptbench -f docker-compose-dev.yml build backend frontend
docker compose -p scriptbench -f docker-compose-dev.yml up -d --wait postgres
docker compose -p scriptbench -f docker-compose-dev.yml run --rm --no-deps backend python -c 'from backend.api.dependencies import get_engine; get_engine()'
```

Set `EMMO_SOURCE` to the absolute path of the complete EMMO dataset, including
`images`, `ground_truth_txt`, and `segementation_line_crops` (or
`segmentation_line_crops`). The checked-in source images alone are insufficient:
the manuscript bootstrap also requires the line crops. Then run:

```bash
EMMO_SOURCE="/absolute/path/to/EMMO"
docker compose -p scriptbench -f docker-compose-dev.yml run --rm --no-deps \
  -v "$EMMO_SOURCE:/emmo:ro" backend \
  python -m backend.scripts.bootstrapping.manuscripts --emmo-root /emmo
docker compose -p scriptbench -f docker-compose-dev.yml run --rm --no-deps \
  backend python -m backend.scripts.bootstrapping.workflow --executor gemini
docker compose -p scriptbench -f docker-compose-dev.yml run --rm --no-deps \
  backend python -m backend.scripts.bootstrapping.workflow --executor anthropic
docker compose -p scriptbench -f docker-compose-dev.yml up -d backend frontend
```

The bootstrap expects 19 source samples by default; a deliberate smaller fixture
can use `--expected-sample-count N`. Both workflow bootstraps are idempotent and do
not call providers. `DEV=true` enables stub execution in development.

For the default local SQLite setup, stop the backend, remove
`backend/database/economic_upheaval.db` (and any matching `-wal`/`-shm` files), then
run schema initialization and the same bootstrap modules with your Python virtual
environment. If `DATABASE_URL` is set, recreate that selected development database
instead. These commands were documented, not run against existing user data.

## Validation results

Validated in the isolated refactor worktree on September 10, 2026:

- Imported 84 backend table, repository, model, endpoint, and service modules.
- Full backend suite: 47 test methods ran. The only failures are the two pre-existing
  Anthropic retryability subcases (HTTP 429 and 500) in
  `test_known_errors_cross_execution_boundary`. Both were reproduced against the
  untouched source snapshot; the provider implementation and those expectations
  remain unchanged. All schema, API, execution, bootstrap, and other tests passed.
- Eight canonical-contract tests passed, covering all 19 tables, FK targets,
  PostgreSQL DDL compilation, SQLite constraints/cascades, request rejection,
  group mapping/search, blob metadata, nested prompt resources, DAG CRUD, and
  filtered job events. PostgreSQL DDL was compiled and the staged canonical
  PostgreSQL copy was exercised through every catalog endpoint before cutover.
- Four frontend tests passed for local IDs, group display-name lookup/rename,
  membership filters, workflow-step relationship selectors, and form payloads.
- TypeScript `tsc --noEmit --incremental false` passed with the project's configuration.
- Next.js production build passed, including compilation, type checking, and
  generation of all 13 static pages. The three `align-items: start/end` values in
  the workflow-steps stylesheet now use standard flexbox values, so the cache
  warning no longer occurs when that page compiles.
- `git diff --check` passed.

Reproduce checks with the backend dependencies installed in your active Python
environment and frontend dependencies installed with `npm ci`:

```bash
python -m unittest discover -s backend/tests
python -m unittest backend.tests.test_canonical_contracts
node --test frontend/tests/canonical-contracts.test.js
cd frontend
npx tsc --noEmit --incremental false
npm run build
```

## Evidence review

The table definitions and FK inventory above agree with reflected fresh SQLite
schemas and compiled PostgreSQL DDL. Repository/API names are exercised through
HTTP CRUD and runtime tests; seeds are checked for idempotence for both executors.
Frontend selectors explicitly test IDs that differ from their related template,
specification, and group IDs. On September 11, 2026, the completed refactor was
applied to the Compose-mounted source checkout. Its populated `scriptbench`
PostgreSQL database was copied into a fresh canonical schema, verified through
the backend API (including all 523 derivatives), then switched into service. The
previous database remains available as `scriptbench_before_canonical_20260910`.
An untouched baseline snapshot and checksum manifest are retained at
`/private/tmp/scriptbench-schema-baseline` for comparing this refactor separately
from the pre-existing changes.
