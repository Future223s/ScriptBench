## Workflow Builder

### 1. Layout

**Structure:**

Workflow selection entry screen
  - Page title
  - Workflow selector dropdown
  - Primary action to open the selected workflow in the builder

Builder: 
Page header
  - Title: `Workflow Builder`
  - Workflow selector dropdown
  - Draft status pill
  - Return button
  - Primary save action

Builder workspace
  - Left metadata sidebar
  - Right workflow canvas workbench

Modal layer
  - Step assignment modal
  - Step creation wizard modal
  - Step detail modal

**Positioning:**

- The workflow selection entry screen occupies the page before any builder-specific content is loaded.
- The page uses a two-column builder layout below the header.
- The metadata sidebar stays on the left as the narrow configuration column.
- The canvas workbench occupies the primary width and acts as the main editing surface.
- Modal flows appear above the page rather than navigating away from the builder.
- The loading state preserves the same page frame with the header still visible.

**Behavior:**

- The page should first require workflow selection before the builder workspace is shown.
- Once a workflow is opened, the builder should present workflow metadata and graph editing as one workspace.
- The save action should remain visually associated with the page header instead of being buried inside a panel.
- The header should keep workflow context visible through a switchable workflow selector and provide a return action back to the selection screen.
- The canvas should read as the primary focus area once a sample set has been chosen.
- Modal flows should support step assignment, step creation, and node inspection without losing page context.
- The layout should preserve the builder frame while loading, saving, or refreshing backend-backed resources.

### 2. Regions

#### Workflow Builder Entry Screen

**Purpose:**

Lets the user choose which workflow to open before the builder workspace is shown.

**Contents:**

- Page title
- Workflow selector dropdown
- Open workflow action

**Behavior:**

- The page stays on this screen until a workflow is selected and opened.
- The workflow selector should behave like the workflow selector used on the workspace page.
- Returning from the active builder workspace should restore this screen.

**Empty State:**

- If no workflows exist, the selector and open action should be replaced with guidance to create a workflow first.

**Loading State:**

- While workflows are loading, the selector area should show a loading state without revealing the builder workspace.

#### Builder Header

**Purpose:**

Provides page identity, current workflow context, return navigation, draft status, and the primary workflow save action.

**Contents:**

- Page title
- Workflow selector dropdown
- Workflow status indicator
- Return button
- Save workflow button

**Behavior:**

- The workflow selector reflects the currently open workflow and allows switching workflow context from inside the builder.
- The return button exits the active builder workspace and returns the user to the workflow selection entry screen.
- Save remains available from the page-level header.
- Save becomes disabled when the workflow cannot yet be saved, especially when no sample set is selected.
- Saving updates the button label to communicate in-progress persistence.

**Empty State:**

- No distinct empty state. The header remains stable regardless of builder content.

**Loading State:**

- Remains visible while the rest of the page loads.

#### Workflow Metadata Sidebar

**Purpose:**

Captures the workflow-level configuration that frames the graph being edited.

**Contents:**

- Workflow name
- Workflow description
- Sample set selector
- Current UI also shows model name and model family fields, but those belong to step creation rather than the final workflow-owned contract `(present in UI, not aligned)`
- Lightweight sample set availability summary

**Behavior:**

- Editing these fields updates the current workflow draft.
- Choosing a sample set establishes the dataset context for the workflow.
- In the final product, this region should own only workflow identification and scope, while model choice belongs on reusable workflow steps.
- The sidebar should remain readable and secondary to the canvas rather than competing with it.

**Empty State:**

- If no sample sets are available, the selector communicates that the user cannot yet bind the workflow to data.

**Loading State:**

- During initial load, the sidebar is withheld behind the page-level loading frame.

#### Workflow Canvas Workbench

**Purpose:**

Provides the primary editing surface for building the workflow graph.

**Contents:**

- Canvas section header
- Graph action controls
- Node-and-edge canvas grid
- Placement targets for adding steps
- Visual edge lines connecting dependent steps

**Behavior:**

- The canvas supports adding steps, linking dependencies, deleting steps, deleting dependencies, and cancelling the active graph-editing mode.
- Nodes occupy discrete row and column positions.
- Edges are rendered visually between placed nodes.
- Empty placement targets appear only when the current graph state permits a new node placement.

**Empty State:**

- When no workflow steps exist, the canvas still renders and exposes an initial placement target to start the graph.

**Loading State:**

- During initial page loading, the full workbench is replaced by the page-level loading surface.

#### Step Assignment Flow

**Purpose:**

Lets the user place a workflow step into a selected canvas position.

**Contents:**

- Mode toggle between using an existing step and creating a new step
- Existing step selector
- Step summary
- Entry point to the step creation wizard
- Assignment confirmation controls

**Behavior:**

- The user first chooses a placement on the canvas, then decides whether to assign an existing step or create a new one.
- Existing-step assignment should preview the selected step before placement.
- The create-new branch should hand off into the wizard rather than forcing inline creation in the same surface.

**Empty State:**

- If no reusable workflow steps exist, the flow should still allow the user to continue by creating a new step.

**Loading State:**

- In the final product, catalog loading should keep the modal open and replace selection controls with loading placeholders rather than closing the flow.

#### Step Creation Wizard

**Purpose:**

Creates a reusable workflow step, including its payload template and output specification.

**Contents:**

- Stepper with three stages
- Step identification form
- Payload template selection or inline creation
- Output specification selection or inline creation
- Back, next, cancel, and create actions

**Behavior:**

- The wizard breaks step creation into a staged flow so the user can define the step contract progressively.
- Payload template and output specification creation can happen inline when existing catalog items are insufficient.
- Wizard completion should return the new step to the assignment flow already selected for placement.

**Empty State:**

- If there are no reusable templates or output specifications, the wizard should still support step creation through inline creation paths.

**Loading State:**

- In the final product, catalog-backed wizard controls should preserve the current step and show loading states while templates and specs refresh.

#### Step Detail Region

**Purpose:**

Lets the user inspect a placed node without mutating it directly from the canvas.

**Contents:**

- Node title
- Canvas position
- Payload template reference
- Output specification reference
- Step description

**Behavior:**

- Opens from a node detail gesture without changing the underlying graph.
- Provides read-oriented inspection for the selected step placement.

**Empty State:**

- If the node has no description, the region communicates that clearly instead of leaving a blank section.

**Loading State:**

- In the final product, detail data should remain inspectable while related catalog references resolve or refresh.

### 3. Interactions

#### Load Workflow Builder

Trigger:

User navigates to the workflow builder page.

Flow:

1. The page loads the workflow selection entry screen.
2. The page loads workflows available for selection.
3. The page remains on the selection screen until the user opens a workflow.

Result:

- The user lands on the workflow selection entry screen before the builder workspace opens.

Failure Behavior:

- Show a page-level error while preserving the page shell.

#### Open Selected Workflow

Trigger:

User selects a workflow from the dropdown and confirms opening it.

Flow:

1. The user selects a workflow from the entry-screen dropdown.
2. The page validates that a workflow is selected.
3. The page loads workflow identification data.
4. The page loads workflow DAG nodes and edges.
5. The selection screen is replaced with the builder workspace.
6. The selected workflow appears in the header dropdown.

Result:

- The workflow builder opens for the selected workflow.

Failure Behavior:

- Show a workflow-loading error and keep the user on the selection screen.

#### Return To Workflow Selection

Trigger:

User clicks the return button in the builder header.

Flow:

1. The active builder workspace exits.
2. The workflow selection entry screen is shown again.
3. The available workflow options remain ready for reselection.

Result:

- The user returns to the workflow selection entry screen.

