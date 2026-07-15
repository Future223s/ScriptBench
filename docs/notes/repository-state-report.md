# Repository State Report

Date: 2026-07-12

Scope:
- [docs/specs/Persistence.md](C:/Users/Seboo/Github/ScriptBench/docs/specs/Persistence.md)
- [docs/notes/impl.md](C:/Users/Seboo/Github/ScriptBench/docs/notes/impl.md)
- [docs/notes/api-contract-traceability-map.md](C:/Users/Seboo/Github/ScriptBench/docs/notes/api-contract-traceability-map.md)
- Backend tables, models, routers, and endpoint stubs under `backend/`
- Frontend workflow-builder and workflow-creation surfaces under `frontend/`

## 1. Executive Summary

ScriptBench currently has a recognizable shape, but the implementation is split across three different maturity levels:

- The persistence intent is fairly detailed, but it is not fully stabilized as a single canonical contract.
- The backend exposes most of the V2 route surface, but many workflow-related endpoints are still stubbed and several behaviors remain unimplemented.
- The frontend has a working workflow-builder shell, but much of it is still local-state driven and does not yet round-trip through backend contracts.

The highest-leverage path is to build in layers:

1. Lock the spec.
2. Freeze the integration contract.
3. Replace frontend mocks with API-backed hooks.
4. Add backend service boundaries.
5. Implement endpoint logic.

That sequence keeps the refactor segmented and reduces the chance that the UI and backend drift while the system is still changing.

## 2. Incremental Build Plan

This is the recommended build order. Each step should be completed before moving to the next unless there is a deliberate reason to keep a layer stubbed.

### Phase 1: Spec Lock

Goal:
- Convert the intent documents into one canonical set of rules the code can implement against.

What to decide:
- Canonical workflow entity set: `workflow`, `workflow_step`, `payload_template`, `output_spec`, `workflow_dag_node`, `workflow_dag_edge`.
- Canonical execution states: whether `queued` and `running` are first-class lifecycle states in persistence.
- Canonical batching rule: whether `batch_limit` is the final model or whether a separate count field replaces it.
- Canonical root-node behavior: whether initial DAG nodes are always represented as root edges.
- Canonical output lifecycle: whether `last_successful_completion` belongs on `execution_rows` and how it is computed.
- Canonical endpoint verbs: standard `GET`/`POST`/`DELETE` instead of `LIST` where the frontend expects normal list routes.

Evidence:
- `docs/specs/Persistence.md` defines the entity set and most of the database shape.
- `docs/notes/impl.md` adds workflow execution and queueing behavior that is not fully reflected in the persistence spec.
- `docs/notes/api-contract-traceability-map.md` shows the active frontend contract surface.

Deliverables:
- One updated persistence spec.
- A short behavior glossary for workflow builder and execution terms.
- A status table for workflow rows and DAG traversal.

### Phase 2: Integration Contract

Goal:
- Turn the spec into a stable API contract that both frontend and backend can target.

What to define:
- Request and response shape for:
  - `GET/POST /api/v2/workflows`
  - `GET/POST/DELETE /api/v2/workflows/{workflowId}/workflow-dag-nodes`
  - `GET/POST/DELETE /api/v2/workflows/{workflowId}/workflow-dag-edges`
  - `GET/POST /api/v2/workflow-steps`
  - `GET/POST /api/v2/payload-templates`
  - `GET/POST /api/v2/output-specs`
- Whether list endpoints are plural `GET` routes or a custom `LIST` action.
- Which fields are identity fields, display fields, and versioned fields.
- Which endpoints are read-only, which are mutating, and which require validation against versioned dependencies.

Evidence:
- `frontend/src/api/endpoints/workflowBuilder.ts` already defines the frontend shape the app expects.
- `backend/api/v2/endpoints/*.py` currently exposes route stubs with minimal logic.

