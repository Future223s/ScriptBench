# 1. Layout

## Workspace Layout

**Purpose:**

Provides the primary execution workspace for a selected workflow by keeping workflow context visible at the top and making execution-row status columns the main visual focus.

**Structure:**

Workflow selection entry screen
  - Page title
  - Workflow selector dropdown
  - Primary action to open the selected workflow workspace

Active workspace
  - Header
    - Title
    - Workflow details
    - Workflow selector dropdown
  - Main execution hero
    - One-line execution panel
    - Three execution-status columns

Modal and overlay layer
  - Execution row detail surface
  - Failure overlay

**Positioning:**

- The page should require workflow selection before showing any workflow-specific execution content.
- Once a workflow is opened, the header sits above the execution workspace and keeps workflow identity visible.
- The execution hero occupies the primary width of the page and is the dominant visual region.
- The one-line execution panel sits directly above the status columns as a shared control strip.
- The three columns appear side by side on wider screens and preserve a left-to-right flow of `Not Started`, `In Progress`, and `Completed`.
- Overlay flows should appear above the workspace without navigating away from the page.

**Behavior:**

- The layout should reuse the familiar three-column execution shape from the current frontend, while redefining the content around workflow execution rows rather than legacy transcription jobs.
- The header should prioritize workflow context and workflow switching rather than execution controls.
- The execution panel should centralize shared controls such as concurrency configuration and bulk execution actions instead of scattering them across individual column headers.
- The `In Progress` column should visually absorb intermediate execution states such as queued and running rather than promoting them to separate top-level columns.
- Only frontend-visible source execution rows belong in the three-column board; `decomposed_item` rows remain out of the visible page layout.
- Loading, refreshing, and websocket-driven row updates should preserve the page frame so the user keeps orientation while execution state changes.
- The layout should support row-level updates without forcing the entire board to visually reset.
# 2. Regions

## Workflow Workspace Entry Screen

**Purpose:**

Lets the user choose which workflow to open before any workflow-specific execution content is shown.

**Contents:**

- Page title
- Workflow selector dropdown
- Open workspace action

**Behavior:**

- The page stays on this screen until a workflow is selected and opened.
- Returning from the active workspace should restore this screen.

**Empty State:**

- If no workflows exist, replace the selector and action with guidance to create a workflow first.

**Loading State:**

- While workflows are loading, keep the entry frame visible and withhold the execution workspace.

## Workspace Header

**Purpose:**

Provides page identity, active workflow context, and a workflow selector for changing workspace context.

**Contents:**

- Page title
- Workflow name
- Workflow details such as sample-set context and workflow status
- Workflow selector dropdown

**Behavior:**

- Workflow details should help the user confirm they are looking at the correct workflow before acting on execution rows.
- Changing the workflow from this region should replace the active execution workspace while keeping the same page frame.

**Empty State:**

- No distinct empty state once a workflow is opened; the header remains stable even if the execution board has no rows yet.

**Loading State:**

- Preserve the header frame while workflow-specific data resolves.

## Execution Control Strip

**Purpose:**

Centralizes workflow-wide execution configuration and bulk actions above the status board.

**Contents:**

- Maximum concurrent requests selector
- Maximum concurrent execution rows selector
- Bulk actions such as queue, dequeue, and retry for selected rows
- Shared execution status messaging

**Behavior:**

- Controls here apply across the whole execution board rather than to a single column.
- Bulk actions operate on the current execution-row selection state.
- Queue, dequeue, and retry are shared board actions rather than column-header actions.

**Empty State:**

- If no execution rows exist, keep the strip visible but disable row-dependent actions.

**Loading State:**

- Preserve the strip while execution rows load so the layout does not jump.

## Not Started Column

**Purpose:**

Displays source execution rows that have not yet entered active execution.

**Contents:**

- Column header labeled `Not Started`
- Select-all control for visible rows in the column
- Execution row cards showing `sample_id`, execution scope, and a truncated sample-scoped input blurb

**Behavior:**

- Rows here are eligible for queueing.
- This column should only display frontend-visible source execution rows.

**Empty State:**

- Display a clear no-rows message when no not-started rows exist.

**Loading State:**

- Preserve the column shell and replace rows with placeholders while loading.

## In Progress Column

**Purpose:**

