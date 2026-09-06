# Execution Paths

## Substantive paths

### PR-1: Resolve one execution row

Trigger: `RowCoordinator.prepare_row` after claiming an execution row.

Purpose: Produce an immutable prompt request for the row's current workflow step.

`execution row -> load payload template/resources -> resolve source rows -> render interpolation/$each -> convert text/files -> snapshot jobs`

Result: queued execution jobs, consumed by `WorkflowExecutionCoordinator`.

### PR-2: Refresh provider file references

Trigger: `WorkflowExecutionCoordinator.execute` before a provider request.

Purpose: Ensure every resolved file has a valid provider upload reference.

`job snapshot -> inspect file parts -> reuse/refresh upload -> provider request`

Result: provider-ready file content, consumed by the LLM client.

## Trivial paths

- List payload templates with their prompt resources.
- Retrieve source-table field metadata for the prompt editor.

## Deferred paths

- Nested `$each`: semantics for cross-resource nesting are not defined.
- Regex/pattern conditions: typed pattern semantics and database portability are not defined.
- Resource-to-resource joins: needs explicit join/cardinality contract.
- Batch fan-out across multiple resources: needs a declared alignment rule.
