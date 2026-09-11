# Design Records

## PR-1: Resolve one execution row

#### Input Shape

Execution row context: `workflow_id`, `execution_row_id`, `sample_id`, current DAG node, workflow step, and its `payload_template_id`; queried payload template, prompt resources, conditions, and allow-listed source rows.

#### Output Shape

Provider-neutral `PayloadTemplate`, `PayloadMessage` collection, `PayloadInput` collection, and one immutable job snapshot.

#### File Flow

- `/services/row_coordinator.py` (`RowCoordinator`): receive claimed row -> call payload builder -> serialize one queued job snapshot.
- `/services/input_resolver.py` (`PayloadBuilder`): load template/resources -> resolve rows -> render prompt JSON -> return provider-neutral contents.
- `/services/execution_coordinator.py` (`WorkflowExecutionCoordinator`): decode snapshot -> invoke model client -> validate and persist model output.

#### Decisions & Assumptions

- **snapshot boundary:** Querying and template rendering finish before a job is queued, so retries use the same resolved request.
- **one-job rule:** One execution row and workflow step create one job; resource limits cap selected rows but never fan out work.
- **resource ownership:** A resource belongs to exactly one payload template and is addressed by a unique template-local name.
- **source safety:** Only source types and fields explicitly registered by the resolver may be queried.