Displays source execution rows that are actively moving through execution, including intermediate worker states.

**Contents:**

- Column header labeled `In Progress`
- Select-all control for visible rows in the column
- Execution row cards that expose sub-state detail for `in_progress`, `queued`, and `running`

**Behavior:**

- This column is the visible home for `queued` and `running`; they do not get separate columns.
- Rows are ordered by `execution_row_id`.
- Within that ordering, the first row picked up for active execution moves to the top of the column.
- Card detail changes by sub-state:
  - `In Progress` shows last successful completion.
  - `Queued` shows queued state plus last successful completion and uses a yellow treatment.
  - `Running` shows the running node plus last successful completion and uses an orange treatment.

**Empty State:**

- Display a clear no-rows message when nothing is currently in progress.

**Loading State:**

- Preserve the column shell and replace rows with placeholders while loading.

## Completed Column

**Purpose:**

Displays source execution rows whose visible workflow execution is complete.

**Contents:**

- Column header labeled `Completed`
- Select-all control for visible rows in the column
- Execution row cards with completion summary

**Behavior:**

- Cards retain the same summary surface as the other columns and emphasize completion state plus last successful completion context.
- Rows here are eligible for retry-oriented actions.
- Completed rows remain visible for scanning and comparison rather than disappearing from the board immediately.

**Empty State:**

- Display a clear no-rows message when no rows have completed.

**Loading State:**

- Preserve the column shell and replace rows with placeholders while loading.

## Execution Row Detail Surface

**Purpose:**

Lets the user inspect a specific execution row in more detail without leaving the workspace.

**Contents:**

- Execution row summary and metadata details
- Step-scoped output section
  - Success or error state for the current step
  - Raw payload
  - Parsed payload

**Behavior:**

- Opens from an execution row card.
- The execution row summary and metadata section should stay anchored to row-level facts that do not change from step to step.
- The output section should reflect the currently relevant workflow step outcome rather than flattening all step activity into one undifferentiated payload view.

**Empty State:**

- No standalone empty state; this region appears only when a row is selected or when failure handling requires it.

**Loading State:**

- If detail data requires refresh, keep the surface open and replace only its body content with loading feedback.

## Failure Overlay

**Purpose:**

Handles worker failure events without forcing navigation away from the workspace.

**Contents:**

- Execution row metadata reference
- Error message
- `Acknowledge`, `Retry`, and `Abort` actions
- Collapsed detail entry that can be expanded to reveal step-scoped output detail

**Behavior:**

- Opens automatically from worker `FAILED` events for the affected execution row.
- Presents execution-row metadata first, then the error message, then the three failure actions.
- Expanded detail reveals the step-scoped success or error context, raw payload, and parsed payload without changing pages.
- Closing an overlay should return the user to the same workspace context.

**Empty State:**

- No standalone empty state; overlays only appear when triggered.

**Loading State:**

- If an overlay action is in flight, preserve the overlay and communicate progress in place.
# 3. Interactions

## Open Workflow Workspace

**Trigger:**

User selects a workflow and opens the workspace.

**Flow:**

1. Load the selected workflow workspace.
2. Populate the header, execution control strip, and three status columns.

**Result:**

- The selected workflow becomes the active execution workspace.

**Failure Behavior:**

- Show a workspace-loading error without leaving the entry screen.

## Switch Workflow

**Trigger:**

User changes the workflow from the header dropdown.

**Flow:**

1. Replace the active workflow context.
2. Reload execution rows for the newly selected workflow.

**Result:**

- The same page frame remains open with a different workflow loaded.

**Failure Behavior:**

- Preserve the current workspace and show a switch error.

## Select Execution Rows

**Trigger:**

User selects or unselects one row, or toggles select-all within a column.

**Flow:**

1. Update selection state for the affected row or column.
2. Recompute which shared execution actions are enabled.

**Result:**

- Bulk controls reflect the current execution-row selection.

## Queue Selected Rows

**Trigger:**

User queues selected `Not Started` rows.

**Flow:**

1. Submit the selected source execution rows for queueing.
2. Move affected rows out of `Not Started`.
3. Re-render only the affected rows as lifecycle events arrive.

**Result:**

- Selected rows enter the `In Progress` column under queued or running sub-states.

**Failure Behavior:**

- Preserve selection and show queueing failure feedback.

## Dequeue Selected Rows

