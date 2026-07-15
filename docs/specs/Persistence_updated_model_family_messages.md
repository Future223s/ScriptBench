## Schema / Repos

## Object lifecycle and mutability

- Configuration objects are editable while `status = draft`.
- Activating a configuration object changes `status` to `active` and makes the object immutable.
- Changes to an active object are made by creating a new object; active rows are never edited in place.
- Child configuration rows inherit the lifecycle of their owning parent and do not need a separate status field.
- `samples`, `assets`, and `artifacts` allow metadata updates, but their source blobs, identities, and lineage are immutable after creation.
- `workflows` remain configurable while `status = draft` and become immutable when finalized or when execution starts.
- `execution_rows` may update only operational status and timestamps after creation.
- `object_uploads.upload_ref` and freshness timestamps remain refreshable because they are external cache references.
- Execution evidence, including `model_outputs`, is append-only.
- Unless otherwise specified, objects / fields are immutable

### `samples`

- Fields
  - `sample_id: string`
  - `sample_name: string`
  - `sample_blob: binary`
  - `sample_mime_type: string`
  - `ground_truth_text: text`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `sample_id`
  - unique `sample_name`
- Indexes
  - `sample_name`
- Notes
  - Anchor the original source record.
  - `sample_id` is the database identity; `sample_name` is the UI/display label.
  - Keep `sample_name` unique so the UI can resolve records unambiguously.
  - Keep processed artifacts out of this table.
  - After creation, source identity and content fields are immutable: `sample_id`, `sample_blob`, `sample_mime_type`, and `created_at`.
  - Metadata fields such as `sample_name`, `ground_truth_text`, and `updated_at` remain configurable.

### `assets`

- Fields
  - `asset_id: int`
  - `asset_name: string`
  - `asset_type: string`
  - `asset_blob: binary`
  - `asset_mime_type: string`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `asset_id`
  - unique `asset_name`
- Indexes
  - `asset_name`
  - `asset_type`
- Notes
  - Store fixed prompt assets such as instructions, examples, and reference images here.
  - `asset_id` is the database identity; `asset_name` is the UI/display label.
  - Keep `asset_name` unique so fixed bindings can resolve a single chosen asset.
  - After creation, `asset_id`, `asset_blob`, `asset_mime_type`, and `created_at` are immutable.
  - Metadata fields such as `asset_name`, `asset_type`, and `updated_at` remain configurable.
  - Replacing asset content creates a new asset object.

### `sample_sets`

- Fields
  - `sample_set_id: int`
  - `sample_set_name: string`
  - `sample_set_description: text`
  - `status: string (draft | active)`
  - `created_at: timestamptz`
- Constraints
  - PK `sample_set_id`
- Indexes
  - `sample_set_name`
  - `status`
- Notes
  - Group samples for workflow runs and dataset management.
  - Keep ordering in `sample_set_samples`, not here.
  - The set and its membership are configurable while `status = draft`.
  - Activating the set makes both `sample_sets` and its `sample_set_samples` rows immutable.
  - Changes to an active set require creating a new sample set.

### `sample_set_samples`

- Fields
  - `sample_set_id: int`
  - `sample_id: string`
  - `position: int`
  - `created_at: timestamptz`
- Constraints
  - PK `(sample_set_id, sample_id)`
  - FK `sample_set_id -> sample_sets.sample_set_id` on delete cascade
  - FK `sample_id -> samples.sample_id` on delete cascade
- Indexes
  - `sample_id`
  - `(sample_set_id, position)`
- Notes
  - Preserve sample ordering within a set.
  - Use this table as the join point between sets and samples.
  - Membership and `position` are configurable only while the owning sample set is in draft.
  - Rows are immutable once the owning sample set is active.

### `artifacts`

- Fields
  - `artifact_id: int`
  - `artifact_name: string`
  - `originating_sample_id: string`
  - `artifact_group_id: int`
  - `artifact_group_name`
  - `artifact_category: string ( companion | decomposition )`
  - `artifact_blob: binary`
  - `artifact_mime_type: string`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `artifact_id`
  - unique `(originating_sample_id, artifact_name)`
  - FK `originating_sample_id -> samples.sample_id` on delete cascade
  - FK `parent_artifact_id -> artifacts.artifact_id` on delete set null
  - FK `artifact_group_id -> artifact_groups.artifact_group_id` on delete set null