#### Edit Workflow Metadata

Trigger:

User changes a workflow metadata field in the sidebar.

Flow:

1. User edits workflow identification fields such as workflow name, description, or sample set.
2. The draft updates immediately.

Result:

- The workflow draft reflects the latest metadata values.
- Step-level model configuration should be handled through workflow-step creation, not workflow metadata.

#### Start Graph Authoring

Trigger:

User enters add-step mode from the canvas action bar.

Flow:

1. The user activates add-step mode.
2. The canvas shows valid placement targets.
3. The user selects a placement target.
4. The step assignment flow opens.

Result:

- The builder moves from general canvas browsing into a concrete step-placement flow.

#### Assign Existing Workflow Step

Trigger:

User chooses an existing step in the assignment flow and confirms placement.

Flow:

1. The user opens the step assignment modal from a placement target.
2. The user keeps the existing-step mode active.
3. The user selects a workflow step from the catalog.
4. The user confirms the assignment.
5. The step is placed on the canvas at the selected location.

Result:

- A new node appears in the graph using the selected reusable step definition.

Failure Behavior:

- Show a validation error if no placement or no step has been selected.

#### Create And Assign New Workflow Step

Trigger:

User chooses to create a new step from the assignment flow.

Flow:

1. The user switches the assignment modal to create mode.
2. The user opens the step creation wizard.
3. The user defines step identification, payload template, and output specification.
4. The new step is created.
5. The assignment flow resumes with the new step selected.
6. The user confirms placement.

Result:

- A reusable step is created and then placed on the canvas without leaving the builder.

Failure Behavior:

- Keep the user in the wizard and show the missing required fields.

#### Add Dependency

Trigger:

User enters dependency mode and selects two nodes.

Flow:

1. The user activates add-dependency mode.
2. The user selects the source step.
3. The user selects the destination step.
4. The dependency is created between the two nodes.

Result:

- A visual edge appears between the selected steps.

Failure Behavior:

- Show an error if the user picks fewer than two nodes, reuses the same node twice, or creates a duplicate edge.

#### Delete Workflow Step

Trigger:

User enters delete-step mode and confirms deletion through the graph action.

Flow:

1. The user activates delete-step mode.
2. The user selects a node targeted for deletion.
3. The step is removed from the graph.
4. Any dependencies connected to that node are also removed.

Result:

- The selected node disappears and the graph remains internally consistent.

Failure Behavior:

- Show an error if no node is selected.

#### Delete Dependency

Trigger:

User enters delete-dependency mode and selects an edge.

Flow:

1. The user activates delete-dependency mode.
2. The user selects a dependency edge.
3. The dependency is removed.

Result:

- The selected edge disappears from the graph.

Failure Behavior:

- Show an error if no dependency is selected.

#### Inspect Workflow Step

Trigger:

User opens step details from a placed node.

Flow:

1. The user opens the detail view for a node.
2. The builder shows node placement, template, spec, and description details.

Result:

- The user can inspect the current graph node without changing the graph.

#### Cancel Graph Action

Trigger:

User clicks cancel while a graph-editing mode is active.

Flow:

1. The user cancels the active canvas action.
2. The builder clears temporary selections and mode-specific state.

Result:

- The canvas returns to a neutral browsing state.

#### Save Workflow

Trigger:

User clicks `Save Workflow`.

Flow:

1. The builder validates that a sample set has been selected.
2. The page derives the save payload from workflow identification data and the current DAG.
3. The workflow save request is sent.
4. The page reports success or failure.

Result:

- The workflow definition is persisted with its primary identification data and DAG.

Failure Behavior:

- Show a save error and preserve the current draft and graph state.

### 4. State

#### Workflow Identity And Metadata

| State                                | Type         | Description                                                                                                                                                                                      | Source                                                 | Consumers                                            |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------- |
| `workflowDraft.workflow_name`        | `string`     | Workflow display name and primary identifier text for the draft `(present)`.                                                                                                                     | Local page state seeded from `defaultWorkflowDraft()`. | Builder Header, Workflow Metadata Sidebar, save flow |
| `workflowDraft.workflow_description` | `string`     | Freeform description used to explain steps, handoffs, and output shape `(present)`.                                                                                                              | Local page state.                                      | Workflow Metadata Sidebar, save flow                 |
| `workflowDraft.sample_set_id`        | `ID \| null` | Selected sample set that anchors the workflow to data `(present)`.                                                                                                                               | Local page state, initialized from loaded sample sets. | Workflow Metadata Sidebar, Builder Header, save flow |
| `workflowDraft.status`               | `string`     | Workflow lifecycle status `(incomplete because persistence owns workflow status, but the current builder only implies draft/save state instead of exposing a normalized workflow status field)`. | Future workflow record state plus local draft context. | Builder Header, save flow                            |
| `selectedWorkflowId`                 | `ID \| null` | Selected workflow from the entry screen or header dropdown that determines which workflow is open in the builder `(not present)`.                                                            | Future page state from workflow selection.             | Workflow Builder Entry Screen, Builder Header, save flow |
| `workflowDraft.model_family`         | `string`     | Current UI field for model family `(present in UI, not aligned because persistence places model choice on `workflow_steps`)`.                                                                    | Local page state.                                      | Workflow Metadata Sidebar                            |
| `workflowDraft.model`                | `string`     | Current UI field for model name `(present in UI, not aligned because persistence places model choice on `workflow_steps`)`.                                                                      | Local page state.                                      | Workflow Metadata Sidebar                            |

#### Workflow Graph State

| State                    | Type                                                                             | Description                                                                                                                                          | Source                     | Consumers                                                |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `nodes`                  | `WorkflowNode[]`                                                                 | Placed workflow steps in row and column positions on the canvas `(present, incomplete because nodes are still local-state only and not API-backed)`. | Local page state.          | Workflow Canvas Workbench, Step Detail Region, save flow |
| `edges`                  | `WorkflowEdge[]`                                                                 | Directed dependencies between placed workflow nodes `(present, incomplete because edges are still local-state only and not API-backed)`.             | Local page state.          | Workflow Canvas Workbench, save flow                     |
| `selectedNodeId`         | `ID \| null`                                                                     | Currently selected node for graph actions `(present)`.                                                                                               | Local page state.          | Workflow Canvas Workbench, Step Detail Region            |
| `selectedEdgeId`         | `ID \| null`                                                                     | Currently selected dependency edge `(present)`.                                                                                                      | Local page state.          | Workflow Canvas Workbench                                |
| `mode`                   | `"add-step" \| "add-dependency" \| "delete-step" \| "delete-dependency" \| null` | Active graph-editing mode `(present)`.                                                                                                               | Local page state.          | Workflow Canvas Workbench, Step Assignment Flow          |
| `dependencySourceNodeId` | `ID \| null`                                                                     | First node chosen while building a dependency `(present)`.                                                                                           | Local page state.          | Workflow Canvas Workbench                                |
| `dependencyTargetNodeId` | `ID \| null`                                                                     | Second node chosen while building a dependency `(present)`.                                                                                          | Local page state.          | Workflow Canvas Workbench                                |
| `selectedPlacement`      | `{ row: number, col: number } \| null`                                           | Chosen empty canvas location for placing the next step `(present)`.                                                                                  | Local page state.          | Workflow Canvas Workbench, Step Assignment Flow          |