**Trigger:**

User dequeues selected rows from `In Progress`.

**Flow:**

1. Submit the selected rows for dequeue.
2. Revert affected rows to the board state used for resumable work.

**Result:**

- Selected rows return to the visible pre-completion execution flow.

**Failure Behavior:**

- Preserve selection and show dequeue failure feedback.

## Retry Selected Rows

**Trigger:**

User retries selected `Completed` rows.

**Flow:**

1. Submit the selected rows for retry.
2. Return them to the active execution flow.

**Result:**

- Selected rows leave `Completed` and re-enter `In Progress`.

**Failure Behavior:**

- Preserve selection and show retry failure feedback.

## Inspect Execution Row

**Trigger:**

User opens an execution row from any status column.

**Flow:**

1. Open the execution row detail surface.
2. Show stable row metadata plus step-scoped output detail.

**Result:**

- The user can inspect row context, success state, error state, raw payload, and parsed payload without leaving the board.

## Receive Execution Events

**Trigger:**

The workspace receives execution lifecycle events for a visible row.

**Flow:**

1. Match the event to its execution row.
2. Update only the affected row and any open detail surface for that row.
3. Move the row across columns or sub-states when required.

**Result:**

- The board stays stable while row state changes stream in.

## Handle Execution Failure

**Trigger:**

An execution row emits a failure event.

**Flow:**

1. Open the failure-aware detail surface or overlay.
2. Show row metadata, step-scoped error state, and raw payload.
3. Let the user acknowledge, retry, or abort when available.

**Result:**

- The user can inspect and act on the failed execution row in place.
# 4. State

## Workflow Context

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `workflows` | `Workflow[]` | Available workflows for entry selection and header switching. | Workflow list load. | Entry screen, workspace header |
| `selectedWorkflowId` | `ID \| null` | Active workflow loaded into the workspace. | Entry selection or header switch. | Whole page |
| `selectedWorkflowSummary` | `Workflow \| null` | Header-facing workflow context such as name, sample set, and status. | Active workspace load. | Workspace header |

## Execution Board Data

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `notStartedRows` | `ExecutionRow[]` | Visible source execution rows in `not_started`. | Workspace load and row events. | Not Started column |
| `inProgressRows` | `ExecutionRow[]` | Visible source execution rows shown in the `In Progress` column, including queued and running sub-states. | Workspace load and row events. | In Progress column |
| `completedRows` | `ExecutionRow[]` | Visible source execution rows in `completed`. | Workspace load and row events. | Completed column |
| `rowOrder` | `ID[]` | Stable board ordering keyed by `execution_row_id`, with the actively picked-up running row promoted to the top of `In Progress`. | Workspace load plus runtime updates. | Status columns |
| `hiddenExecutionScopes` | `ExecutionScope[]` | Execution scopes intentionally excluded from the board, especially `decomposed_item`. | Spec rule plus workspace load. | Status columns, detail gating |

## Execution Configuration And Selection

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `maxConcurrentRequests` | `number` | Workflow-wide request concurrency setting. | Execution control strip. | Execution control strip |
| `maxConcurrentExecutionRows` | `number` | Workflow-wide execution-row concurrency setting. | Execution control strip. | Execution control strip |
| `selectedRowIdsByColumn` | `Record<"not_started" \| "in_progress" \| "completed", ID[]>` | Visible row selection grouped by status column. | Row toggles and select-all actions. | Execution control strip, status columns |
| `enabledBulkActions` | `ExecutionActionState` | Derived action availability for queue, dequeue, retry, acknowledge, or abort. | Derived from selection plus row states. | Execution control strip, detail surface |

## Detail And Failure Inspection

| State | Type | Description | Source | Consumers |
|---|---|---|---|---|
| `selectedExecutionRowId` | `ID \| null` | Row currently opened in the detail surface. | Row open action or failure event. | Execution row detail surface |
| `selectedExecutionRowSummary` | `ExecutionRowSummary \| null` | Row-level metadata that does not change across workflow steps. | Detail load or board state. | Execution row detail surface |
| `selectedStepOutput` | `StepScopedOutput \| null` | Step-scoped success/error state, raw payload, and parsed payload for the inspected row. | Detail load or failure event. | Execution row detail surface |
| `failureOverlayState` | `FailureOverlayState \| null` | Failure-specific overlay context, actions, and message payload. | Failure event or failed-row inspection. | Failure overlay |

