# API Integration Map

This document has two layers:

1. **Endpoint inventory** — a compact list of endpoints grouped by persisted data object.
2. **Detailed planned mapping** — planned or unsupported frontend integrations mapped from endpoint to page and hook. Existing endpoint consumers are omitted from the detailed section.

## Endpoint Inventory by Data Object

| Data object                 | Endpoints                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample_sets`               | `GET /api/v2/sample-sets`<br>`GET /api/v2/sample-sets/{sample_set_id}/analytics`<br>`POST /api/v2/sample-sets`<br>`DELETE /api/v2/sample-sets/{sample_set_id}`                    |
| `samples`                   | `GET /api/v2/samples`<br>`GET /api/v2/samples/{sample_id}`<br>`POST /api/v2/samples`<br>`DELETE /api/v2/samples/{sample_id}`                                                      |
| `artifact_groups`           | `GET /api/v2/artifact-groups`<br>`POST /api/v2/artifact-groups`<br>`DELETE /api/v2/artifact-groups/{artifact_group_id}`                                                           |
| `artifacts`                 | `GET /api/v2/artifacts`<br>`GET /api/v2/artifacts/{artifact_id}`<br>`POST /api/v2/artifacts`<br>`DELETE /api/v2/artifacts/{artifact_id}`                                          |
| `assets`                    | `GET /api/v2/assets`<br>`GET /api/v2/assets/{asset_id}`<br>`POST /api/v2/assets`<br>`DELETE /api/v2/assets/{asset_id}`                                                            |
| `workflows`                 | `POST /api/v2/workflows`<br>`GET /api/v2/workflows/{workflowId}`<br>`DELETE /api/v2/workflows/{workflow_id}`<br>Collection GET route not documented                               |
| `workflow_dag_nodes`        | `GET /api/v2/workflows/{workflowId}/workflow-dag-nodes`<br>`POST /api/v2/workflows/{workflowId}/workflow-dag-nodes`<br>`DELETE /api/v2/workflows/{workflowId}/workflow-dag-nodes` |
| `workflow_dag_edges`        | `GET /api/v2/workflows/{workflowId}/workflow-dag-edges`<br>`POST /api/v2/workflows/{workflowId}/workflow-dag-edges`<br>`DELETE /api/v2/workflows/{workflowId}/workflow-dag-edges` |
| `workflow_steps`            | `GET /api/v2/workflow-steps`<br>`POST /api/v2/workflow-steps`                                                                                                                     |
| `payload_templates`         | `GET /api/v2/payload-templates`<br>`POST /api/v2/payload-templates`                                                                                                               |
| `output_specs`              | `GET /api/v2/output-specs`<br>`POST /api/v2/output-specs`                                                                                                                         |
| `execution_rows`            | Collection, queue, dequeue, retry, detail, and live-event routes not documented                                                                                                   |
| `model_outputs`             | Step-scoped output route not documented                                                                                                                                           |
| `execution_failure_actions` | Acknowledge, retry, and abort routes not documented                                                                                                                               |

## Detailed Planned Endpoint → Page → Hook Mapping

Status labels:

- **Planned**: the endpoint is defined or implied, but the target hook integration is incomplete.
- **Unsupported**: the page requires a capability whose endpoint contract is not documented or whose hook contract does not support it.
- **Overlap**: two hook actions appear to own the same endpoint responsibility and should be consolidated or explicitly separated.

## Data Object: Sample Set

### Endpoint: `POST /api/v2/sample-sets`

- File Management Page: `useFileSelectionAndManagement.submitManagement("create-sample-set")` — **Planned**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Inconsistency:** `submitManagement(actionOverride)` multiplexes sample-set creation, artifact-group creation, and deletion. The endpoint ownership is therefore hidden behind a loose action string rather than exposed as a typed `createSampleSet()` capability.

## Data Object: Sample

### Endpoint: `GET /api/v2/samples`

- File Management Page: `useFileManagementPage.refresh()` — **Planned**
- File Management Page: `useFileBrowser` consumes the loaded sample catalog for filtering and visible-record derivation — **Planned**

**Responsibility note:** `useFileManagementPage.refresh()` should own the network request. `useFileBrowser` should consume catalog data only and should not issue a second request.

### Endpoint: `GET /api/v2/samples/{sample_id}`

- File Management Page: `useFileDetail.openRecord("sample", sampleId)` — **Planned**

### Endpoint: `POST /api/v2/samples`

- File Management Page: `useFileUpload.submitUpload()` when `uploadType === "sample"` — **Planned**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Planned request behavior:** Single-file upload calls this endpoint once. Folder upload calls the same endpoint repeatedly, once per file.

### Endpoint: `DELETE /api/v2/samples/{sample_id}`

- File Management Page: `useFileSelectionAndManagement.deleteRecord("sample", sampleId)` — **Planned**
- File Management Page: `useFileSelectionAndManagement.submitManagement("delete")` for selected sample IDs — **Planned, Overlap**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Inconsistency:** `deleteRecord()` and `submitManagement("delete")` both perform the same type-specific delete request. The intended distinction appears to be single-record versus bulk deletion, but both ultimately target the same singular endpoint and should share one internal delete primitive.

**Planned request behavior:** Bulk deletion fans out over the selected IDs using the same singular endpoint repeatedly.

## Data Object: Artifact Group

### Endpoint: `GET /api/v2/artifact-groups`

- File Management Page: `useFileManagementPage.refresh()` — **Planned**
- File Management Page: `useFileBrowser` consumes artifact groups for artifact filtering/grouping — **Planned**

**Responsibility note:** The browser hook should consume the catalog supplied by the page orchestrator rather than independently fetching it.

### Endpoint: `POST /api/v2/artifact-groups`

- File Management Page: `useFileSelectionAndManagement.submitManagement("create-artifact-group")` — **Planned**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Inconsistency:** The action shares the generic `submitManagement(actionOverride)` entry point with sample-set creation and all bulk deletes. A typed `createArtifactGroup()` action would make endpoint ownership and validation clearer.

**Potential contract mismatch:** The page flow derives selected artifact IDs, while the persistence model defines artifact-group membership through matching metadata such as `matching_type`, `matching_rule`, and `mapping_type`. The request payload needs to clarify whether groups are created from selected IDs, matching rules, or both.

## Data Object: Artifact

### Endpoint: `GET /api/v2/artifacts`

- File Management Page: `useFileManagementPage.refresh()` — **Planned**
- File Management Page: `useFileBrowser` consumes the loaded artifact catalog for filtering and visible-record derivation — **Planned**

### Endpoint: `GET /api/v2/artifacts/{artifact_id}`

- File Management Page: `useFileDetail.openRecord("artifact", artifactId)` — **Planned**

**Unsupported capability:** The hook intends to normalize the response into `RecordViewModel`, but `normalizedRecordPreview` is not fully supported.

### Endpoint: `POST /api/v2/artifacts`

- File Management Page: `useFileUpload.submitUpload()` when `uploadType === "artifact"` — **Planned**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Payload requirement:** Artifact upload requires an originating sample. For folder upload, the hook must apply or derive the originating sample association for every repeated request.

**Planned request behavior:** Folder upload repeatedly calls the singular artifact endpoint, once per file.

### Endpoint: `DELETE /api/v2/artifacts/{artifact_id}`

- File Management Page: `useFileSelectionAndManagement.deleteRecord("artifact", artifactId)` — **Planned**
- File Management Page: `useFileSelectionAndManagement.submitManagement("delete")` for selected artifact IDs — **Planned, Overlap**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Inconsistency:** Single-record and selected-record deletion duplicate endpoint responsibility. Both actions should delegate to one type-aware delete operation.

## Data Object: Asset

### Endpoint: `GET /api/v2/assets`

- File Management Page: `useFileManagementPage.refresh()` — **Planned**
- File Management Page: `useFileBrowser` consumes the loaded asset catalog for filtering and visible-record derivation — **Planned**

### Endpoint: `GET /api/v2/assets/{asset_id}`

- File Management Page: `useFileDetail.openRecord("asset", assetId)` — **Planned**

### Endpoint: `POST /api/v2/assets`

- File Management Page: `useFileUpload.submitUpload()` when `uploadType === "asset"` — **Planned**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Planned request behavior:** Folder upload repeatedly calls the singular asset endpoint, once per file.

### Endpoint: `DELETE /api/v2/assets/{asset_id}`

- File Management Page: `useFileSelectionAndManagement.deleteRecord("asset", assetId)` — **Planned**
- File Management Page: `useFileSelectionAndManagement.submitManagement("delete")` for selected asset IDs — **Planned, Overlap**
- Orchestration after success: `useFileManagementPage.refresh()` — **Planned**

**Inconsistency:** Assets are described as delete-only in the management modal, but deletion remains split between the generic management submit action and `deleteRecord()`.

## Data Object: Workflow

### Endpoint: `GET /api/v2/workflows/{workflowId}`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflow(workflowId)` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderPage.openSelectedWorkflow()` — **Planned orchestration**

### Endpoint: workflow collection route not documented

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflows()` — **Unsupported**
- Workspace Page: `useWorkspacePage.loadWorkflows()` — **Unsupported**