#### Catalog And Reusable Definition State

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `stepCatalog` | `WorkflowStepDefinition[]` | Reusable workflow steps available for placement `(present, incomplete because the list is hardcoded instead of API-backed)`. | Local page state from in-memory factory data. | Step Assignment Flow, Step Creation Wizard |
| `payloadTemplates` | `PayloadTemplate[]` | Reusable payload templates `(present, incomplete because the list is hardcoded instead of API-backed)`. | Local page state from in-memory factory data. | Step Creation Wizard, Step Detail Region, save flow |
| `outputSpecifications` | `OutputSpecification[]` | Reusable output specifications `(present, incomplete because the list is hardcoded instead of API-backed)`. | Local page state from in-memory factory data. | Step Creation Wizard, Step Detail Region, save flow |
| `catalogsLoading` | `boolean` | Shared loading state for step, template, and output-spec catalogs `(not present)`. | Future API-backed hook state. | Step Assignment Flow, Step Creation Wizard |
| `catalogsError` | `string \| null` | Error state for reusable catalog retrieval `(not present)`. | Future API-backed hook state. | Step Assignment Flow, Step Creation Wizard |

#### Modal And Wizard State

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `assignmentOpen` | `boolean` | Whether the step assignment modal is visible `(present)`. | Local page state. | Step Assignment Flow |
| `assignmentMode` | `"existing" \| "create"` | Whether the user is assigning an existing step or branching into step creation `(present)`. | Local page state. | Step Assignment Flow |
| `assignmentStepId` | `ID \| null` | Selected reusable step within the assignment modal `(present)`. | Local page state. | Step Assignment Flow |
| `wizardOpen` | `boolean` | Whether the step creation wizard is visible `(present)`. | Local page state. | Step Creation Wizard |
| `wizardStep` | `0 \| 1 \| 2` | Current wizard stage `(present)`. | Local page state. | Step Creation Wizard |
| `wizardDraft` | `WorkflowStepWizardDraft` | Draft state for creating a workflow step, payload template, and output specification `(present, incomplete because creation is local only and not persisted through the API)`. | Local page state. | Step Creation Wizard |
| `detailOpen` | `boolean` | Whether the step detail modal is visible `(present)`. | Local page state. | Step Detail Region |
| `detailNodeId` | `ID \| null` | Node currently being inspected `(present)`. | Local page state. | Step Detail Region |

#### Async, Feedback, And Derived State

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `loading` | `boolean` | Initial page loading state for the workflow builder `(present)`. | Local page state driven by sample-set fetch. | entire builder |
| `saving` | `boolean` | Whether the workflow save request is in progress `(present)`. | Local page state. | Builder Header |
| `error` | `string` | Current page-level or flow-level error message `(present, incomplete because one shared string currently serves too many interaction paths)`. | Local page state. | entire builder, notification overlay |
| `notice` | `string` | Current success or informational message `(present)`. | Local page state. | notification overlay |
| `showWorkflowSelectionScreen` | `boolean` | Whether the workflow selection entry screen is active instead of the builder workspace `(not present)`. | Future page state. | Workflow Builder Entry Screen, Builder Header, WorkflowBuilderPageView |
| `workflows` | `WorkflowSummary[]` | Workflows available for selection in the entry screen and header dropdown `(not present)`. | Future API-backed page state. | Workflow Builder Entry Screen, Builder Header |
| `selectedWorkflowOption` | `WorkflowSummary \| null` | The currently selected workflow record used by the entry screen and header dropdown `(not present)`. | Derived from `workflows` and `selectedWorkflowId`. | Workflow Builder Entry Screen, Builder Header |
| `sampleSets` | `SampleSetSummary[]` | Sample sets available for workflow binding `(present)`. | API-backed page state from `getSampleSets()`. | Workflow Metadata Sidebar, save flow |
| `selectedSampleSet` | `SampleSetSummary \| null` | Derived sample set record matching `workflowDraft.sample_set_id` `(incomplete because it is recomputed ad hoc during save instead of being exposed as stable page state)`. | Derived from `sampleSets` and `workflowDraft.sample_set_id`. | Metadata Sidebar, save flow |
| `workflowLoading` | `boolean` | Loading state for fetching an existing workflow definition and graph `(not present)`. | Future API-backed hook state. | entire builder |
| `workflowError` | `string \| null` | Error state specific to loading an existing workflow `(not present)`. | Future API-backed hook state. | entire builder |
| `graphSaving` | `boolean` | Dedicated save state for graph mutations when node and edge changes persist independently of full workflow save `(not present)`. | Future API-backed hook state. | Workflow Canvas Workbench |

# 5. Hooks

## Hooks Overview

| Hook                                                    | Purpose                                                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `useWorkflowBuilderPage` `(present, incomplete)`        | Coordinates workflow selection, page bootstrap, workflow identification state, sample-set loading, navigation, and workflow persistence. |
| `useWorkflowBuilderCanvas` `(present, incomplete)`      | Manages DAG interaction including graph modes, node and edge selection, placement targeting, and graph mutations.                        |
| `useWorkflowStepAssignment` `(present, incomplete)`     | Manages the step-assignment modal and selection flow that turns a placement target into a workflow DAG node.                             |
| `useWorkflowStepCreationWizard` `(present, incomplete)` | Manages reusable workflow-step creation, including payload-template and output-spec drafting inside the wizard.                          |

---

## Hook Specification

## `useWorkflowBuilderPage` `(present, incomplete)`

### Purpose

Coordinates workflow selection, page bootstrap, workflow identification, navigation between entry and builder states, and workflow persistence for the workflow builder page.

This hook owns page-level workflow state and top-level persistence behavior while leaving DAG interaction, assignment flow, and wizard drafting to separate behavioral units.

---

## State

| State | Type | Purpose |
|---|---|---|
| `loading` | `boolean` | Tracks initial page bootstrap while required builder data is loading. |
| `saving` | `boolean` | Tracks workflow save progress for the page-level save action. |
| `error` | `string` | Stores page-level errors that should surface through the notification layer or page shell. |
| `notice` | `string` | Stores page-level success and informational feedback. |
| `showWorkflowSelectionScreen` | `boolean` | Tracks whether the workflow selection entry screen is active instead of the builder workspace `(not present)`. |
| `workflows` | `WorkflowSummary[]` | Stores workflows available for selection in the entry screen and header dropdown `(not present)`. |
| `selectedWorkflowId` | `ID \| null` | Stores the workflow currently selected from the entry screen or header dropdown `(not present)`. |
| `selectedWorkflowOption` | `WorkflowSummary \| null` | Exposes the currently selected workflow record for the entry screen and header dropdown `(not present)`. |
| `sampleSets` | `SampleSetSummary[]` | Stores sample sets available for binding the workflow to data. |
| `workflowDraft.workflow_name` | `string` | Stores the workflow name owned by the workflow record itself. |
| `workflowDraft.workflow_description` | `string` | Stores the workflow description owned by the workflow record itself. |
| `workflowDraft.sample_set_id` | `ID \| null` | Stores the selected sample set that defines workflow scope. |
| `workflowDraft.status` | `string` | Stores the workflow lifecycle status when the workflow record exposes it `(incomplete)`. |
| `selectedSampleSet` | `SampleSetSummary \| null` | Exposes the currently selected sample-set record derived from the sample-set collection and workflow draft. |
| `workflowLoading` | `boolean` | Reserves async state for loading an existing persisted workflow into the page `(not present)`. |
| `workflowError` | `string \| null` | Reserves error state for persisted workflow loading `(not present)`. |

---

## Action Overview