## Async And Live Update State

| State                       | Type              | Description                                                               | Source                      | Consumers                                        |
| --------------------------- | ----------------- | ------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------ |
| `isLoadingWorkflows`        | `boolean`         | Entry-screen workflow loading state.                                      | Initial workflow load.      | Entry screen                                     |
| `isLoadingWorkspace`        | `boolean`         | Active workspace bootstrap or workflow-switch loading state.              | Workspace load.             | Whole page                                       |
| `isApplyingExecutionAction` | `boolean`         | In-flight state for queue, dequeue, retry, acknowledge, or abort actions. | Execution actions.          | Execution control strip, detail surface, overlay |
| `workspaceError`            | `string \| null`  | Page-level failure state for workspace loading or execution actions.      | Failed loads or actions.    | Entry screen, workspace surface                  |
| `liveRowUpdateStatus`       | `ConnectionState` | Websocket or event-stream health for row lifecycle updates.               | Event connection lifecycle. | Execution control strip, workspace surface       |
# 5. Hooks

## Hooks Overview

| Hook | Purpose |
|---|---|
| `useWorkspacePage` | Owns workflow selection, workspace loading, visible execution-row state, bulk execution actions, and live row updates. |
| `useExecutionRowDetail` | Owns execution-row inspection, including stable row metadata and step-scoped output detail. |
| `useExecutionRowFailureOverlay` | Owns failure-event overlays, including row metadata, error message, failure actions, and expandable detail. |

## `useWorkspacePage`

### Purpose

Owns the page-level workspace lifecycle: choosing a workflow, loading execution rows, maintaining the three-column board, tracking selection, and applying shared execution actions.

### State

| State | Type | Purpose |
|---|---|---|
| `workflows` | `Workflow[]` | Available workflow options. |
| `selectedWorkflowId` | `ID \| null` | Active workflow context. |
| `selectedWorkflowSummary` | `Workflow \| null` | Header-facing workflow metadata. |
| `notStartedRows` | `ExecutionRow[]` | Visible `not_started` rows. |
| `inProgressRows` | `ExecutionRow[]` | Visible `in_progress`, `queued`, and `running` rows. |
| `completedRows` | `ExecutionRow[]` | Visible `completed` rows. |
| `selectedRowIdsByColumn` | `Record<"not_started" \| "in_progress" \| "completed", ID[]>` | Bulk-selection state grouped by board column. |
| `maxConcurrentRequests` | `number` | Request concurrency setting. |
| `maxConcurrentExecutionRows` | `number` | Execution-row concurrency setting. |
| `isLoadingWorkflows` | `boolean` | Entry-screen loading state. |
| `isLoadingWorkspace` | `boolean` | Active workspace loading state. |
| `isApplyingExecutionAction` | `boolean` | In-flight bulk-action state. |
| `workspaceError` | `string \| null` | Page-level error state. |
| `liveRowUpdateStatus` | `ConnectionState` | Lifecycle-update connection state. |

### Action Overview

| Action | Purpose |
|---|---|
| `loadWorkflows()` | Load available workflows for entry and switching. |
| `openWorkflowWorkspace(workflowId)` | Open a selected workflow into the workspace. |
| `switchWorkflow(workflowId)` | Replace the active workflow without leaving the page. |
| `setExecutionConcurrency(config)` | Update execution control-strip configuration. |
| `toggleExecutionRowSelection(status, executionRowId, selected)` | Select or unselect one visible row. |
| `selectAllRows(status)` | Select or clear all visible rows in one column. |
| `queueSelectedRows()` | Queue selected `Not Started` rows. |
| `dequeueSelectedRows()` | Dequeue selected `In Progress` rows. |
| `retrySelectedRows()` | Retry selected `Completed` rows. |
| `applyExecutionRowEvent(event)` | Patch the board from a row lifecycle event. |
| `clearWorkspaceSelection()` | Reset board selection after context changes or completed actions. |

### Actions

#### `loadWorkflows()`

**Purpose:**

Load workflow options before any workspace is opened.

**State Transition Flow:**

1. Set `isLoadingWorkflows`.
2. Load workflow options.
3. Store `workflows` or `workspaceError`.