Deliverables:
- An endpoint matrix.
- A schema table for each resource.
- A list of contract mismatches that must be resolved before wiring hooks.

### Phase 3: Frontend Hooks

Goal:
- Remove local mock catalogs and make the workflow builder consume the contract.

What to migrate:
- `frontend/src/hooks/workflow-builder/useWorkflowBuilderPage.js`
- `frontend/src/hooks/workflow/useWorkflowCreation.js`
- Any component that currently depends on hardcoded step/template/spec catalogs

Priority order:
1. Load sample sets, workflows, workflow DAG nodes, and workflow DAG edges from API.
2. Replace local step/template/spec catalogs with API-backed lists.
3. Wire create actions to actual mutation endpoints.
4. Refresh cached data after create/delete/save actions.

Evidence:
- `frontend/src/hooks/workflow-builder/useWorkflowBuilderPage.js` currently loads only sample sets and stores nodes/edges/catalogs in local state.
- `frontend/src/hooks/workflow/useWorkflowCreation.js` still builds a workflow from local wizard state.
- `frontend/src/api/endpoints/workflowBuilder.ts` already exposes the intended API entry points, but most are unused.

Deliverables:
- API-backed hooks for read paths first.
- Mutation hooks for create/delete/save actions next.
- A thin state adapter layer so the UI can remain mostly unchanged while the source of truth moves to the backend.

### Phase 4: Backend Services

Goal:
- Put business rules in services instead of endpoint handlers.

Recommended service boundaries:
- Workflow definition service
- Workflow DAG service
- Workflow step catalog service
- Payload template service
- Output spec service

Rules that belong here:
- Unique name/version validation.
- Referential integrity checks between workflow steps, payload templates, and output specs.
- DAG validation such as no self-links and no invalid duplicate edges.
- Root-node and initial-node handling.
- Save orchestration for workflow creation and workflow graph persistence.

Evidence:
- The current endpoints are thin stubs.
- The tables already exist for the core workflow metadata.

Deliverables:
- Service interfaces.
- Service-level tests for validation and orchestration rules.
- Repository calls hidden behind services so endpoints remain thin.

### Phase 5: Actual Endpoint Logic

Goal:
- Replace stub handlers with the service-backed implementation.

Recommended implementation order:
1. Read endpoints first.
2. List endpoints second.
3. Create endpoints third.
4. Delete endpoints fourth.
5. Save/workflow orchestration last.

Why this order:
- Read paths let the frontend start consuming real data with minimal risk.
- Mutation endpoints depend on the service layer and validation rules.
- Save orchestration should land only after the graph and catalog entities are stable.

Current backend gap:
- `backend/api/v2/endpoints/workflows.py` contains stubbed workflow and DAG handlers.
- `backend/api/v2/endpoints/workflow_steps.py`, `payload_templates.py`, and `output_specs.py` are also stubbed.
- The backend currently uses `LIST` routes for list behavior in some places, which is not aligned with the rest of the contract surface.

Deliverables:
- Request/response models.
- Fully implemented route handlers.
- Real persistence reads and writes.

### Phase 6: Execution Runtime

Goal:
- Build the workflow execution path after workflow definition is stable.

What comes next:
- `execution_rows` lifecycle behavior
- `model_outputs` persistence
- queue, dequeue, retry, and worker-event flow
- `last_successful_completion` handling
- decomposed item batching and deterministic merge behavior

Evidence:
- `docs/specs/Persistence.md` defines `execution_rows` and `model_outputs`.
- `docs/notes/impl.md` describes queueing, worker behavior, and failure handling.

Deliverables:
- Execution service contracts.
- Worker lifecycle handlers.
- Event emission and frontend correlation rules.

## 3. Spec-Level Gaps

These are the gaps that exist before implementation can be considered stable.

### 3.1 The spec is detailed, but not fully canonical

The persistence spec is strong on entity names and broad relationships, but several behaviors are still split between the spec and the implementation notes:

