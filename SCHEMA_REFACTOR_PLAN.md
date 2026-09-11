# Canonical schema implementation outline

Status: validated by the user and implemented in this worktree. See `docs/canonical-schema.md` for the final table/API inventory and recreation commands.

## Baseline

The task worktree was a clean checkout of `2f52761`. The source checkout at
`/Users/sebas/Coding/ScriptBench` contained the derivative rename, executor work,
bootstrap changes, and other uncommitted features described by the handoff.
Those files were snapshot as the baseline, preserved through the refactor, then
the completed changes were applied to the Compose-mounted source checkout.
The pre-refactor snapshot remains available for comparison.

The source already has mostly canonical table columns, but repositories and API
contracts still use the old columns. Its `payload_template` table also conflicts
with foreign keys targeting `payload_templates.id`.

## Implementation by domain, in required order

| Domain | Evidence and established pattern | Planned change / likely files | Assumptions |
| --- | --- | --- | --- |
| Tables and relationships | All 19 SQLAlchemy definitions in `backend/database/tables`, checks in `backend/database/schema.py`; existing `step_executors.id/name` pattern | Apply the inventory below to every table and FK together; name the physical table and Python symbol `payload_templates`; remove its singular alias; use `step_executor_id`, resource `name`, and edge `condition`; preserve column types, nullability, defaults, indexes, uniqueness and delete behavior | No migrations or compatibility columns; preserve composite membership primary key |
| Repositories | `backend/database/repositories`, SQLAlchemy Core selects and `.mappings()` dictionaries | Update column references, joins, writes and entity dictionaries; explicitly distinguish entity `id` from related IDs; remove derivative group name storage; join group relation for backend display/filter needs | Qualified foreign keys remain qualified; derived relationship information must not masquerade as local entity fields |
| API contracts | `backend/models`, `backend/api/v2/endpoints`, shared response envelopes and Pydantic models | Use canonical local field names in requests/responses; retain relational IDs; align nested prompt-resource fields with table columns; canonical blob metadata (`has_blob`, `blob_size`, `blob_base64`); reject legacy request fields instead of aliases | Preserve routes and response envelopes unless required by the existing derivative rename; transport encodes binary data as before |
| Runtime and bootstrap | `backend/services`, `backend/scripts/bootstrapping`, current execution and bootstrap tests | Update runtime dictionary access, template placeholders, mapping field selectors, catalog references and bootstrap upserts; extend tests for schema/FK integrity and API contracts | Preserve ongoing executor functionality and seed behavior; no provider calls needed to validate |
| Frontend | `frontend/src/api/client.ts`, endpoint modules, existing hooks/components/selectors | Update TypeScript entities and payloads, API calls, state, filters, forms, details and selectors together; derive derivative group display names from `derivative_group_id` and loaded groups | Preserve current UI structure and unrelated layout changes |
| Validation and development setup | Backend tests/imports; frontend `tsconfig.json`; source `docker-compose-dev.yml` and bootstrap CLIs | Run backend imports/tests and `tsc --noEmit`; add targeted contract coverage where needed; document exact volume recreation, schema initialization and both bootstrap commands in README/seeding docs | Document destructive database reset commands; do not execute them against existing user data |

## Target table inventory

The specifications below retain SQLAlchemy types and options. `Column(...,
primary_key=True)` defines primary keys; `index=True` defines SQLAlchemy-generated
indexes; `unique=True` and explicit constraints are retained. Every relationship
points at the referenced table's canonical `id`. The join table intentionally
retains its two qualified foreign keys as a composite primary key.

### `assets`

Source: `backend/database/tables/assets_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, unique=True, index=True)
Column('type', String(255), nullable=False, index=True)
Column('blob', LargeBinary, nullable=True)
Column('mime_type', String(255), nullable=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
```

### `derivative_groups`

Source: `backend/database/tables/derivative_groups_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, index=True)
Column('position_rule', JSON, nullable=True)
Column('mapping_type', String(32), nullable=False, server_default='one-to-one', index=True)
Column('description', Text, nullable=True)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
CheckConstraint(MAPPING_TYPE_CHECK_SQL, name='ck_derivative_groups_mapping_type')
CheckConstraint(STATUS_CHECK_SQL, name='ck_derivative_groups_status')
```