#### `openWorkflowWorkspace(workflowId)`

**Purpose:**

Open a workflow from the entry screen.

**State Transition Flow:**

1. Set `selectedWorkflowId`.
2. Set `isLoadingWorkspace`.
3. Load workflow summary and visible execution rows.
4. Populate the three board columns.
5. Clear stale selection and loading state.

#### `switchWorkflow(workflowId)`

**Purpose:**

Change workflow context from the header dropdown.

**State Transition Flow:**

1. Preserve page frame.
2. Replace `selectedWorkflowId`.
3. Reload workflow summary and board rows.
4. Clear prior selection and detail context tied to the old workflow.

#### `setExecutionConcurrency(config)`

**Purpose:**

Update workflow-wide concurrency controls.

**State Transition Flow:**

1. Validate the incoming configuration.
2. Update `maxConcurrentRequests` and `maxConcurrentExecutionRows`.

#### `toggleExecutionRowSelection(status, executionRowId, selected)`

**Purpose:**

Update one row's selection state inside a status column.

**State Transition Flow:**

1. Add or remove the row ID from `selectedRowIdsByColumn[status]`.
2. Recompute enabled bulk actions.

#### `selectAllRows(status)`

**Purpose:**

Toggle selection for all currently visible rows in one column.

**State Transition Flow:**

1. Read the visible row IDs for the target column.
2. If all are selected, clear that column selection.
3. Otherwise select all visible row IDs.
4. Recompute enabled bulk actions.

#### `queueSelectedRows()`

**Purpose:**

Queue the selected `Not Started` rows.

**State Transition Flow:**

1. Read selected IDs from the `not_started` column.
2. Set `isApplyingExecutionAction`.
3. Submit the queue action.
4. Move affected rows out of `Not Started` as updates arrive.
5. Clear completed selection and action state, or store `workspaceError` on failure.

#### `dequeueSelectedRows()`

**Purpose:**

Return selected `In Progress` rows to resumable pre-completion state.

**State Transition Flow:**

1. Read selected IDs from the `in_progress` column.
2. Set `isApplyingExecutionAction`.
3. Submit the dequeue action.
4. Move affected rows out of queued or running presentation as updates arrive.
5. Clear completed selection and action state, or store `workspaceError` on failure.

#### `retrySelectedRows()`

**Purpose:**

Retry selected `Completed` rows.

**State Transition Flow:**

1. Read selected IDs from the `completed` column.
2. Set `isApplyingExecutionAction`.
3. Submit the retry action.
4. Move affected rows back into the active execution flow as updates arrive.
5. Clear completed selection and action state, or store `workspaceError` on failure.

#### `applyExecutionRowEvent(event)`

**Purpose:**

Apply a lifecycle update to one visible execution row.

**State Transition Flow:**

1. Match the event to `execution_row_id`.
2. Patch only the affected row.
3. Re-sort the target column if the row changed status or active-running position.
4. Update any open row detail surface bound to the same row.

#### `clearWorkspaceSelection()`

**Purpose:**

Reset board selection when the current selection should no longer persist.

**State Transition Flow:**

1. Clear `selectedRowIdsByColumn`.
2. Recompute enabled bulk actions.

## `useExecutionRowDetail`

### Purpose

Owns inspection of one execution row, separating stable row metadata from step-scoped output detail and failure actions.

### State

| State | Type | Purpose |
|---|---|---|
| `selectedExecutionRowId` | `ID \| null` | Row currently being inspected. |
| `selectedExecutionRowSummary` | `ExecutionRowSummary \| null` | Row-level metadata that stays stable across workflow steps. |
| `selectedStepOutput` | `StepScopedOutput \| null` | Step-scoped success/error state, raw payload, and parsed payload. |
| `isLoadingDetail` | `boolean` | Detail-loading state. |
| `detailError` | `string \| null` | Detail-specific failure state. |

### Action Overview

| Action | Purpose |
|---|---|
| `openExecutionRowDetail(executionRowId)` | Open detail for one row. |
| `applyDetailEvent(event)` | Patch the open detail view from a matching row event. |
| `closeExecutionRowDetail()` | Close the detail surface. |

### Actions

#### `openExecutionRowDetail(executionRowId)`

**Purpose:**

Open the detail surface for one row.

**State Transition Flow:**