| Action | Purpose |
|---|---|
| `loadWorkflows()` `(not present)` | Load workflows available for builder selection. |
| `loadSampleSets()` `(present)` | Load sample sets for workflow binding. |
| `selectWorkflow(workflowId)` `(not present)` | Update the currently selected workflow from the entry screen or header dropdown. |
| `openSelectedWorkflow()` `(not present)` | Open the selected workflow and transition into the builder workspace. |
| `returnToWorkflowSelection()` `(not present)` | Exit the builder workspace and return to the workflow selection entry screen. |
| `loadWorkflowBuilder()` `(not present)` | Hydrate the workflow builder with workflow-owned data and reusable resource catalogs. |
| `loadWorkflow(workflowId)` `(not present)` | Load an existing workflow and its DAG into the builder. |
| `refreshWorkflowBuilder()` `(not present)` | Refresh the active workflow builder context after a save or graph mutation. |
| `setWorkflowDraftField(field, value)` `(present, incomplete)` | Update workflow identification data upon user entry. |
| `saveWorkflow()` `(present, incomplete)` | Persist workflow identification data and the workflow DAG. |

---

## Actions

### Loading And Persistence Actions

#### `loadWorkflows()` `(not present)`

**Purpose:**

Load workflows available for builder selection.

**State Transition Flow:**

1. Enter workflow-selection loading state.
2. Request available workflows from the backend.
3. Store the returned workflow collection.
4. Clear loading state or surface a selection-screen error.

---

#### `loadSampleSets()` `(present)`

**Purpose:**

Load sample sets for workflow binding.

**State Transition Flow:**

1. Enter initial page loading state if builder bootstrap is still in progress.
2. Request sample sets from the backend.
3. Store the returned sample set collection.
4. Seed `workflowDraft.sample_set_id` when no sample set has yet been chosen and at least one set exists.
5. Clear loading state or surface a page-level error.

---

#### `loadWorkflowBuilder()` `(not present)`

**Purpose:**

Hydrate the workflow builder with workflow-owned data and reusable resource catalogs.

**State Transition Flow:**

1. Load sample sets.
2. Load reusable workflow steps.
3. Load payload templates.
4. Load output specifications.
5. Load workflow metadata and DAG when editing an existing workflow.
6. Normalize the loaded data into page and child-hook state.
7. Clear loading state and surface any scoped errors.

---

### Workflow Selection Actions

#### `selectWorkflow(workflowId)` `(not present)`

**Purpose:**

Update the currently selected workflow from the entry screen or header dropdown.

**State Transition Flow:**

1. Store the selected workflow identifier.
2. Derive the selected workflow option from the available workflow collection.
3. Preserve the current screen until the next explicit navigation action occurs.

---

#### `openSelectedWorkflow()` `(not present)`

**Purpose:**

Open the selected workflow and transition into the builder workspace.

**State Transition Flow:**

1. Validate that a workflow has been selected.
2. Enter workflow loading state.
3. Load workflow identification data.
4. Load workflow DAG nodes.
5. Load workflow DAG edges.
6. Normalize the returned data into page and child-hook state.
7. Hide the workflow selection entry screen.
8. Show the builder workspace with the selected workflow reflected in the header dropdown.
9. Clear workflow loading state.

---

#### `returnToWorkflowSelection()` `(not present)`

**Purpose:**

Exit the builder workspace and return to the workflow selection entry screen.

**State Transition Flow:**

1. Exit the active builder workspace view.
2. Show the workflow selection entry screen.
3. Preserve the available workflow options for reselection.
4. Preserve or clear the current workflow selection according to the page contract.

---

#### `loadWorkflow(workflowId)` `(not present)`

**Purpose:**

Load an existing workflow and its DAG into the builder.

**State Transition Flow:**

1. Load workflow identification data.
2. Load workflow DAG nodes.
3. Load workflow DAG edges.
4. Normalize the returned data into page and child-hook state.
5. Preserve reusable resource references as pinned IDs on the loaded nodes.

---

#### `refreshWorkflowBuilder()` `(not present)`

**Purpose:**

Refresh the active workflow builder context after a save or graph mutation.

**State Transition Flow:**

1. Reload workflow-owned metadata if a persisted workflow is active.
2. Reload workflow DAG nodes and edges.
3. Reload reusable catalogs when a step, payload template, or output specification may have changed.
4. Reconcile selections with the refreshed builder state.

---

### Workflow Metadata Actions

#### `setWorkflowDraftField(field, value)` `(present, incomplete)`

**Purpose:**

Update workflow identification data upon user entry.

**State Transition Flow:**

1. Update the requested workflow-owned field.
2. Preserve current DAG state and active modal state.
3. Keep the builder in the current editing context.

---
#### `saveWorkflow()` `(present, incomplete)`

**Purpose:**

Persist workflow identification data and the current workflow DAG as a draft.

**State Transition Flow:**

1. Enter saving state.
2. Validate workflow-owned fields required for draft persistence.
3. Build the workflow persistence payload using workflow identification data and the current DAG snapshot.
4. Set `status` to `draft`.
5. Persist the workflow record.
6. Persist or reconcile workflow DAG nodes for the saved workflow.
7. Persist or reconcile workflow DAG edges for the saved workflow.
8. Preserve the current editing context where possible.
9. Broadcast data-change events and surface success or failure feedback.
10. Clear saving state.

---
#### `createWorkflow()` `(not present)`

**Purpose:**

Create a finalized workflow by validating creation readiness and then persisting the workflow through the draft save path with finalized status.

**State Transition Flow:**


1. Enter workflow creation loading state.
2. Validate required workflow-owned fields such as workflow name, workflow description, and selected sample set.
3. Validate that the current DAG satisfies minimum creation requirements, including at least one valid workflow DAG node.
4. Set `status` to `finalized`.
5. Invoke the shared workflow persistence flow used by `saveWorkflow()`.
6. Surface success or failure feedback.
7. Clear workflow creation loading state.
8. Navigate the user to the workflow workspace page so the newly finalized workflow can be selected and opened.

---

## `useWorkflowBuilderCanvas` `(present, incomplete)`

### Purpose

Owns workflow DAG editing behavior including graph modes, node selection, edge selection, placement targeting, detail inspection, and graph mutation flows.

This hook manages the canvas interaction model while leaving workflow record persistence and reusable resource drafting to other hooks.

---

## State

| State | Type | Purpose |
|---|---|---|
| `nodes` | `WorkflowNode[]` | Stores workflow DAG nodes currently displayed and edited on the canvas. |
| `edges` | `WorkflowEdge[]` | Stores dependency edges currently displayed and edited on the canvas. |
| `mode` | `"add-step" \| "add-dependency" \| "delete-step" \| "delete-dependency" \| null` | Tracks the active graph interaction mode so canvas clicks can be interpreted correctly. |
| `selectedNodeId` | `ID \| null` | Stores the currently selected workflow DAG node. |
| `selectedEdgeId` | `ID \| null` | Stores the currently selected workflow DAG edge. |
| `dependencySourceNodeId` | `ID \| null` | Stores the currently selected source node during dependency creation. |
| `dependencyTargetNodeId` | `ID \| null` | Stores the currently selected target node during dependency creation. |
| `selectedPlacement` | `{ row: number, col: number } \| null` | Stores the selected canvas location for creating a new node. |
| `detailOpen` | `boolean` | Tracks whether node detail inspection is open. |
| `detailNodeId` | `ID \| null` | Stores the node currently being inspected in the detail flow. |
| `graphSaving` | `boolean` | Reserves async state for persisted graph mutations `(not present)`. |

---

## Action Overview