### `derivatives`

Source: `backend/database/tables/derivatives_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, index=True)
Column('sample_id', String(255), ForeignKey('samples.id', ondelete='CASCADE'), nullable=True, index=True)
Column('derivative_group_id', Integer, ForeignKey('derivative_groups.id', ondelete='SET NULL'), nullable=True, index=True)
Column('category', String(64), nullable=False, server_default='companion', index=True)
Column('blob', LargeBinary, nullable=False)
Column('mime_type', String(255), nullable=False)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
UniqueConstraint('sample_id', 'name', name='uq_derivatives_sample_id_name')
CheckConstraint(DERIVATIVE_CATEGORY_CHECK_SQL, name='ck_derivatives_category')
```

### `execution_jobs`

Source: `backend/database/tables/execution_jobs_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('workflow_id', Integer, ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False, index=True)
Column('sample_id', String(255), ForeignKey('samples.id', ondelete='CASCADE'), nullable=False, index=True)
Column('current_workflow_dag_node_id', Integer, ForeignKey('workflow_dag_nodes.id', ondelete='CASCADE'), nullable=False, index=True)
Column('status', String(32), nullable=False, server_default='pending', index=True)
Column('error_message', Text, nullable=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
CheckConstraint(EXECUTION_JOB_STATUS_CHECK_SQL, name='ck_execution_jobs_status')
UniqueConstraint('workflow_id', 'sample_id', name='uq_execution_jobs_workflow_sample')
```

### `membership_mapping`

Source: `backend/database/tables/membership_mapping_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('derivative_group_id', Integer, ForeignKey('derivative_groups.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
Column('derivative_field', String(64), nullable=False, server_default='name', index=True)
Column('operator', String(32), nullable=False, index=True)
Column('pattern', String(255), nullable=False)
Column('case_sensitive', Boolean, nullable=False, server_default='0')
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('derivative_group_id', name='uq_membership_mapping_derivative_group_id')
CheckConstraint(MAPPING_OPERATOR_CHECK_SQL, name='ck_membership_mapping_operator')
CheckConstraint("pattern <> ''", name='ck_membership_mapping_pattern_not_empty')
```

### `output_specs`

Source: `backend/database/tables/output_specs_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, unique=True, index=True)
Column('type', String(32), nullable=False, index=True)
Column('item_schema', JSON, nullable=True)
Column('instructions', Text, nullable=True)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('name', name='uq_output_specs_name')
CheckConstraint(OUTPUT_SPEC_TYPE_CHECK_SQL, name='ck_output_specs_type')
CheckConstraint(STATUS_CHECK_SQL, name='ck_output_specs_status')
```

### `payload_templates`

Source: `backend/database/tables/payload_templates_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, unique=True, index=True)
Column('model_family', String(64), nullable=False, index=True)
Column('payload', JSON, nullable=False)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('name', name='uq_payload_templates_name')
CheckConstraint(STATUS_CHECK_SQL, name='ck_payload_template_status')
```

### `prompt_resource_conditions`

Source: `backend/database/tables/prompt_resource_conditions_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('prompt_resource_id', Integer, ForeignKey('prompt_resources.id', ondelete='CASCADE'), nullable=False, index=True)
Column('field_name', String(128), nullable=False)
Column('operator', String(32), nullable=False)
Column('value_type', String(32), nullable=False)
Column('value', String(1024), nullable=False)
Column('position', Integer, nullable=False)
UniqueConstraint('prompt_resource_id', 'position', name='uq_prompt_resource_conditions_position')
CheckConstraint(PROMPT_RESOURCE_OPERATOR_CHECK_SQL, name='ck_prompt_resource_conditions_operator')
CheckConstraint(PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL, name='ck_prompt_resource_conditions_value_type')
CheckConstraint('position >= 0', name='ck_prompt_resource_conditions_position')
```

### `prompt_resources`