## Data Object: Workflow DAG Node

### Endpoint: `GET /api/v2/workflows/{workflowId}/workflow-dag-nodes`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflow(workflowId)` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderCanvas` consumes and normalizes loaded nodes — **Planned**

### Endpoint: `POST /api/v2/workflows/{workflowId}/workflow-dag-nodes`

- Workflow Builder Page: `useWorkflowBuilderPage.saveWorkflow()` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderCanvas.addNode()` — **Planned, Overlap**
- Workflow Builder Page: `useWorkflowStepAssignment.assignStep()` — **Planned, Overlap**

**Inconsistency:** Save reconciliation, canvas mutation, and assignment all appear capable of creating a DAG node. One layer should own persistence; the others should update local draft state or delegate to that owner.

### Endpoint: `DELETE /api/v2/workflows/{workflowId}/workflow-dag-nodes`

- Workflow Builder Page: `useWorkflowBuilderCanvas.deleteNode()` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderPage.refreshWorkflowBuilder()` — **Planned orchestration**

## Data Object: Workflow DAG Edge

### Endpoint: `GET /api/v2/workflows/{workflowId}/workflow-dag-edges`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflow(workflowId)` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderCanvas` consumes and normalizes loaded edges — **Planned**

### Endpoint: `POST /api/v2/workflows/{workflowId}/workflow-dag-edges`