- `docs/specs/Persistence.md` defines the tables and many constraints.
- `docs/notes/impl.md` adds queueing, execution status, and batching behavior that are not yet fully absorbed into the spec.

This means the codebase does not yet have one definitive source of truth for the workflow lifecycle.

### 3.2 Backend and frontend spec docs are empty

`docs/specs/Backend.md` and `docs/specs/Frontend.md` currently have no content.

That creates a spec-level gap because:
- There is no canonical backend behavior document.
- There is no canonical frontend behavior document.
- The implementation notes are carrying too much of the behavioral contract.

### 3.3 Workflow execution semantics are not stabilized in the spec

The implementation notes introduce:
- `queued`
- `running`
- `last_successful_completion`
- root-node edges for initial workflow nodes
- worker pause, retry, and dequeue semantics

Those ideas are not yet folded cleanly into the persistence spec as a finalized contract.

### 3.4 Batching semantics are still in flux

The persistence spec already includes `batch_limit` on `payload_inputs`, but the implementation notes also suggest an alternate idea of persisting a count type for explicit batching.

That is a meaningful spec gap because the system needs to choose one canonical expression of batch sizing before backend and frontend behavior can be aligned.

### 3.5 The API contract is not fully normalized

The traceability map shows a wide surface for the workflow-builder API, but the implementation notes and backend stubs do not yet enforce a fully normalized contract for:

- response payload shape
- list route semantics
- create/update/delete body shapes
- workflow graph mutation semantics

## 4. Backend Integration Gaps

### 4.1 Workflow endpoints are stubbed

The route module at `backend/api/v2/endpoints/workflows.py` exposes the workflow and DAG endpoints, but the handlers only log and return canned success messages.

Missing backend behavior:
- persistence reads for workflows and DAG structures
- persistence writes for workflow creation and graph mutation
- request validation
- graph consistency checks

### 4.2 Step/template/spec endpoints are stubbed

The modules at:
- `backend/api/v2/endpoints/workflow_steps.py`
- `backend/api/v2/endpoints/payload_templates.py`
- `backend/api/v2/endpoints/output_specs.py`

all return stubbed responses.

Missing backend behavior:
- listing actual records
- creating versioned records
- enforcing unique `(name, version)` rules
- returning model-backed data to the frontend

### 4.3 The persistence layer is ahead of the service layer

The tables already contain some forward-looking fields:
- `backend/database/tables/execution_rows_table.py` includes `current_workflow_dag_node_id` and `last_successful_completion`
- `backend/database/tables/workflow_dag_nodes_table.py` includes `workflow_dag_node_name` and `is_root`

But the backend services and endpoint logic have not yet caught up with those shapes.

That means the schema is partially ahead of the runtime behavior.

### 4.4 Some backend route semantics do not yet match normal frontend expectations

The backend currently uses `LIST` route methods for list behavior in the workflow-step, payload-template, and output-spec endpoints.

That is a contract gap because:
- the frontend API client uses normal `GET` list calls
- standard HTTP semantics would make the API easier to reason about
- a nonstandard method complicates tooling and client assumptions

### 4.5 There is no visible service layer boundary for workflow logic

The repo includes repositories and tables, but the workflow builder path still needs a service layer to own:
- validation
- orchestration
- graph rules
- versioned catalog management

Without that layer, the endpoint handlers will become too thin to be useful or too fat to stay maintainable.

## 5. Frontend Integration Gaps

### 5.1 The workflow builder canvas is local-state driven

`frontend/src/hooks/workflow-builder/useWorkflowBuilderPage.js` currently keeps:
- step catalog
- payload templates
- output specifications
- nodes
- edges

in local state.

That means the canvas can render and mutate, but those changes do not yet persist through the backend contract.

### 5.2 The workflow builder only loads sample sets from the backend

The workflow-builder hook currently fetches sample sets, but not the actual workflow graph or the versioned workflow catalog resources.