Source: `backend/database/tables/prompt_resources_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('payload_template_id', Integer, ForeignKey('payload_templates.id', ondelete='CASCADE'), nullable=False, index=True)
Column('name', String(128), nullable=False)
Column('source_table', String(64), nullable=False)
Column('batch_limit', Integer, nullable=False, server_default='1')
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('payload_template_id', 'name', name='uq_prompt_resources_template_name')
CheckConstraint(PROMPT_RESOURCE_TABLE_CHECK_SQL, name='ck_prompt_resources_source_table')
CheckConstraint('batch_limit > 0', name='ck_prompt_resources_batch_limit')
```

### `sample_mapping`

Source: `backend/database/tables/sample_mapping_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('derivative_group_id', Integer, ForeignKey('derivative_groups.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
Column('derivative_field', String(64), nullable=False, server_default='name', index=True)
Column('sample_field', String(64), nullable=False, server_default='sample_name', index=True)
Column('operator', String(32), nullable=False, index=True)
Column('case_sensitive', Boolean, nullable=False, server_default='0')
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('derivative_group_id', name='uq_sample_mapping_derivative_group_id')
CheckConstraint(MAPPING_OPERATOR_CHECK_SQL, name='ck_sample_mapping_operator')
```

### `sample_set_samples`

Source: `backend/database/tables/sample_set_samples_table.py`.

```python
Column('sample_set_id', Integer, ForeignKey('sample_sets.id', ondelete='CASCADE'), primary_key=True)
Column('sample_id', String(255), ForeignKey('samples.id', ondelete='CASCADE'), primary_key=True)
Column('position', Integer, nullable=False)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
```

```python
Index('ix_sample_set_samples_sample_set_id_position', sample_set_samples.c.sample_set_id, sample_set_samples.c.position)
```

```python
Index('ix_sample_set_samples_sample_id', sample_set_samples.c.sample_id)
```

### `sample_sets`

Source: `backend/database/tables/sample_sets_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, index=True)
Column('description', Text, nullable=True)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
CheckConstraint(STATUS_CHECK_SQL, name='ck_sample_sets_status')
```

### `samples`

Source: `backend/database/tables/samples_table.py`.

```python
Column('id', String(255), primary_key=True)
Column('name', String(255), nullable=False, unique=True, index=True)
Column('blob', LargeBinary, nullable=True)
Column('mime_type', String(255), nullable=True)
Column('ground_truth_text', Text, nullable=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
```

### `step_executors`

Source: `backend/database/tables/step_executors_table.py`.

```python
Column('id', String(64), primary_key=True)
Column('name', String(255), nullable=False)
Column('description', Text, nullable=False)
Column('config_schema', JSON, nullable=False)
Column('methods', JSON, nullable=False)
Column('input_schema', JSON, nullable=False)
Column('output_schema', JSON, nullable=False)
Column('active', Boolean, nullable=False, server_default=true())
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
```

### `step_outputs`

Source: `backend/database/tables/step_outputs_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('execution_job_id', Integer, ForeignKey('execution_jobs.id', ondelete='CASCADE'), nullable=False, index=True)
Column('workflow_id', Integer, ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False, index=True)
Column('workflow_step_id', Integer, ForeignKey('workflow_steps.id', ondelete='CASCADE'), nullable=False, index=True)
Column('sample_id', String(255), ForeignKey('samples.id', ondelete='CASCADE'), nullable=False, index=True)
Column('attempt_no', Integer, nullable=False)
Column('assembled_model_payload', JSON, nullable=False)
Column('raw_model_response', Text, nullable=False)
Column('parsed_output', JSON, nullable=True)
Column('parse_status', String(32), nullable=True, index=True)
Column('parse_error', Text, nullable=True)
Column('cer', Float, nullable=True)
Column('wer', Float, nullable=True)
Column('hallucination_count', Integer, nullable=True)
Column('time_elapsed', Float, nullable=False)
Column('started_at', DateTime(timezone=True), nullable=False)
Column('completed_at', DateTime(timezone=True), nullable=False)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('execution_job_id', 'workflow_step_id', name='uq_step_outputs_job_step')
CheckConstraint('(parse_status IS NULL) OR (' + PARSE_STATUS_CHECK_SQL + ')', name='ck_step_outputs_parse_status')
```

### `workflow_dag_edges`