- Indexes
  - `artifact_name`
  - `originating_sample_id`
  - `parent_artifact_id`
  - `artifact_group_id`
  - `artifact_category`
- Notes
  - Store both companion and decomposed artifacts here.
  - `artifact_category` simply denotes if an artifact represents the whole sample or just one part within a more granular decomposition.
  - `artifact_id` is the database identity; `artifact_name` is the UI/display label.
  - Keep `artifact_name` unique within a sample so the UI can resolve it cleanly.
  - Preserve lineage through `parent_artifact_id`.
  - After creation, artifact identity, blob content, category, originating sample, parent lineage, and creation timestamp are immutable.
  - Metadata fields such as `artifact_name`, `artifact_group_id`, and `updated_at` remain configurable.
  - Replacing artifact content or lineage creates a new artifact object.
### `artifact_groups`

- Fields
  - `artifact_group_id: int`
  - `artifact_group_name: string`
  - `membership_mapping_id: int`
  - `sample_mapping_id: int`
  - `position_rule: jsonb | null`
  - `mapping_type: string (one-to-one | one-to-many)`
  - `artifact_group_description: text`
  - `status: string (draft | active)`
  - `created_at: timestamptz`
- Constraints
  - PK `artifact_group_id`
  - FK `membership_mapping_id -> membership_mapping.membership_mapping_id` on delete restrict
  - FK `sample_mapping_id -> sample_mapping.sample_mapping_id` on delete restrict
- Indexes
  - `artifact_group_name`
  - `membership_mapping_id`
  - `sample_mapping_id`
  - `mapping_type`
  - `status`
- Notes
  - An artifact group composes two independent reusable mapping definitions.
  - `membership_mapping_id` references the rule that decides whether an artifact belongs in the group.
  - `sample_mapping_id` references the rule that resolves a matched artifact to its originating sample.
  - Evaluate membership mapping first and sample mapping second.
  - An artifact may satisfy the membership mapping while failing or ambiguously satisfying the sample mapping; surface those records for review rather than treating the two outcomes as equivalent.
  - `mapping_type` records how many artifacts are expected per originating sample after sample mapping is applied.
  - `one-to-one` permits at most one artifact in this group for each originating sample.
  - `one-to-many` permits multiple artifacts in this group for each originating sample.
  - `position_rule` controls ordering within the group and is independent of both mappings.
  - Alphabetical ordering is the default when `position_rule` is null.
  - Mapping definitions are configuration metadata for discovery and relationship resolution, not artifact storage.
  - The group, its membership mapping, and its sample mapping are configurable while `status = draft`.
  - Activating the group makes the group and both owned mappings immutable.
  - Changes to an active group or mapping require creating a new artifact group and new mapping objects.

### `membership_mapping`

- Fields
  - `membership_mapping_id: int`
  - `artifact_group_id: int`
  - `artifact_field: string`
  - `operator: string (equals | contains | starts_with | ends_with)`
  - `pattern: string`
  - `case_sensitive: bool`
  - `created_at: timestamptz`
- Constraints
  - PK `membership_mapping_id`
  - FK `artifact_group_id -> artifact_groups.artifact_group_id` on delete cascade
  - unique `artifact_group_id`
  - `pattern` must not be empty
- Indexes
  - `artifact_group_id`
  - `artifact_field`
  - `operator`
- Notes
  - Stores the single membership predicate owned by an artifact group.
  - `artifact_group_id` identifies the artifact group whose membership behavior this row defines.
  - `artifact_field` is a controlled lookup into the artifact record and defaults to `artifact_name`.
  - `operator` defines how the fixed `pattern` is compared with the selected artifact field.
  - Supported operators are intentionally simple: `equals`, `contains`, `starts_with`, and `ends_with`.
  - Regular expressions are not supported.
  - `case_sensitive = false` should be the default.
  - Example: to place every artifact whose name contains `_line_` into a group:

```text
artifact_field = artifact_name
operator = contains
pattern = _line_
case_sensitive = false
```

  - This mapping is evaluated whenever a new artifact is uploaded or when an existing artifact is explicitly re-evaluated.
  - The mapping only decides group membership. It does not determine the originating sample.
  - This row inherits the lifecycle of its owning artifact group and is immutable once that group is active.

