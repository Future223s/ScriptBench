# Seed inventory and overwrite behavior

## Executor metadata

`seed_step_executors(connection)` in
[`step_executor_catalog.py`](../backend/services/step_executor_catalog.py) runs:

- During database initialization in `get_engine()`, after table creation.
- At the beginning of the Economic Upheaval dataset seed.

It upserts these two `step_executors` records by their stable string `id`:

| id | name | description | active |
| --- | --- | --- | --- |
| `gemini` | `Gemini` | `Execute Gemini model requests.` | `true` |
| `anthropic` | `Anthropic` | `Execute Anthropic model requests.` | `true` |

On **every run**, existing records have `name`, `description`, `config_schema`,
`methods`, `input_schema`, `output_schema`, and `active` overwritten with the
code-defined seed values. Manual metadata edits and deactivation of these two
records are therefore reset by the next database initialization or dataset seed.
`id` and `created_at` are preserved. `updated_at` is set to the database's current
timestamp. On insert, both timestamps use database defaults. Other executor IDs
are not modified or deleted.

[`seeded-step-executors.json`](seeded-step-executors.json) contains the **complete,
exact seeded values**, including all schema keywords. Only the two runtime-generated
timestamps are omitted. A test compares this file against actual seeded rows.

### Configuration schemas

Both schemas describe an object, reject extra properties, and require `model`.
`model` is a string with `minLength: 1` and pattern `\S` (at least one non-whitespace
character). Configuration values are stored separately on each workflow step.

| Executor | Parameter | Type | Default | Constraint |
| --- | --- | --- | --- | --- |
| Gemini | `model` | string | none; required | nonempty, contains non-whitespace |
| Gemini | `temperature` | number | `0.0` | `0 <= value <= 2` |
| Gemini | `max_tokens` | integer or null | `null` | integer must be greater than zero |
| Anthropic | `model` | string | none; required | nonempty, contains non-whitespace |
| Anthropic | `max_tokens` | integer | `4096` | greater than zero |
| Anthropic | `temperature` | number or null | `null` | number must be between zero and one |

No model-name choices are seeded into the catalog: the model field is a text input.
The title strings, schema titles, required lists, and null alternatives are recorded
verbatim in the JSON file.

### Methods and internal validation schemas

Both executors currently advertise exactly one method:

```json
{
  "name": "transcribe",
  "label": "Transcribe",
  "description": "Generate text from the resolved payload."
}
```

No batch methods are seeded. `input_schema` and `output_schema` are maps keyed by
`transcribe`:

- **Gemini input:** an object requiring a nonempty `contents` array. Each entry
  requires a nonempty `parts` array; optional `role` is a string. Each part matches
  exactly one of a text object (`text` string) or an inline-data object
  (`inline_data` requiring string `mime_type` and `data`).
- **Anthropic input:** an object requiring a nonempty `messages` array. Each message
  requires `role` (`user` or `assistant`) and `content`. Content is either a string
  or a nonempty array of objects requiring a string `type`. This schema does not
  enumerate or fully validate individual Anthropic content-block structures.
- **Both outputs:** a string, including an empty string.

The input schemas allow extra properties where `additionalProperties` is not
specified. Raw file bytes in resolved payloads are represented as base64 strings
for schema validation without changing the payload passed to the implementation.
These schemas validate internal executor input/results. They are **not** the
payload template or the workflow output specification.

The frontend lists active records (`id`, `name`, `description`) on stage one, then
gets the selected full record on stage two. Runtime configuration and method
validation read the database record. Executable handlers remain in the code registry.

## Economic Upheaval demo bootstrapping

[`manuscripts.py`](../backend/scripts/bootstrapping/manuscripts.py) runs independently
from Compose startup. Its input is an `EMMO` directory containing `images`,
`ground_truth_txt`, and `segementation_line_crops` (the standard-spelling
`segmentation_line_crops` is also accepted). The expected sample count is checked
(19 by default).

| Table | Records and values written |
| --- | --- |
| `samples` | One row per source image, keyed by sample ID derived from the filename; updates sample name, image bytes, MIME type, and UTF-8 ground-truth text. |
| `derivatives` | One row per crop, matched by sample ID and crop filename; updates image bytes, MIME type, and membership in `Line Crops`. |
| `derivative_groups` | `Line Crops`, description `Economic Upheaval eScriptorium segmentation line crops.`, mapping type `one-to-many`, status `active`, and the mapping rules below. |
| `membership_mapping` | For `Line Crops`: `derivative_field=name`, `operator=contains`, `pattern=_line_`, `case_sensitive=false`. |
| `sample_mapping` | For `Line Crops`: derivative name contains sample name, case-insensitive. |
| `sample_sets` | `test`, description `Economic Upheaval source pages for the transcription demo.`, status `active`. |
| `sample_set_samples` | Replaces this sample set's memberships with the discovered samples, in discovery order, with zero-based positions. |

The derivative group's `position_rule` stores the same membership and sample-matching
settings under `membership_*` and `sample_mapping_*` keys; the exact keys and values
are in `_upsert_derivative_group()` in `manuscripts.py`.

[`workflow.py`](../backend/scripts/bootstrapping/workflow.py) creates one finalized,
single-node transcription workflow for the required `--executor` argument. It first
requires the `test` sample set created by the manuscripts bootstrap. Each run upserts
that executor's payload template, output specification, workflow step, workflow, and
DAG node.

### Workflow bootstrap configurations

| Step name | step_executor_id | method | executor_config |
| --- | --- | --- | --- |
| `Gemini transcription step` | `gemini` | `transcribe` | `{"model": "gemini-3.1-flash-lite", "temperature": 0.0}` |
| `Anthropic transcription step` | `anthropic` | `transcribe` | `{"model": "claude-sonnet-4-6", "max_tokens": 4096}` |

These selected values are workflow-step configuration, not catalog defaults.
The shared literal diplomatic transcription instructions are defined verbatim in
`_upsert_transcription_smoke_test()` in the workflow bootstrap. Gemini uses a user `contents`
entry containing text and `inline_data`; Anthropic uses a user `messages` entry
containing an image source and the same text. Both templates bind the image to
`{{sample.blob}}` and its MIME type to `{{sample.mime_type}}`.
Anthropic's adapter base64-encodes the resolved image bytes when sending the request.

Named bootstrap records are updated in place on repeat runs; generated IDs are
retained. Missing records are inserted. Rows outside the seed's matching names/keys
are not globally cleared, and old source rows are not pruned merely because a file
was removed from the source directory. The membership and DAG replacements above
are explicit exceptions to retaining existing relationships.

No credentials, execution jobs, model responses, or additional executor methods are
seeded. Bootstrapping does not execute either provider. Fresh schemas come from table
definitions; this seed does not migrate old schemas or reset existing databases.

For table/API fields, foreign keys, and exact development reset commands, see
[Canonical database and API contracts](canonical-schema.md).