Source: `backend/database/tables/workflow_dag_edges_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('workflow_id', Integer, ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False, index=True)
Column('from_workflow_dag_node_id', Integer, ForeignKey('workflow_dag_nodes.id', ondelete='CASCADE'), nullable=False, index=True)
Column('to_workflow_dag_node_id', Integer, ForeignKey('workflow_dag_nodes.id', ondelete='CASCADE'), nullable=False, index=True)
Column('condition', JSON, nullable=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
```

### `workflow_dag_nodes`

Source: `backend/database/tables/workflow_dag_nodes_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('workflow_id', Integer, ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False, index=True)
Column('workflow_step_id', Integer, ForeignKey('workflow_steps.id', ondelete='CASCADE'), nullable=False, index=True)
Column('row', Integer, nullable=False, server_default='1')
Column('col', Integer, nullable=False, server_default='1')
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
```

### `workflow_steps`

Source: `backend/database/tables/workflow_steps_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, unique=True, index=True)
Column('step_executor_id', String(64), ForeignKey('step_executors.id', ondelete='RESTRICT'), nullable=False, index=True)
Column('method', String(64), nullable=False)
Column('executor_config', JSON, nullable=False)
Column('payload_template_id', Integer, ForeignKey('payload_templates.id', ondelete='SET NULL'), nullable=True, index=True)
Column('output_spec_id', Integer, ForeignKey('output_specs.id', ondelete='SET NULL'), nullable=True, index=True)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
UniqueConstraint('name', name='uq_workflow_steps_name')
CheckConstraint(STATUS_CHECK_SQL, name='ck_workflow_steps_status')
```

### `workflows`

Source: `backend/database/tables/workflows_table.py`.

```python
Column('id', Integer, primary_key=True, autoincrement=True)
Column('name', String(255), nullable=False, index=True)
Column('sample_set_id', Integer, ForeignKey('sample_sets.id', ondelete='CASCADE'), nullable=False)
Column('description', Text, nullable=True)
Column('status', String(32), nullable=False, server_default='draft', index=True)
Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
Column('updated_at', DateTime(timezone=True), nullable=False, server_default=func.current_timestamp())
CheckConstraint(WORKFLOW_STATUS_CHECK_SQL, name='ck_workflows_status')
```

## Check expressions

Source: `backend/database/schema.py`.

```python
STATUS_CHECK_SQL = "status IN ('draft', 'active')"
WORKFLOW_STATUS_CHECK_SQL = "status IN ('draft', 'finalized')"
OUTPUT_SPEC_TYPE_CHECK_SQL = "type IN ('plain-text', 'json')"
DERIVATIVE_CATEGORY_CHECK_SQL = "category IN ('companion', 'decomposition')"
MAPPING_TYPE_CHECK_SQL = "mapping_type IN ('one-to-one', 'one-to-many')"
MAPPING_OPERATOR_CHECK_SQL = "operator IN ('equals', 'contains', 'starts_with', 'ends_with')"
PAYLOAD_BINDING_MODE_CHECK_SQL = "binding_mode IN ('fixed', 'sample-bound')"
PAYLOAD_SOURCE_TYPE_CHECK_SQL = "source_type IN ('asset', 'sample', 'derivative', 'step_output', 'table_rows')"
PROMPT_RESOURCE_TABLE_CHECK_SQL = "source_table IN ('derivatives', 'samples', 'step_outputs')"
PROMPT_RESOURCE_OPERATOR_CHECK_SQL = "operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains')"
PROMPT_RESOURCE_VALUE_TYPE_CHECK_SQL = "value_type IN ('manual', 'sample-field')"
EXECUTION_JOB_STATUS_CHECK_SQL = "status IN ('pending', 'queued', 'running', 'completed', 'failed')"
EXECUTION_SCOPE_CHECK_SQL = "execution_scope IN ('source', 'decomposed_item')"
PARSE_STATUS_CHECK_SQL = "parse_status IN ('success', 'failed')"
```

## Completion review

Implementation is complete. Final canonical columns, constraints, indexes, FK
relationships, API shapes, validation results, and database recreation commands
are recorded in [the final schema report](docs/canonical-schema.md). Table,
repository/API, runtime/bootstrap, and frontend domains were checked against
their evidence sources. The only backend test failures are the two Anthropic
retryability assertions reproduced on the untouched baseline.