### `sample_mapping`

- Fields
  - `sample_mapping_id: int`
  - `artifact_group_id: int`
  - `artifact_field: string`
  - `sample_field: string`
  - `operator: string (equals | contains | starts_with | ends_with)`
  - `case_sensitive: bool`
  - `created_at: timestamptz`
- Constraints
  - PK `sample_mapping_id`
  - FK `artifact_group_id -> artifact_groups.artifact_group_id` on delete cascade
  - unique `artifact_group_id`
- Indexes
  - `artifact_group_id`
  - `artifact_field`
  - `sample_field`
  - `operator`
- Notes
  - Stores the single originating-sample mapping owned by an artifact group.
  - `artifact_group_id` identifies the artifact group whose sample-resolution behavior this row defines.
  - `artifact_field` is a controlled lookup into the artifact record and defaults to `artifact_name`.
  - `sample_field` is a controlled lookup into the sample record and defaults to `sample_name`.
  - The selected `sample_field` value is treated as the comparison value for each candidate sample.
  - Supported operators are intentionally simple: `equals`, `contains`, `starts_with`, and `ends_with`.
  - Regular expressions, capture groups, and extraction expressions are not supported.
  - `case_sensitive = false` should be the default.
  - Example: to map `sample_1_line_01` to the sample named `sample_1`:

```text
artifact_field = artifact_name
sample_field = sample_name
operator = contains
case_sensitive = false
```

  - Evaluation flow:
    1. Load the samples that are eligible to originate the artifact.
    2. Read each candidate sample's `sample_field` value.
    3. Compare that value with the artifact's `artifact_field` using `operator`.
    4. If exactly one sample matches, set `artifacts.originating_sample_id` to that sample's `sample_id`.
    5. If no samples match, leave the artifact unresolved and surface it for review.
    6. If multiple samples match, treat the result as ambiguous and surface it for review.
  - Sample matching should prefer the longest matching `sample_field` value when names overlap, but an exact single match is still required before persisting `originating_sample_id`.
  - The artifact group's `mapping_type` validates one-to-one or one-to-many cardinality after a sample is resolved; it does not belong in this table.
  - This row inherits the lifecycle of its owning artifact group and is immutable once that group is active.

### `workflows`

- Fields
  - `workflow_id: int`
  - `workflow_name: string`
  - `sample_set_id: int`
  - `workflow_description: string`
  - `status: string (draft | finalized)`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `workflow_id`
  - FK `sample_set_id -> sample_sets.sample_set_id` on delete set null
- Indexes
  - `workflow_name`
  - `status`
- Notes
  - Own the workflow-level scope for a run.
  - Own the workflow-level DAG structure.
  - The workflow and its DAG are configurable while `status = draft`.
  - Finalizing the workflow or starting execution makes the workflow definition and DAG immutable for reproducibility.
  - Referenced step, payload template, and output spec objects remain pinned to preserve output consistency.
  - Changes to a finalized workflow require creating a new workflow object.

### `workflow_dag_nodes`

- Fields
  - `workflow_dag_node_id: int`
  - `workflow_id: int`
  - `workflow_step_id: int`
  - `created_at: timestamptz`
- Constraints
  - PK `workflow_dag_node_id`
  - FK `workflow_id -> workflows.workflow_id` on delete cascade
  - FK `workflow_step_id -> workflow_steps.workflow_step_id` on delete cascade
- Indexes
  - `workflow_id`
  - `workflow_step_id`
- Notes
  - Represent the workflow's instantiation of a shared step template in a specific DAG node.
  - Nodes are configurable only while the owning workflow is in draft and are immutable after finalization or execution start.


### `workflow_dag_edges`

- Fields
  - `workflow_dag_edge_id: int`
  - `workflow_id: int`
  - `from_workflow_dag_node_id: int`
  - `to_workflow_dag_node_id: int`
  - `edge_condition: jsonb`
  - `created_at: timestamptz`
- Constraints
  - PK `workflow_dag_edge_id`
  - FK `workflow_id -> workflows.workflow_id` on delete cascade
  - FK `from_workflow_dag_node_id -> workflow_dag_nodes.workflow_dag_node_id` on delete cascade
  - FK `to_workflow_dag_node_id -> workflow_dag_nodes.workflow_dag_node_id` on delete cascade