1. Set `selectedExecutionRowId`.
2. Set `isLoadingDetail`.
3. Load row summary and step-scoped output detail.
4. Store the result or `detailError`.

#### `applyDetailEvent(event)`

**Purpose:**

Keep the open detail surface synchronized with row lifecycle changes.

**State Transition Flow:**

1. Ignore events for other rows.
2. Patch stable row summary fields only when row-level metadata changes.
3. Patch `selectedStepOutput` when the active step outcome changes.

#### `closeExecutionRowDetail()`

**Purpose:**

Close the detail surface.

**State Transition Flow:**

1. Clear selected row detail state.

## `useExecutionRowFailureOverlay`

### Purpose

Owns the failure overlay triggered by worker `FAILED` events, keeping failure handling distinct from normal row inspection.

### State

| State | Type | Purpose |
|---|---|---|
| `failedExecutionRowId` | `ID \| null` | Row currently shown in the failure overlay. |
| `failedExecutionRowSummary` | `ExecutionRowSummary \| null` | Row metadata shown at the top of the overlay. |
| `failureMessage` | `string \| null` | Worker-provided error message. |
| `failureStepOutput` | `StepScopedOutput \| null` | Step-scoped output context revealed when detail is expanded. |
| `isFailureDetailExpanded` | `boolean` | Whether the collapsed detail section is open. |
| `isApplyingFailureAction` | `boolean` | In-flight state for acknowledge, retry, or abort. |

### Action Overview

| Action | Purpose |
|---|---|
| `openFailureOverlay(event)` | Open the failure overlay from a worker `FAILED` event. |
| `toggleFailureDetail()` | Expand or collapse the embedded detail section. |
| `acknowledgeFailure()` | Dismiss the failure overlay without retrying. |
| `retryFailedRow()` | Retry the failed row from the overlay. |
| `abortFailedRow()` | Abort the failed row from the overlay. |
| `closeFailureOverlay()` | Close the failure overlay. |

### Actions

#### `openFailureOverlay(event)`

**Purpose:**

Open failure handling for one execution row.

**State Transition Flow:**

1. Match the failure event to `execution_row_id`.
2. Store row metadata and `failureMessage`.
3. Seed collapsed step-scoped detail state.
4. Show the overlay.

#### `toggleFailureDetail()`

**Purpose:**

Reveal or hide expanded step-scoped detail inside the overlay.

**State Transition Flow:**

1. Toggle `isFailureDetailExpanded`.

#### `acknowledgeFailure()`

**Purpose:**

Dismiss the failure overlay without retrying or aborting.

**State Transition Flow:**

1. Clear failure-overlay state.

#### `retryFailedRow()`

**Purpose:**

Retry the failed row from the overlay.

**State Transition Flow:**

1. Validate that retry is available.
2. Set `isApplyingFailureAction`.
3. Submit retry for the failed row.
4. Clear overlay state or surface action failure.

#### `abortFailedRow()`

**Purpose:**

Abort the failed row from the overlay.

**State Transition Flow:**

1. Validate that abort is available.
2. Set `isApplyingFailureAction`.
3. Submit abort for the failed row.
4. Clear or refresh overlay state from the returned outcome.

#### `closeFailureOverlay()`

**Purpose:**

Close the failure overlay.

**State Transition Flow:**

1. Clear failure-overlay state.
# 6. Components

## WorkspacePageView

**Purpose**

Top-level workspace page composition. Chooses between workflow entry and active workspace, and mounts overlay surfaces above the page frame.

**UI Outline**

```text
[Workspace Entry]
  or
[Workspace Header]
[Execution Control Strip]
[Not Started] [In Progress] [Completed]
[Execution Row Detail Surface]
[Failure Overlay]
```

**UI**

- Preserves one page frame while workflow context changes.
- Treats the three-column execution board as the primary surface once a workflow is open.
- Layers detail and failure surfaces above the board rather than navigating away.

**Props**

| Prop | Description |
|---|---|
| `state` | Page-level workspace state. |
| `actions` | Page-level workspace and overlay actions. |

**Children**

- **WorkspaceEntryScreen** - Selects which workflow to open.
- **WorkspaceHeader** - Shows workflow context and switching.
- **ExecutionControlStrip** - Hosts concurrency and bulk actions.
- **ExecutionBoard** - Hosts the three status columns.
- **ExecutionRowDetailSurface** - Shows row inspection.
- **ExecutionRowFailureOverlay** - Handles failure interruption and actions.