So the page is partially API-backed and partially simulated.

### 5.3 The workflow creation flow still uses a local wizard model

`frontend/src/hooks/workflow/useWorkflowCreation.js` and the surrounding wizard components still build the workflow from local form state.

Missing frontend wiring:
- real payload-template selection and creation
- real output-spec selection and creation
- real workflow-step creation
- backend-backed refresh after create

### 5.4 The API client surface is broader than the hook surface

`frontend/src/api/endpoints/workflowBuilder.ts` already includes:
- workflow CRUD
- workflow DAG node/edge CRUD
- workflow-step CRUD
- payload-template CRUD
- output-spec CRUD

But the active hooks only consume:
- `getSampleSets()`
- `createWorkflow()`

That is a clear frontend integration gap: the client surface exists, but most of it is not yet used.

### 5.5 The UI still reads like a prototype in the workflow-builder path

The page composition in `frontend/src/components/workflow-builder/WorkflowBuilderPageView.js` shows the correct structural pieces:
- metadata form
- canvas
- assignment modal
- creation wizard
- detail modal

But the behavior is still mostly an in-memory model, not a backend-synchronized editor.

## 6. Recommended Refactor Sequence

If the goal is incremental behavior updates, this is the safest order:

1. Finalize the persistence and workflow execution vocabulary in the spec.
2. Write the contract matrix for each V2 workflow-related endpoint.
3. Update the frontend hooks to consume the contract, starting with read paths.
4. Add backend services that encapsulate workflow, DAG, template, and spec rules.
5. Replace endpoint stubs with service-backed logic.
6. Add execution runtime behavior after the builder path is stable.

## 7. Concrete Next Actions

If you want to work in small slices, I would start here:

1. Normalize the spec:
   - decide whether `queued` and `running` are canonical persistence statuses
   - decide whether `batch_limit` stays as-is or becomes a separate count model
   - decide whether root-node edges are part of the canonical DAG model

2. Freeze the workflow-builder contract:
   - define the request and response shape for `workflow`, `workflow-step`, `payload-template`, `output-spec`, and DAG endpoints
   - replace `LIST` with normal list endpoints if that is the chosen contract

3. Wire the frontend hooks:
   - fetch workflow step/template/spec catalogs from the backend
   - replace local step/template/spec catalogs with API state
   - keep the UI structure the same while swapping the data source

4. Add backend services:
   - centralize validation and orchestration
   - keep endpoints thin
   - use repository calls only inside service boundaries

5. Implement the endpoint logic:
   - read endpoints first
   - then create/delete endpoints
   - then workflow save orchestration

6. Move to execution runtime:
   - queueing
   - retry/dequeue
   - worker events
   - output merging

## 8. Evidence Index

- `docs/specs/Persistence.md`: canonical persistence intent, but not yet fully stabilized.
- `docs/notes/impl.md`: execution and queueing intent, plus a few forward-looking persistence ideas.
- `docs/notes/api-contract-traceability-map.md`: current frontend-to-endpoint coverage.
- `backend/api/v2/endpoints/workflows.py`: stubbed workflow and DAG handlers.
- `backend/api/v2/endpoints/workflow_steps.py`: stubbed workflow-step handlers.
- `backend/api/v2/endpoints/payload_templates.py`: stubbed payload-template handlers.
- `backend/api/v2/endpoints/output_specs.py`: stubbed output-spec handlers.
- `backend/database/tables/execution_rows_table.py`: execution row schema already contains some forward-looking fields.
- `backend/database/tables/workflow_dag_nodes_table.py`: root-node support is already hinted in schema.
- `frontend/src/hooks/workflow-builder/useWorkflowBuilderPage.js`: local-state workflow builder.
- `frontend/src/hooks/workflow/useWorkflowCreation.js`: local-state workflow wizard.
- `frontend/src/api/endpoints/workflowBuilder.ts`: broader API surface than the active hooks use.