- Indexes
  - `workflow_id`
  - `from_workflow_dag_node_id`
  - `to_workflow_dag_node_id`
- Notes
  - Encode ordering, branching, and fan-in/fan-out.
  - The default edge condition is `depends_on`, meaning the upstream node must be completed before traversal.
  - Keep edge conditions deterministic and inspectable.
  - Edges are configurable only while the owning workflow is in draft and are immutable after finalization or execution start.

### `workflow_steps`

- Fields
  - `workflow_step_id: int`
  - `step_name: string`
  - `model: string`
  - `payload_template_id: int`
  - `output_spec_id: int`
  - `status: string (draft | active)`
  - `created_at: timestamptz`
- Constraints
  - PK `workflow_step_id`
  - unique `step_name`
  - FK `payload_template_id -> payload_template.payload_template_id` on delete set null
  - FK `output_spec_id -> output_specs.output_spec_id` on delete set null
- Indexes
  - `step_name`
  - `payload_template_id`
  - `output_spec_id`
  - `status`
- Notes
  - `workflow_steps` are shared step templates that can be referenced by multiple workflows and multiple DAG nodes.
  - `workflow_step_id` is the database identity; `step_name` is the UI/display label.
  - `model` stays on the step template because the concrete model choice belongs to execution configuration.
  - The model family is derived from the referenced payload template so prompt assembly and upload handling use the same service contract as the payload definition.
  - The step is configurable while `status = draft`.
  - Activating the step makes its model selection and referenced payload/output objects immutable.
  - Changes to an active step require creating a new workflow step object.
  - Keep `step_name` unique so the UI can present stable choices.
  - `payload_template_id` points to the reusable, model-family-specific payload template object.
  - `output_spec_id` points to the model-emitted shape object.
  - Step sequencing should live on the workflow definition or workflow DAG, not on the step template itself.

### `payload_template`

- Fields
  - `payload_template_id: int`
  - `payload_template_name: string`
  - `model_family: string`
  - `payload_template: jsonb`
  - `status: string (draft | active)`
  - `created_at: timestamptz`
- Constraints
  - PK `payload_template_id`
  - unique `payload_template_name`
- Indexes
  - `payload_template_name`
  - `model_family`
  - `status`
- Repository Methods
  - `insert`
  - `fetch`
  - `update` (draft objects only)
  - `delete` (draft, unreferenced objects only)
- Notes
  - The template is the reusable payload structure referenced by steps.
  - `payload_template_id` is the database identity; `payload_template_name` is the UI/display label.
  - `model_family` selects the service adapter responsible for constructing the final provider payload, resolving provider-specific upload references such as file references, and applying any family-specific request rules.
  - `payload_template` stores the provider-facing payload skeleton outside any modeled messages.
  - Message-oriented prompt structure may be modeled through `payload_messages`; messages are an intermediate representation and are not required to be emitted unchanged by every model family.
  - The template, its `payload_messages`, and its `payload_inputs` are configurable while `status = draft`.
  - Activating the template makes its model family, JSON structure, message definitions, and owned input definitions immutable.
  - Changes to an active template require creating a new payload template object with new message and input rows.
  - Keep `payload_template_name` unique.

### `payload_messages`

- Fields
  - `payload_message_id: int`
  - `payload_template_id: int`
  - `role: string`
  - `position: int`
  - `message_template: jsonb`
  - `created_at: timestamptz`
- Constraints
  - PK `payload_message_id`
  - FK `payload_template_id -> payload_template.payload_template_id` on delete cascade
  - unique `(payload_template_id, position)`
  - unique `(payload_template_id, payload_message_id)`
  - `position >= 0`
  - `role` must not be empty
- Indexes
  - `payload_template_id`
  - `(payload_template_id, position)`
  - `role`
- Notes
  - Stores an optional, ordered intermediate message representation for model families whose prompts are naturally assembled as role-based messages.
  - `role` represents the message role understood by the selected model-family adapter, such as `system`, `developer`, `user`, or `assistant`.
  - `message_template` stores the message-local structure, such as content blocks, into which message-bound inputs are written.
  - The prompt-construction service may translate, merge, or ignore these rows when producing the actual provider payload.
  - A payload template may have no message rows when its inputs bind directly into the root payload.
  - These rows inherit the lifecycle of their owning payload template and are immutable once that template is active.