## WorkspaceEntryScreen

**Purpose**

Collects workflow selection before the active execution workspace is shown.

**UI Outline**

```text
[Workspace Title]
[Workflow Selector]
[Open Workspace]
```

**UI**

- Minimal entry surface.
- Withholds execution content until a workflow is chosen.

**Props**

| Prop | Description |
|---|---|
| `workflows` | Available workflow options. |
| `selectedWorkflowId` | Pending workflow selection. |
| `loading` | Workflow-list loading state. |
| `error` | Entry-screen error state. |
| `onSelectWorkflow` | Updates pending workflow selection. |
| `onOpenWorkspace` | Opens the selected workflow. |

**Children**

- **Workflow Selector** - Chooses the workflow to open.
- **Open Action** - Enters the active workspace.

## WorkspaceHeader

**Purpose**

Shows active workflow identity and supports workflow switching without leaving the page.

**UI Outline**

```text
[Workspace Title] [Workflow Details] [Workflow Selector]
```

**UI**

- Keeps workflow identity compact and always visible.
- Gives workflow switching a page-level position rather than burying it inside the board.

**Props**

| Prop | Description |
|---|---|
| `workflow` | Active workflow summary. |
| `workflows` | Workflow options for switching. |
| `selectedWorkflowId` | Current workflow ID. |
| `onSelectWorkflow` | Switches workflow context. |

**Children**

- **Title Block** - Shows page title and workflow identity.
- **Workflow Details** - Shows sample-set and status context.
- **Workflow Selector** - Switches active workflow.

## ExecutionControlStrip

**Purpose**

Centralized control bar for workflow-wide execution settings and bulk row actions.

**UI Outline**

```text
[Max Requests] [Max Rows] [Queue] [Dequeue] [Retry] [Status Message]
```

**UI**

- One-line horizontal control strip above the board.
- Keeps execution actions shared and board-wide.
- Reflects current selection and action availability.

**Props**

| Prop | Description |
|---|---|
| `maxConcurrentRequests` | Current request concurrency value. |
| `maxConcurrentExecutionRows` | Current row concurrency value. |
| `enabledBulkActions` | Derived queue, dequeue, retry, acknowledge, and abort availability. |
| `liveRowUpdateStatus` | Event-stream connection state. |
| `actionStatus` | In-flight or completion feedback. |
| `onUpdateConcurrency` | Updates concurrency configuration. |
| `onQueueSelected` | Queues selected rows. |
| `onDequeueSelected` | Dequeues selected rows. |
| `onRetrySelected` | Retries selected rows. |

**Children**

- **Concurrency Controls** - Sets max requests and max rows.
- **Bulk Action Group** - Hosts queue, dequeue, and retry.
- **Status Message** - Shows action or live-update state.

## ExecutionBoard

**Purpose**

Primary execution workspace containing the three visible status columns.

**UI Outline**

```text
[Not Started Column] [In Progress Column] [Completed Column]
```

**UI**

- Reuses the familiar three-column shape.
- Uses columns for visible source execution rows only.
- Keeps the board stable while individual rows move or update.

**Props**

| Prop | Description |
|---|---|
| `notStartedRows` | Visible `not_started` rows. |
| `inProgressRows` | Visible `in_progress`, `queued`, and `running` rows. |
| `completedRows` | Visible `completed` rows. |
| `selectedRowIdsByColumn` | Column-scoped selection state. |
| `onToggleRowSelection` | Selects or unselects one row. |
| `onSelectAllRows` | Toggles all visible rows in a column. |
| `onOpenRow` | Opens row inspection. |

**Children**

- **NotStartedColumn** - Shows queueable rows.
- **InProgressColumn** - Shows queued and running work.
- **CompletedColumn** - Shows retryable finished rows.

## ExecutionStatusColumn

**Purpose**

Reusable column shell for one visible execution status lane.

**UI Outline**

```text
[Column Header]
[Select All]
[Execution Row Card...]
```

**UI**

- Shared column structure across all three lanes.
- Keeps header, selection control, and row stack visually consistent.

**Props**