| Action | Purpose |
|---|---|
| `selectNode(nodeId)` `(present)` | Update the selected workflow DAG node and advance dependency targeting when needed. |
| `selectWorkflowEdge(edgeId)` `(present)` | Update the selected workflow DAG edge for inspection or deletion. |
| `enterAddWorkflowStepMode()` `(present)` | Move the canvas into workflow-step placement mode. |
| `enterAddDependencyMode()` `(present)` | Move the canvas into dependency-creation mode. |
| `enterDeleteWorkflowStepMode()` `(present)` | Move the canvas into workflow-step deletion mode. |
| `enterDeleteDependencyMode()` `(present)` | Move the canvas into dependency-deletion mode. |
| `cancelCanvasAction()` `(present)` | Return the canvas to its neutral editing state. |
| `resetCanvas()` `(present, incomplete)` | Reset the in-memory DAG and graph interaction state. |
| `selectPlacementTarget(row, col)` `(present)` | Choose where the next workflow DAG node should be placed. |
| `createWorkflowDagNode(input)` `(not present)` | Persist a new workflow DAG node through the workflow graph contract. |
| `deleteWorkflowDagNode(nodeId)` `(not present)` | Persist deletion of a workflow DAG node through the workflow graph contract. |
| `confirmWorkflowStepDeletion()` `(present, incomplete)` | Remove a workflow DAG node and its attached dependencies. |
| `confirmDependencyAddition()` `(present, incomplete)` | Create a dependency edge between two workflow DAG nodes. |
| `createWorkflowDagEdge(input)` `(not present)` | Persist a dependency edge through the workflow graph contract. |
| `deleteWorkflowDagEdge(edgeId)` `(not present)` | Persist deletion of a dependency edge through the workflow graph contract. |
| `confirmDependencyDeletion()` `(present, incomplete)` | Remove a workflow DAG edge from the builder. |
| `openNodeDetail(nodeId)` `(present)` | Open read-oriented details for a selected workflow DAG node. |
| `closeNodeDetail()` `(present)` | Close the workflow-step detail view. |

---

## Actions

### Selection Actions

#### `selectNode(nodeId)` `(present)`

**Purpose:**

Update the selected workflow DAG node and advance dependency targeting when needed.

**State Transition Flow:**

1. Store the selected node.
2. Clear any selected dependency edge.
3. If dependency mode is active, treat the selection as the source or target node depending on current dependency targeting state.
4. Close any open detail state tied to a different selection.

---

#### `selectWorkflowEdge(edgeId)` `(present)`

**Purpose:**

Update the selected workflow DAG edge for inspection or deletion.

**State Transition Flow:**

1. Store the selected dependency edge.
2. Clear any selected workflow node.
3. Close any node detail state that conflicts with edge selection.

---

### Mode Actions

#### `enterAddWorkflowStepMode()` `(present)`

**Purpose:**

Move the canvas into workflow-step placement mode.

**State Transition Flow:**

1. Set the active canvas mode to add-step.
2. Clear conflicting node, edge, and dependency selections.
3. Enable valid placement targets for the current graph state.
4. Clear stale graph-action errors.

---

#### `enterAddDependencyMode()` `(present)`

**Purpose:**

Move the canvas into dependency-creation mode.

**State Transition Flow:**

1. Set the active canvas mode to add-dependency.
2. Clear conflicting node, edge, and detail selections.
3. Reset dependency source and target targeting state.
4. Clear stale graph-action errors.

---

#### `enterDeleteWorkflowStepMode()` `(present)`

**Purpose:**

Move the canvas into workflow-step deletion mode.

**State Transition Flow:**

1. Set the active canvas mode to delete-step.
2. Clear conflicting edge, dependency, and detail selections.
3. Reset placement state.
4. Clear stale graph-action errors.

---

#### `enterDeleteDependencyMode()` `(present)`

**Purpose:**

Move the canvas into dependency-deletion mode.

**State Transition Flow:**

1. Set the active canvas mode to delete-dependency.
2. Clear conflicting node, dependency-targeting, and detail selections.
3. Reset placement state.
4. Clear stale graph-action errors.

---

#### `cancelCanvasAction()` `(present)`

**Purpose:**

Return the canvas to its neutral editing state.

**State Transition Flow:**

1. Clear active graph-editing mode.
2. Clear temporary node and edge selections.
3. Clear dependency targeting state.
4. Close any in-progress placement state tied to the active graph action.

---

#### `resetCanvas()` `(present, incomplete)`

**Purpose:**

Reset the in-memory DAG and graph interaction state.

**State Transition Flow:**

1. Clear nodes and edges from local canvas state.
2. Reset graph mode, graph selections, placement state, and detail state.
3. Preserve workflow identification data outside the canvas hook.

---

### Graph Mutation Actions

#### `selectPlacementTarget(row, col)` `(present)`

**Purpose:**

Choose where the next workflow DAG node should be placed.

**State Transition Flow:**

1. Store the selected placement cell.
2. Preserve the surrounding graph context.
3. Hand off placement state to the assignment flow.

---

#### `createWorkflowDagNode(input)` `(not present)`

**Purpose:**

Persist a new workflow DAG node through the workflow graph contract.

**State Transition Flow:**

1. Submit the node creation request for the active workflow.
2. Store or reconcile the persisted DAG node.
3. Refresh the workflow graph state.

---

#### `deleteWorkflowDagNode(nodeId)` `(not present)`

**Purpose:**

Persist deletion of a workflow DAG node through the workflow graph contract.

**State Transition Flow:**

1. Submit the node deletion request for the active workflow.
2. Remove the persisted DAG node from canvas state.
3. Refresh the workflow graph state.

---

#### `confirmWorkflowStepDeletion()` `(present, incomplete)`

**Purpose:**

Remove a workflow DAG node and its attached dependencies.

**State Transition Flow:**

1. Validate that a node is selected.
2. Remove the selected node.
3. Remove attached dependency edges.
4. Clear graph selection state.

---

#### `confirmDependencyAddition()` `(present, incomplete)`

**Purpose:**

Create a dependency edge between two workflow DAG nodes.

**State Transition Flow:**

1. Validate source and target node selection.
2. Reject self-links.
3. Reject duplicate dependencies.
4. Create the dependency edge.
5. Clear temporary dependency selection state.

---

#### `createWorkflowDagEdge(input)` `(not present)`

**Purpose:**

Persist a dependency edge through the workflow graph contract.

**State Transition Flow:**

1. Submit the dependency creation request for the active workflow.
2. Store or reconcile the persisted DAG edge.
3. Refresh the workflow graph state.

---

#### `deleteWorkflowDagEdge(edgeId)` `(not present)`

**Purpose:**

Persist deletion of a dependency edge through the workflow graph contract.

**State Transition Flow:**

1. Submit the dependency deletion request for the active workflow.
2. Remove the persisted DAG edge from canvas state.
3. Refresh the workflow graph state.

---

#### `confirmDependencyDeletion()` `(present, incomplete)`

**Purpose:**

Remove a workflow DAG edge from the builder.

**State Transition Flow:**

1. Validate that a dependency edge is selected.
2. Remove the selected edge.
3. Clear edge selection state.

---

### Detail Actions

#### `openNodeDetail(nodeId)` `(present)`

**Purpose:**

Open read-oriented details for a selected workflow DAG node.

**State Transition Flow:**

1. Store the selected node ID.
2. Open the detail modal.
3. Clear conflicting edge selection.
4. Clear stale error state tied to previous actions.

---

#### `closeNodeDetail()` `(present)`

**Purpose:**

Close the workflow-step detail view.

**State Transition Flow:**

1. Close the detail modal.
2. Clear the active detail node reference.

---

## `useWorkflowStepAssignment` `(present, incomplete)`

### Purpose

Owns the step-assignment flow that converts a selected placement target into a concrete workflow DAG node using an existing reusable workflow step or a handoff into step creation.

This hook manages assignment-modal behavior while leaving graph persistence and wizard drafting to separate hooks.

---

## State