### `payload_inputs`

- Fields
  - `payload_input_id: int`
  - `payload_template_id: int`
  - `payload_message_id: int | null`
  - `binding_mode: string (fixed | sample-bound)`
  - `source_type: string`
  - `source_object_id: text | null`
  - `artifact_group_id: int | null`
  - `required: bool`
  - `template_path: jsonb`
  - `ordering_rule: jsonb | null`
  - `batch_limit: int | null`
  - `created_at: timestamptz`
- Constraints
  - PK `payload_input_id`
  - FK `payload_template_id -> payload_template.payload_template_id` on delete cascade
  - composite FK `(payload_template_id, payload_message_id) -> payload_messages(payload_template_id, payload_message_id)` on delete cascade
  - FK `artifact_group_id -> artifact_groups.artifact_group_id` on delete restrict
  - `source_object_id IS NOT NULL` when `binding_mode = fixed`
  - `artifact_group_id IS NOT NULL` when `binding_mode = sample-bound`
  - `artifact_group_id IS NULL` when `binding_mode = fixed`
  - `source_object_id IS NULL` when `binding_mode = sample-bound`
- Indexes
  - `payload_template_id`
  - `payload_message_id`
  - `binding_mode`
  - `source_type`
  - `source_object_id`
  - `artifact_group_id`
- Notes
  - `source_type` selects the source object type: `asset`, `sample`, `artifact`, or `model_output`.
  - `binding_mode = fixed` means the UI selects one row from the chosen source type and stores its identifier in `source_object_id`.
  - `binding_mode = sample-bound` means the input resolves records through the selected `artifact_group_id`.
  - The artifact group owns the membership and sample-mapping rules used to identify eligible artifacts and associate them with the current sample.
  - Matching logic is not duplicated in `payload_inputs`.
  - For sample-bound inputs, the prompt-construction layer evaluates the referenced artifact group and selects the artifacts resolved to the current sample.
  - When `payload_message_id` is set, the input belongs to that message and `template_path` is resolved relative to the message's `message_template`.
  - When `payload_message_id` is null, the input binds directly to the root `payload_template` and `template_path` is resolved relative to that root object.
  - The composite foreign key prevents an input from referencing a message owned by a different payload template.
  - The model-family adapter converts resolved source objects into the correct provider representation, including upload/file references where required.
  - `ordering_rule` controls how resolved records are sorted before batching or zipping.
  - Alphabetical ordering is the default when `ordering_rule` is null.
  - `ordering_rule` is stored in the database only and is not exposed in the prompt definition interface.
  - `batch_limit` is the maximum number of resolved records that may be bound into one prompt batch for this input.
  - If the artifact group resolves more than `batch_limit` records, the prompt-construction layer splits them into additional batches.
  - If the artifact group resolves fewer than `batch_limit` records, the final batch may be smaller.
  - If a template has multiple sample-bound inputs, their batches are zipped together by batch index rather than treated independently or cross-producted.
  - The zip-together behavior is a design note and is not required for the first implementation.
  - These rows inherit the lifecycle of their owning payload template and are immutable once that template is active.


### `output_specs`

- Fields
  - `output_spec_id: int`
  - `output_spec_name: string`
  - `type: string (ENUM: plain-text, json)`
  - `item_schema: jsonb | null`
  - `instructions: text | null`
  - `status: string (draft | active)`
  - `created_at: timestamptz`
- Constraints
  - PK `output_spec_id`
  - unique `output_spec_name`
- Indexes
  - `output_spec_name`
  - `type`
  - `status`