| Prop | Description |
|---|---|
| `title` | Column label. |
| `rows` | Visible rows for the column. |
| `selectedRowIds` | Selected row IDs in the column. |
| `emptyMessage` | Empty-state message. |
| `onToggleRowSelection` | Toggles one row. |
| `onSelectAllRows` | Toggles all rows in the column. |
| `onOpenRow` | Opens row inspection. |

**Children**

- **Column Header** - Shows status label.
- **Select All Control** - Toggles visible row selection.
- **Row Stack** - Renders row cards in board order.

## ExecutionRowCard

**Purpose**

Compact execution-row summary surface used in all three columns.

**UI Outline**

```text
[sample_id] [scope]
[input blurb]
[status detail]
```

**UI**

- Always shows `sample_id`, execution scope, and truncated sample-scoped input context.
- Changes its status line by visible row sub-state.
- Uses yellow for `Queued` and orange for `Running`.
- Opens detail inspection from the card surface.

**Props**

| Prop | Description |
|---|---|
| `row` | Execution row summary data. |
| `selected` | Whether the row is selected. |
| `onToggleSelection` | Toggles row selection. |
| `onOpen` | Opens row detail. |

**Children**

- **Metadata Line** - Shows row identity.
- **Input Blurb** - Shows truncated sample-scoped input names.
- **Status Line** - Shows not-started, queued, running, or completed detail.

## ExecutionRowDetailSurface

**Purpose**

Read-oriented inspection surface for a user-selected execution row.

**UI Outline**

```text
[Execution Row Detail]
[Row Metadata]
[Step-Scoped Output]
  [Step Status Summary]
  [Raw Payload]
  [Parsed Payload]
```

**UI**

- Split into stable execution-row metadata and step-scoped output.
- Row metadata should focus on cross-step facts such as `execution_row_id`, `sample_id`, `execution_scope`, visible status, and last successful completion.
- Step-scoped output should identify the relevant step or node, then show step status, raw payload, and parsed payload as separate readable sections.
- Used for deliberate inspection, not interruption handling.

**Props**

| Prop | Description |
|---|---|
| `rowSummary` | Stable execution-row metadata. |
| `stepOutput` | Step-scoped success/error, raw payload, and parsed payload. |
| `loading` | Detail-loading state. |
| `error` | Detail-surface error state. |
| `onClose` | Closes the detail surface. |

**Children**

- **Row Metadata Panel** - Shows cross-step row facts.
- **Step Output Panel** - Shows step-scoped result detail.
- **Step Status Summary** - Shows step name and success, error, queued, or running state.
- **Raw Payload Panel** - Shows the assembled payload for the visible step attempt.
- **Parsed Payload Panel** - Shows parsed output or parse-failure context.

## ExecutionRowFailureOverlay

**Purpose**

Interruptive failure surface triggered by worker `FAILED` events.

**UI Outline**

```text
[Row Metadata]
[Error Message]
[Acknowledge] [Retry] [Abort] [Open Detail]
[Expanded Detail]
  [Step Status Summary]
  [Raw Payload]
  [Parsed Payload]
```

**UI**

- Opens automatically on failure.
- Prioritizes row metadata and error message before actions.
- Starts with detail collapsed and expands inline when requested.
- The expanded section should reuse the same step-scoped output structure as the normal detail surface.

**Props**

| Prop | Description |
|---|---|
| `rowSummary` | Failed execution-row metadata. |
| `errorMessage` | Worker-provided failure message. |
| `stepOutput` | Step-scoped detail shown when expanded. |
| `detailExpanded` | Whether embedded detail is expanded. |
| `actionState` | In-flight failure-action state. |
| `onToggleDetail` | Expands or collapses detail. |
| `onAcknowledge` | Dismisses the failure overlay. |
| `onRetry` | Retries the failed row. |
| `onAbort` | Aborts the failed row. |
| `onClose` | Closes the overlay. |

**Children**

- **Metadata Summary** - Shows failed row identity.
- **Error Message Block** - Shows failure text.
- **Failure Action Group** - Hosts acknowledge, retry, and abort.
- **Expandable Detail** - Starts collapsed and reveals step-scoped output detail inline.
- **Step Status Summary** - Shows the failed or last attempted step context.
- **Raw Payload Panel** - Shows the assembled payload for the failed attempt.
- **Parsed Payload Panel** - Shows parsed output or parse-failure context when available.