- Workflow Builder Page: `useWorkflowBuilderPage.saveWorkflow()` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderCanvas.addDependency()` — **Planned, Overlap**

**Inconsistency:** Both page save reconciliation and the canvas action appear to own edge creation. The contract should choose immediate persistence or save-time reconciliation.

### Endpoint: `DELETE /api/v2/workflows/{workflowId}/workflow-dag-edges`

- Workflow Builder Page: `useWorkflowBuilderCanvas.deleteDependency()` — **Planned**
- Workflow Builder Page: `useWorkflowBuilderPage.refreshWorkflowBuilder()` — **Planned orchestration**

## Data Object: Workflow Step

### Endpoint: `GET /api/v2/workflow-steps`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflowBuilder()` — **Planned orchestration**
- Workflow Builder Page: `useWorkflowStepAssignment.loadWorkflowSteps()` — **Planned**

**Inconsistency:** Both actions appear to initiate the same catalog load. The page hook should orchestrate the request or delegate it, but not duplicate it.

### Endpoint: `POST /api/v2/workflow-steps`

- Workflow Builder Page: `useWorkflowStepCreationWizard.createWorkflowStep()` — **Planned**
- Workflow Builder Page: `useWorkflowStepAssignment` receives the created step for placement — **Planned handoff**

## Data Object: Payload Template

### Endpoint: `GET /api/v2/payload-templates`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflowBuilder()` — **Planned orchestration**
- Workflow Builder Page: `useWorkflowStepCreationWizard.loadPayloadTemplates()` — **Planned**

**Inconsistency:** The catalog request is represented at both the page and wizard layers. Only one should issue the request.

### Endpoint: `POST /api/v2/payload-templates`

- Workflow Builder Page: `useWorkflowStepCreationWizard.createPayloadTemplate()` — **Planned**

## Data Object: Output Specification

### Endpoint: `GET /api/v2/output-specs`

- Workflow Builder Page: `useWorkflowBuilderPage.loadWorkflowBuilder()` — **Planned orchestration**
- Workflow Builder Page: `useWorkflowStepCreationWizard.loadOutputSpecifications()` — **Planned**

**Inconsistency:** The catalog request is represented at both the page and wizard layers. Only one should issue the request.

### Endpoint: `POST /api/v2/output-specs`

- Workflow Builder Page: `useWorkflowStepCreationWizard.createOutputSpecification()` — **Planned**

## Data Object: Execution Row

No concrete Workspace endpoint is documented for these planned capabilities:

- Workspace Page: `useWorkspacePage.loadWorkspace()` — **Unsupported**
- Workspace Page: `useWorkspacePage.queueSelectedRows()` — **Unsupported**
- Workspace Page: `useWorkspacePage.dequeueSelectedRows()` — **Unsupported**
- Workspace Page: `useWorkspacePage.retrySelectedRows()` — **Unsupported**
- Workspace Page: `useExecutionRowDetail.openExecutionRow()` — **Unsupported**
- Workspace Page: live execution-row event subscription — **Unsupported**

## Data Object: Model Output

No concrete model-output endpoint is documented:

- Workspace Page: `useExecutionRowDetail` loads step-scoped raw and parsed output — **Unsupported**
- Workspace Page: `useExecutionRowFailureOverlay` loads expandable failure detail — **Unsupported**

## Data Object: Execution Failure Action

No concrete failure-action endpoints are documented:

- Workspace Page: `useExecutionRowFailureOverlay.acknowledgeFailure()` — **Unsupported**
- Workspace Page: `useExecutionRowFailureOverlay.retryFailedRow()` — **Unsupported**
- Workspace Page: `useExecutionRowFailureOverlay.abortFailedRow()` — **Unsupported**

## Cross-Cutting Inconsistencies and Capability Gaps

1. File Management uses `submitManagement(actionOverride)` as a broad command dispatcher for sample-set creation, artifact-group creation, and record deletion. Typed endpoint-facing actions would make endpoint ownership and validation easier to trace.
2. File Management duplicates delete ownership between `submitManagement("delete")` and `deleteRecord(type, recordId)`. They should share one internal delete primitive, with explicit single-record and selected-record wrappers if both UI flows remain.
3. File Management folder upload uses the same singular create endpoint repeatedly, once per file. This is an intentional request pattern rather than a missing batch endpoint.
4. Sample sets and artifact groups are intentionally supporting catalogs rather than primary selectable browser modes; their lack of direct selection and detail actions is not treated as an inconsistency.
5. Workflow Builder contains several page-level orchestration actions that overlap with specialized hook actions. Endpoint ownership should be assigned to one layer for each operation.
6. Workspace capabilities remain unsupported because collection, row-action, detail, output, failure-action, and live-event contracts are not documented.