- Notes
  - Mirrors the current output-format contract used by the prompt spec model.
  - `output_spec_id` is the database identity; `output_spec_name` is the UI/display label.
  - `item_schema` is optional and is intended for structured JSON outputs.
  - `instructions` can constrain formatting expectations, including `item_schema` field definitions and guidance on which information should produce an `item_schema` when multiple locations require one.`
  - The output spec is configurable while `status = draft`.
  - Activating the output spec makes its type, schema, and instructions immutable.
  - Changes to an active output spec require creating a new output spec object.
  - Keep `output_spec_name` unique.

### `execution_rows`

- Fields
  - `execution_row_id: int`
  - `workflow_id: int`
  - `sample_id: string`
  - `status: string (not_started | queued | in_progress | completed)`
  - `execution_scope: string (source | decomposed_item)`
  - `parent_execution_row_id: int`
  - `decomposed_item_position: int | null`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `execution_row_id`
  - FK `workflow_id -> workflows.workflow_id` on delete cascade
  - FK `sample_id -> samples.sample_id` on delete cascade
  - FK `parent_execution_row_id -> execution_rows.execution_row_id` on delete cascade
  - FK `current_workflow_dag_node_id -> workflow_dag_nodes.workflow_dag_node_id` on delete set null
  - CHECK `decomposed_item_position IS NOT NULL` when `execution_scope = decomposed_item`
- Indexes
  - `workflow_id`
  - `current_workflow_dag_node_id`
  - `sample_id`
  - `status`
  - `execution_scope`
  - `decomposed_item_position`
- Notes
  - `source` is the root execution row for a sample at a workflow step.
  - `parent_execution_row_id` is null on the root row and points back to the root row for each decomposed child.
  - `decomposed_item` is used for child rows produced when a parent row is broken into smaller execution rows.
  - lineage is always `child -> parent_execution_row_id -> root`
  - progression along DAG is derived from successful `model_outputs`; a row is complete only when its required dependencies have successful model output rows in `model_outputs`. Addresses issue with `current_workflow_dag_node_id` field not being sufficient for full progression tracking
  - The root row status is derived from child status composition: any child moving to `in_progress` moves the root to `in_progress`, and all children `completed` moves the root to `completed`.
  - `decomposed_item_position` should be used to preserve stable ordering for fanout and reconciliation.
  - After creation, workflow, sample, parent lineage, scope, DAG association, and decomposition position are immutable.
  - Only `status`, `updated_at`, and other operational timestamps may change.

### `model_outputs`

- Fields
  - `model_output_id: int`
  - `execution_row_id: int`
  - `workflow_step_id: int`
  - `attempt_no: int`
  - `assembled_model_payload: jsonb`
  - `raw_model_response: text`
  - `parsed_output: jsonb`
  - `parse_status: string | null (success | failed)`
  - `parse_error: text`
  - `time_elapsed: float`
  - `started_at: timestamptz`
  - `completed_at: timestamptz`
  - `created_at: timestamptz`
- Constraints
  - PK `model_output_id`
  - FK `execution_row_id -> execution_rows.execution_row_id` on delete cascade
  - FK `workflow_step_id -> workflow_steps.workflow_step_id` on delete cascade
  - unique `(execution_row_id, attempt_no)`
- Indexes
  - `execution_row_id`
  - `workflow_step_id`
  - `parse_status`
- Notes
  - `assembled_model_payload` is what was sent to the model.
  - `raw_model_response` is what the model returned.
  - `parsed_output` preserve parsed forms when available.
  - `attempt_no` preserves retry history without overwriting prior attempts.
  - `parse_status` is `null` before parsing, `success` when parsing succeeds, and `failed` when parsing fails.
  - The latest successful attempt is the active result.
  - Older attempts remain available for reconciliation and debugging.
  - Rows are append-only execution evidence and must not be updated after creation.
  - Retries create new rows rather than overwriting prior attempts.

### `object_uploads`

- Fields
  - `upload_id: int`
  - `object_type: string`
  - `object_id: text`
  - `model_family: string`
  - `upload_ref: text`
  - `created_at: timestamptz`
  - `updated_at: timestamptz`
- Constraints
  - PK `upload_id`
  - unique `(object_type, object_id, model_family)`
- Indexes
  - `upload_ref`
- Notes
  - Track external upload references for both samples and artifacts.
  - `object_type` is `sample` or `artifact`.
  - Upload references are meant to be reused when still fresh and refreshed when they go stale.
  - Support direct API correlation and pipeline-created records.
  - `object_type`, `object_id`, and `model_family` are immutable after creation.
  - `upload_ref` and freshness-related timestamps may be updated when an external upload expires or is refreshed.