| State | Type | Purpose |
|---|---|---|
| `assignmentOpen` | `boolean` | Tracks whether the step-assignment modal is open. |
| `assignmentMode` | `"existing" \| "create"` | Tracks whether the user is selecting an existing step or branching into step creation. |
| `assignmentStepId` | `ID \| null` | Stores the reusable workflow step currently selected for assignment. |
| `selectedPlacement` | `{ row: number, col: number } \| null` | Receives the current placement target that assignment will populate. |
| `stepCatalog` | `WorkflowStepDefinition[]` | Stores reusable workflow steps available for placement `(present, incomplete because local-only today)`. |

---

## Action Overview

| Action | Purpose |
|---|---|
| `openWorkflowStepAssignment()` `(present)` | Open the workflow-step assignment flow for the current placement target. |
| `loadWorkflowSteps()` `(not present)` | Load reusable workflow steps for placement into the DAG. |
| `setAssignmentMode(mode)` `(present)` | Switch the assignment flow between existing-step placement and new-step creation. |
| `selectWorkflowStep(stepId)` `(present)` | Choose the reusable workflow step that will be placed as a DAG node. |
| `submitWorkflowStepAssignment()` `(present, incomplete)` | Create a workflow DAG node from the selected reusable workflow step. |

---

## Actions

### Assignment Actions

#### `loadWorkflowSteps()` `(not present)`

**Purpose:**

Load reusable workflow steps for placement into the DAG.

**State Transition Flow:**

1. Request workflow steps from the backend.
2. Store the returned reusable step collection.
3. Surface loading or error state for the assignment flow.

---

#### `openWorkflowStepAssignment()` `(present)`

**Purpose:**

Open the workflow-step assignment flow for the current placement target.

**State Transition Flow:**

1. Set the assignment modal open state.
2. Default the assignment mode to existing-step selection.
3. Preserve the selected placement target.

---

#### `setAssignmentMode(mode)` `(present)`

**Purpose:**

Switch the assignment flow between existing-step placement and new-step creation.

**State Transition Flow:**

1. Update assignment mode to either existing or create.
2. Preserve the selected placement target.
3. Keep the current modal open and ready for the next action.

---

#### `selectWorkflowStep(stepId)` `(present)`

**Purpose:**

Choose the reusable workflow step that will be placed as a DAG node.

**State Transition Flow:**

1. Store the selected workflow step ID.
2. Preserve the current placement target and assignment flow state.
3. Keep the selected step available for confirmation.

---

#### `submitWorkflowStepAssignment()` `(present, incomplete)`

**Purpose:**

Create a workflow DAG node from the selected reusable workflow step.

**State Transition Flow:**

1. Validate that a placement target exists.
2. Validate that a reusable workflow step has been selected.
3. Resolve the selected step's payload template and output specification.
4. Create the DAG node at the selected position.
5. Close the assignment flow.
6. Select the newly created node.

---

## `useWorkflowStepCreationWizard` `(present, incomplete)`

### Purpose

Owns reusable workflow-step creation, including step identification, payload-template drafting, and output-specification drafting inside the wizard flow.

This hook manages the wizard state machine while leaving canvas interaction and workflow record persistence to separate hooks.

---

## State

| State | Type | Purpose |
|---|---|---|
| `wizardOpen` | `boolean` | Tracks whether the step creation wizard is open. |
| `wizardStep` | `0 \| 1 \| 2` | Tracks the current wizard stage. |
| `wizardDraft` | `WorkflowStepWizardDraft` | Stores the in-progress reusable workflow-step draft, including step, payload-template, and output-specification inputs. |
| `payloadTemplates` | `PayloadTemplate[]` | Stores reusable payload templates available to the wizard `(present, incomplete because local-only today)`. |
| `outputSpecifications` | `OutputSpecification[]` | Stores reusable output specifications available to the wizard `(present, incomplete because local-only today)`. |
| `stepCatalog` | `WorkflowStepDefinition[]` | Stores reusable workflow-step definitions so newly created steps can be returned to assignment `(present, incomplete because local-only today)`. |
| `catalogsLoading` | `boolean` | Reserves async state for reusable resource loading in the wizard `(not present)`. |
| `catalogsError` | `string \| null` | Reserves error state for reusable resource loading in the wizard `(not present)`. |

---

## Action Overview

| Action                                                                  | Purpose                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `openWorkflowStepCreationWizard()` `(present)`                          | Begin creation of a reusable workflow step resource.                        |
| `closeWorkflowStepCreationWizard()` `(present)`                         | Close the workflow step creation wizard.                                    |
| `nextWorkflowStepCreationWizardStep()` `(present, incomplete)`          | Advance the workflow step creation wizard to the next stage.                |
| `previousWorkflowStepCreationWizardStep()` `(present)`                  | Return the workflow step creation wizard to the prior stage.                |
| `setStepWizardField(field, value)` `(present)`                          | Update shared workflow-step wizard input state.                             |
| `setStepWizardPayloadTemplateField(field, value)` `(present)`           | Update payload-template drafting input inside the workflow-step wizard.     |
| `setStepWizardOutputSpecField(field, value)` `(present)`                | Update output-specification drafting input inside the workflow-step wizard. |
| `createStepWizardPayloadTemplate()` `(present, incomplete)`             | Create a reusable payload template from wizard input.                       |
| `addStepWizardPayloadTemplateInput()` `(present)`                       | Add a new payload input row to the payload-template draft.                  |
| `updateStepWizardPayloadTemplateInput(index, field, value)` `(present)` | Update one payload input row in the payload-template draft.                 |
| `removeStepWizardPayloadTemplateInput(index)` `(present)`               | Remove one payload input row from the payload-template draft.               |
| `addStepWizardOutputSpecField()` `(present)`                            | Add a new output field row to the output-specification draft.               |
| `updateStepWizardOutputSpecField(index, field, value)` `(present)`      | Update one output field row in the output-specification draft.              |
| `removeStepWizardOutputSpecField(index)` `(present)`                    | Remove one output field row from the output-specification draft.            |
| `submitWorkflowStepCreation()` `(present, incomplete)`                  | Create a reusable workflow step and return it to the assignment flow.       |
| `loadPayloadTemplates()` `(not present)`                                | Load reusable payload templates for workflow-step creation.                 |
| `loadOutputSpecifications()` `(not present)`                            | Load reusable output specifications for workflow-step creation.             |
| `createWorkflowStep(input)` `(not present)`                             | Persist a new reusable workflow step resource.                              |
| `createPayloadTemplate(input)` `(not present)`                          | Persist a new reusable payload template resource.                           |
| `createOutputSpecification(input)` `(not present)`                      | Persist a new reusable output specification resource.                       |

---

## Actions

### Wizard Lifecycle Actions

#### `openWorkflowStepCreationWizard()` `(present)`

**Purpose:**

Begin creation of a reusable workflow step resource.

**State Transition Flow:**

1. Open the workflow step creation wizard.
2. Reset the wizard to the first stage.
3. Seed the wizard draft state.
4. Clear stale wizard errors.

---

#### `closeWorkflowStepCreationWizard()` `(present)`

**Purpose:**

Close the workflow step creation wizard.

**State Transition Flow:**

1. Close the wizard modal.
2. Reset the wizard stage to the beginning.
3. Preserve the surrounding assignment context.

---

#### `nextWorkflowStepCreationWizardStep()` `(present, incomplete)`

**Purpose:**

Advance the workflow step creation wizard to the next stage.

**State Transition Flow:**

1. Validate the current wizard stage inputs.
2. Advance to the next wizard stage.
3. Clear stale wizard errors.

---

#### `previousWorkflowStepCreationWizardStep()` `(present)`

**Purpose:**

Return the workflow step creation wizard to the prior stage.

**State Transition Flow:**

1. Move the wizard back one stage.
2. Preserve the existing wizard draft values.

---

### Wizard Draft Actions

#### `setStepWizardField(field, value)` `(present)`

**Purpose:**

Update shared workflow-step wizard input state.

**State Transition Flow:**

1. Update the requested wizard field.
2. Preserve payload-template and output-spec drafting state.

---

#### `setStepWizardPayloadTemplateField(field, value)` `(present)`

**Purpose:**

Update payload-template drafting input inside the workflow-step wizard.

**State Transition Flow:**

1. Update the requested payload-template draft field.
2. Preserve the rest of the wizard draft state.

---

#### `setStepWizardOutputSpecField(field, value)` `(present)`

**Purpose:**

Update output-specification drafting input inside the workflow-step wizard.

**State Transition Flow:**

1. Update the requested output-spec draft field.
2. Preserve the rest of the wizard draft state.

---

### Payload Template Draft Actions

#### `createStepWizardPayloadTemplate()` `(present, incomplete)`

**Purpose:**

Create a reusable payload template from wizard input.

**State Transition Flow:**

1. Validate payload-template creation input.
2. Create the payload template resource.
3. Add the new template to the reusable template list.
4. Switch the wizard back to existing-template mode with the new template selected.

---

#### `addStepWizardPayloadTemplateInput()` `(present)`

**Purpose:**

Add a new payload input row to the payload-template draft.

**State Transition Flow:**

1. Append a blank payload input row to the draft list.
2. Preserve the rest of the wizard draft state.

---

#### `updateStepWizardPayloadTemplateInput(index, field, value)` `(present)`

**Purpose:**

Update one payload input row in the payload-template draft.

**State Transition Flow:**

1. Locate the targeted payload input row.
2. Update the requested field in that row.
3. Preserve the rest of the draft list.

---

#### `removeStepWizardPayloadTemplateInput(index)` `(present)`

**Purpose:**

Remove one payload input row from the payload-template draft.

**State Transition Flow:**

1. Remove the targeted payload input row.
2. Ensure at least one blank row remains when the list would otherwise be empty.
3. Preserve the rest of the wizard draft state.

---

### Output Specification Draft Actions

#### `addStepWizardOutputSpecField()` `(present)`

**Purpose:**

Add a new output field row to the output-specification draft.

**State Transition Flow:**

1. Append a blank output field row to the draft list.
2. Preserve the rest of the wizard draft state.

---

#### `updateStepWizardOutputSpecField(index, field, value)` `(present)`

**Purpose:**

Update one output field row in the output-specification draft.

**State Transition Flow:**

1. Locate the targeted output field row.
2. Update the requested field in that row.
3. Preserve the rest of the draft list.

---

#### `removeStepWizardOutputSpecField(index)` `(present)`

**Purpose:**

Remove one output field row from the output-specification draft.

**State Transition Flow:**

1. Remove the targeted output field row.
2. Ensure at least one blank row remains when the list would otherwise be empty.
3. Preserve the rest of the wizard draft state.

---

### Reusable Resource Persistence Actions

#### `submitWorkflowStepCreation()` `(present, incomplete)`

**Purpose:**

Create a reusable workflow step and return it to the assignment flow.

**State Transition Flow:**

1. Validate workflow step identification.
2. Validate payload template selection or creation input.
3. Validate output specification selection or creation input.
4. Create the reusable workflow step definition.
5. Return to the assignment flow with the new step selected.

---

#### `loadPayloadTemplates()` `(not present)`

**Purpose:**

Load reusable payload templates for workflow-step creation.

**State Transition Flow:**

1. Request payload templates from the backend.
2. Store the returned reusable template collection.
3. Surface loading or error state for the wizard flow.

---

#### `loadOutputSpecifications()` `(not present)`

**Purpose:**

Load reusable output specifications for workflow-step creation.

**State Transition Flow:**

1. Request output specifications from the backend.
2. Store the returned reusable output-spec collection.
3. Surface loading or error state for the wizard flow.

---

#### `createWorkflowStep(input)` `(not present)`

**Purpose:**

Persist a new reusable workflow step resource.

**State Transition Flow:**

1. Submit the workflow-step creation request.
2. Store or reconcile the persisted reusable step.
3. Refresh the reusable step catalog.

---

#### `createPayloadTemplate(input)` `(not present)`

**Purpose:**

Persist a new reusable payload template resource.

**State Transition Flow:**

1. Submit the payload-template creation request.
2. Store or reconcile the persisted payload template.
3. Refresh the reusable template catalog.

---

#### `createOutputSpecification(input)` `(not present)`

**Purpose:**

Persist a new reusable output specification resource.

**State Transition Flow:**

1. Submit the output-specification creation request.
2. Store or reconcile the persisted output specification.
3. Refresh the reusable output-spec catalog.

### 6. Components

#### WorkflowBuilderEntryScreen

**Purpose**

Lets the user choose which workflow to open before the active builder workspace is shown.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Workflow Builder                                                             │
│                                                                              │
│ Select workflow                                                              │
│ [ Choose a workflow                                                       ]  │
│                                                               [Open Builder] │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

**UI**

- Appears before any builder-specific workspace content is shown.
- Uses a simple title, workflow dropdown, and primary open action.
- Keeps the entry experience lightweight so the user can quickly move into editing.
- Replaces the selector with empty-state guidance when no workflows are available.

---

**Props**

| Prop | Description |
|---|---|
| `workflows` | Workflows available for selection. |
| `selectedWorkflowId` | Currently selected workflow option. |
| `loading` | Whether workflow options are loading. |
| `onSelectWorkflow` | Updates the selected workflow. |
| `onOpenSelectedWorkflow` | Opens the selected workflow in the builder workspace. |

---

**Children**

- **Entry Title** - Displays `Workflow Builder`.
- **Workflow Selector** - Lets the user pick which workflow to open.
- **Open Builder Button** - Enters the active builder workspace for the selected workflow.
- **Entry Empty State** - Explains what to do when no workflows exist yet.

---

#### WorkflowBuilderPageView

**Purpose**

Provides the route-level frame for the workflow builder and switches between the selection entry screen and the active builder workspace.

---

**UI Outline**

```text
if no workflow is open:

[WorkflowBuilderEntryScreen]

if a workflow is open:

Workflow Builder   [Workflow ▼]   Draft   [Return]   [Save Workflow]

[Builder Metadata Sidebar] | [Workflow Canvas]

[Step Assignment Modal]
[Step Creation Wizard Modal]
[Step Detail Modal]
```

---

**UI**

- Uses a workflow selection entry screen before the active builder workspace is shown.
- Once a workflow is open, uses a header-first builder composition with workflow switching, status, and save actions anchored at the top.
- Splits the editable workspace into a narrow metadata sidebar and a wide visual workbench.
- Treats the canvas as the main focus once the builder has loaded.
- Preserves the same overall frame while modal flows layer on top of the page.
- Allows the user to return from the active builder workspace to the selection entry screen without leaving the page.
- Allows the user to switch directly to another workflow from the header selector without first returning to the entry screen.
- Replaces the work area with a loading panel during initial bootstrap.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Page-level builder state returned by `useWorkflowBuilderPage`. |
| `actions` | Page-level builder actions returned by `useWorkflowBuilderPage`. |

---

**Children**

- **Workflow Builder Entry Screen** - Lets the user select which workflow to open before the builder workspace appears.
- **WorkflowBuilderPageHeader** - Displays page identity, workflow selector, return action, and save action.
- **WorkflowBuilderMetadataForm** - Captures workflow-level metadata.
- **WorkflowBuilderCanvas** - Presents graph editing actions and the grid canvas.
- **WorkflowStepAssignmentModal** - Places a step into the graph.
- **WorkflowStepCreationWizardModal** - Creates a reusable step and its supporting definitions.
- **WorkflowStepDetailModal** - Displays read-oriented details for a placed node.

---

#### WorkflowBuilderPageHeader

**Purpose**

Displays page identity, the active workflow selector, return navigation, and the primary save action.

---

**UI Outline**

```text
Workflow Builder   [Workflow ▼]   Draft   [Return]   [Save Workflow]
```

---

**UI**

- Keeps the page title, active workflow selector, and status close together so the workflow context is always visible.
- Lets the user switch directly to another workflow from the header selector while staying inside the builder.
- Exposes a return action that takes the user back to the workflow selection entry screen.
- Gives the save action strong emphasis as the primary page command.
- Uses disabled and saving states to prevent accidental repeat submission.

---

**Props**

| Prop | Description |
|---|---|
| `workflows` | Workflow options available in the header selector. |
| `selectedWorkflowId` | Identifier of the workflow currently shown in the builder. |
| `status` | Current workflow lifecycle status or display label. |
| `saving` | Whether the workflow is currently being persisted. |
| `disabled` | Whether saving is currently allowed. |
| `onSelectWorkflow` | Switches the active workflow from the header selector. |
| `onReturn` | Returns the user to the workflow selection entry screen. |
| `onSave` | Saves the workflow. |

---

**Children**

- **Title Copy** - Displays `Workflow Builder`.
- **Workflow Selector** - Displays the current workflow and allows switching to another workflow.
- **Status Pill** - Displays the current draft status.
- **Return Button** - Returns the user to the workflow selection entry screen.
- **Save Button** - Executes the workflow save action.

---

#### WorkflowBuilderMetadataForm

**Purpose**

Captures workflow-level configuration before and alongside graph authoring.

---

**UI Outline**

```text
┌──────────────────────────────┐
│ Builder                      │
│ Workflow name                │
│ [__________________________] │
│ Workflow description         │
│ [__________________________] │
│ Sample set                   │
│ [ Choose a sample set      ] │
│ Model        Model family    │
│ [__________] [ gemini      ] │
│ N sample sets loaded.        │
└──────────────────────────────┘
```

---

**UI**

- Uses a stacked form layout that stays compact and scannable.
- Keeps workflow identity and sample-set selection above model settings because they define the primary context.
- Uses a footer summary to confirm whether the builder has usable sample-set data loaded.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Builder state containing `workflowDraft` and `sampleSets`. |
| `actions` | Builder actions including `setWorkflowDraftField`. |

---

**Children**

- **Workflow Name Field** - Captures the workflow title.
- **Workflow Description Field** - Captures workflow intent and shape.
- **Sample Set Selector** - Binds the workflow to a sample set.
- **Model Inputs** - Capture model and model-family choices.
- **Load Summary** - Displays sample-set availability.

---

#### WorkflowBuilderCanvas

**Purpose**

Provides the primary graph-editing surface for the workflow builder.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────┐
│ Canvas                                                       │
│ [ + Add Step ] [ Add Dependency ] [ Delete Step ] [ Cancel ] │
│                                                              │
│    ○──────○                                                  │
│    │      │                                                  │
│    ○   [+]○                                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

**UI**

- Presents graph editing inside a panel with explicit mode actions at the top.
- Uses a grid-based canvas so node placement feels structured instead of freeform.
- Draws dependencies behind the nodes as directional edges.
- Renders nodes as discrete selectable buttons and renders placement targets only where addition is allowed.
- Uses the canvas both as a graph editor and as the main visual summary of the workflow structure.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Builder state containing graph data and interaction mode. |
| `actions` | Builder actions for graph selection and mutation flows. |

---

**Children**

- **Canvas Header** - Displays the `Canvas` title.
- **Canvas Action Bar** - Exposes add, link, delete, and cancel actions.
- **Edge Layer** - Renders dependency lines.
- **Node Layer** - Renders placed steps.
- **Placement Targets** - Expose valid empty locations for new steps.

---

#### WorkflowStepAssignmentModal

**Purpose**

Coordinates the placement of a reusable or newly created step into the graph.

---

**UI Outline**

```text
┌──────────────────────────────────────────────┐
│ Add workflow step                     [Close]│
│ How would you like to add a step?            │
│ [Use existing step] [Create new step]        │
│                                              │
│ Choose a step                                │
│ [ Review quality - Gemini, v1 ]              │
│                                              │
│ Selected Step                                │
│ Review quality                               │
│ Gemini · model · Version 1                   │
│                              [Cancel][Add]   │
└──────────────────────────────────────────────┘
```

---

**UI**

- Uses a modal to keep placement context focused.
- Separates the choice of assignment mode from the details of the selected step.
- Treats creation as a branch into the wizard instead of mixing creation and placement in one dense form.
- Keeps the confirm action at the bottom so the flow reads left-to-right, top-to-bottom.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Builder state containing assignment visibility, mode, catalog, and selected placement. |
| `actions` | Builder actions for assignment, cancellation, and wizard entry. |

---

**Children**

- **Mode Switch** - Toggles between existing-step use and new-step creation.
- **Step Selector** - Lists reusable steps.
- **Step Summary** - Shows the currently selected step.
- **Create Entry Card** - Sends the user to the wizard when catalog reuse is insufficient.
- **Modal Footer** - Provides cancel and confirm actions.

---

#### WorkflowStepCreationWizardModal

**Purpose**

Creates a reusable workflow step and its supporting payload and output contracts.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────┐
│ Create Step                                           [Close]│
│ [Step identification] [Payload template] [Output spec]       │
│                                                              │
│ Step-specific form content for current stage                 │
│                                                              │
│ [Back/Cancel]                            [Next/Create Step]  │
└──────────────────────────────────────────────────────────────┘
```

---

**UI**

- Uses a staged wizard to reduce the complexity of creating a reusable step contract.
- Keeps step identity, payload contract, and output contract visually separated.
- Supports either selecting existing reusable definitions or creating new ones inline.
- Returns the user to assignment rather than treating the wizard as a standalone page.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Builder state containing wizard visibility, current step, catalogs, and wizard draft. |
| `actions` | Builder actions for wizard navigation and resource creation. |

---

**Children**

- **Stepper** - Shows the current wizard stage.
- **Identification Form** - Captures the workflow step name and description.
- **Payload Template Section** - Selects or creates a payload template.
- **Output Specification Section** - Selects or creates an output specification.
- **Wizard Footer** - Provides navigation and submit actions.

---

#### WorkflowStepDetailModal

**Purpose**

Displays read-only details for a placed workflow step.

---

**UI Outline**

```text
┌──────────────────────────────────────────────┐
│ Review quality - Details              [Close]│
│ Step details                                 │
│ Title                     Review quality     │
│ Canvas position           Row 2, Col 4       │
│ Payload template          Template name      │
│ Output specification      Output name        │
│                                              │
│ Description                                  │
│ No description provided.                     │
└──────────────────────────────────────────────┘
```

---

**UI**

- Uses a compact inspection modal rather than an editing form.
- Prioritizes placement and contract references because they help the user understand graph structure quickly.
- Keeps long-form description separate from metadata rows.

---

**Props**

| Prop | Description |
|---|---|
| `state` | Builder state containing detail visibility, selected node, and catalog references. |
| `actions` | Builder actions including `closeNodeDetail`. |

---

**Children**

- **Metadata Grid** - Displays node title, position, template, and output spec.
- **Description Card** - Displays step description text.