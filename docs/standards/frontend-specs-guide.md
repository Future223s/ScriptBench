# Frontend Specification Template

## Purpose

The frontend specification defines the user-facing structure and behavior of a domain.

It describes:

1. **Layout** — how the page is visually organized.
2. **Regions** — what each area of the page represents.
3. **Interactions** — what users can do and what happens afterward.
4. **State** — the conditions the UI can exist in.
5. **Hooks** — the state and actions exposed to page consumers.
6. **Components** — the implementation mapping to frontend code.

The specification should describe the frontend experience independently of implementation details. Components and file paths are documented last as an implementation reference.

---

# 1. Layout

## Purpose

Defines the visual structure and hierarchy of the page.

Layout answers:

> "What does the user see, and how is the page arranged?"

Layout should describe:

- Major page sections
- Visual hierarchy
- Positioning relationships
- Page-level framing

Layout should **not** describe:

- React components
- Hooks
- API calls
- Business logic

---

## Fields

| Field       | Description                 |
| ----------- | --------------------------- |
| Name        | Name of the layout area     |
| Purpose     | Why this layout exists      |
| Structure   | Major visual sections       |
| Positioning | Location of visual sections |
| Behavior    | Layout-level behavior       |

---

## Example

```md
## Layout

### Dashboard Layout

Purpose:

Provides the primary dashboard workspace.

Structure:

- Application shell
  - Global navigation
  - Main content region

- Dashboard content
  - Left navigation rail
  - Right analytics workspace

Positioning:

- Two-column desktop layout. 
- Left navigation rail occupies approximately 25% width. 
- Right analytics workspace occupies remaining space.
  
Behavior:

- Analytics workspace is the primary visual focus.
- Navigation remains compact.
- Empty and loading states preserve the same page framing.

```

# 2. Regions

## Purpose

Defines the meaning and responsibility of each area of the page.

Regions answer:

> "What does each part of the interface represent?"

A region is a product concept, not a component.

A region may eventually be implemented by one or many components.

---

## Fields

| Field         | Description                      |
| ------------- | -------------------------------- |
| Name          | Region name                      |
| Purpose       | User-facing responsibility       |
| Contents      | Information displayed            |
| Behavior      | Region-specific behavior         |
| Empty State   | What happens when no data exists |
| Loading State | What happens while unavailable   |
## Example 

```
## Regions

### Sample Set Navigation

Purpose:

Allows users to browse and select available sample sets.

Contents:

- Sample set list
- Sample counts
- Workflow counts
- Selection indicator

Behavior:

- Selecting a sample set updates the active dashboard context.
- The selected sample set remains visually highlighted.

Empty State:

Display guidance directing users to create their first sample set.

Loading State:

Display placeholder rows while sample sets load.


---

### Analytics Workspace

Purpose:

Displays analytical information for the selected sample set.

Contents:

- Sample set summary
- Quality metrics
- Associated workflows
- Sample inventory

Behavior:

- Updates when the selected sample set changes.
- Maintains layout while data refreshes.
```

# 3. Interactions

## Purpose

Defines user actions and resulting behavior.

Interactions answer:

> "What can the user do, and what happens when they do it?"

Interactions describe user intent, not implementation.

Do not include:

- Hook names
- API endpoints
- Service calls

Those belong to the integration specification.

---

## Fields

| Field            | Description                    |
| ---------------- | ------------------------------ |
| Name             | User action                    |
| Trigger          | What initiates the action      |
| Flow             | Sequence of user-visible steps |
| Result           | Final UI outcome               |
| Failure Behavior | What happens if unsuccessful   |

---

## Example

```
## Interactions

### Select Sample Set

Trigger:

User selects a sample set from the navigation list.

Flow:

1. User clicks a sample set.
2. Selected state changes.
3. Analytics content refreshes.

Result:

- Selected sample set becomes active.
- Analytics workspace displays updated information.


---

### Delete Sample Set

Trigger:

User clicks delete on a sample set.

Flow:

1. Confirmation dialog appears.
2. User confirms deletion.
3. Sample set is removed.
4. Dashboard refreshes.

Result:

- Deleted sample set disappears.
- Selection updates if required.

Failure Behavior:

- Display deletion error.
- Preserve existing page state.
```


# 4. State

## Purpose

Defines the data and UI conditions that determine what the frontend displays.

State answers:

> "What information and conditions does the page need to render correctly?"

State should describe:

- Persistent page data
- User selections
- Async operation status
- Temporary UI controls

---

## Fields

| Field | Description |
|---|---|
| Name | State variable or state group |
| Type | Data type or conceptual type |
| Description | What the state represents |
| Source | Where the value originates |
| Consumers | Which regions use it |

---

## Example

```md
## State

### Dashboard Data

| State | Type | Description |
|---|---|---|
| sampleSets | SampleSet[] | Available sample sets |
| selectedSampleSetId | ID \| null | Currently active sample set |
| analytics | Analytics \| null | Analytics for selected sample set |

---

### Async State

| State | Type | Description |
|---|---|---|
| isLoadingDashboard | boolean | Initial dashboard loading status |
| isLoadingAnalytics | boolean | Analytics refresh status |
| error | Error \| null | Current page-level error |

---

### UI State

| State | Type | Description |
|---|---|---|
| deleteTarget | SampleSet \| null | Item currently awaiting deletion confirmation |
| activePanel | string | Currently expanded analytics section |

```

# 5. Hooks

## Purpose

Defines the behavioral model of frontend hooks by documenting the state they own, the operations they expose, and how those operations transform state over time.

A hook represents a behavioral unit of the frontend application. It coordinates user interactions, frontend state changes, and page workflows.

Hooks answer:

> "What behavior does this part of the application own, what operations can it perform, and how does each operation change its state?"

The hook specification focuses on:

- State ownership.
- Available actions.
- State transitions produced by those actions.

Actions are the primary behavioral unit. State exists to define the boundary of responsibility, while state transition flows describe how actions modify that state.

---
# Hooks Overview

Provides a high-level index of all hooks involved in the feature.

The overview should summarize:

- The behavioral units that make up the page.
- The responsibility of each hook.
- The boundary between different areas of frontend behavior.

## Fields

| Field   | Description                |
| ------- | -------------------------- |
| Hook    | Name of the hook           |
| Purpose | Responsibility of the hook |

---

## Hook Specification

Each hook should be documented independently.

A hook specification contains:

- Purpose
- State
- Action Overview
- Actions

---
### Purpose

Describes the responsibility and behavioral boundary of the hook.

The purpose should explain:

- What user workflow or capability the hook manages.
- What behavior belongs inside this hook.
- What behavior is intentionally outside its responsibility.

---
### State

Defines the state owned and managed by the hook.

State should make the ownership boundary explicit, especially when multiple hooks collaborate on the same page.

State may include:

- Domain data controlled by the hook.
- User selections.
- Temporary interaction state.
- Editing context.
- Loading, error, or feedback state owned by the hook.

#### Fields

|Field|Description|
|---|---|
|State|State value or state group owned by the hook|
|Type|Data type or conceptual shape|
|Purpose|What the state represents and why this hook owns it|

---
### Action Overview

Provides a high-level index of the hook's available actions.

The overview should summarize:

- Major operations supported by the hook.
- The purpose of each operation.
- The behavioral capabilities provided by the hook.

#### Fields

|Field|Description|
|---|---|
|Action|Hook action name|
|Purpose|Responsibility of the action|

---
### Actions

Actions define the primary behavioral units of the hook.

Actions should represent meaningful user capabilities or system operations.

Actions should be grouped by major responsibility.

Each action contains:

| Field                 | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| Name                  | Action exposed by the hook                                      |
| Purpose               | What the action accomplishes                                    |
| State Transition Flow | Ordered sequence describing how state changes during the action |

#### State Transition Flow

State transition flows describe the lifecycle of an action from trigger to completion.

They should capture:

- State updates.
- Validation steps.
- Temporary interaction state changes.
- External operations that influence state.
- Final resulting state.

State transitions should be written as ordered steps.
## Example

```
# 5. Hooks

## Hooks Overview

| Hook | Purpose |
|---|---|
| `useWorkflowBuilderPage` | Coordinates workflow identification, reusable step resources, DAG editing, and workflow persistence for the workflow builder page. |
| `useWorkflowBuilderCanvas` | Manages DAG interaction including node placement, selection, dependency editing, and canvas modes. |
| `useWorkflowStepCreationWizard` | Manages reusable workflow-step creation and resource selection flows. |

---

# Hook Specification

## `useWorkflowBuilderCanvas`

### Purpose

Owns workflow DAG editing behavior including node placement, dependency creation, node selection, and graph interaction modes.

The hook manages the canvas editing experience while leaving workflow persistence and reusable resource creation to separate behavioral units.

---

## State

| State | Type | Purpose |
|---|---|---|
| `nodes` | `WorkflowNode[]` | DAG nodes currently displayed and edited on the canvas. |
| `edges` | `WorkflowEdge[]` | Dependency edges currently displayed and edited on the canvas. |
| `canvasMode` | `CanvasMode \| null` | Current graph interaction mode. |
| `selectedNodeId` | `ID \| null` | Currently selected workflow DAG node. |
| `selectedEdgeId` | `ID \| null` | Currently selected dependency edge. |
| `placementTarget` | `Placement \| null` | Selected canvas location for creating a new workflow node. |

---

## Action Overview

| Action | Purpose |
|---|---|
| `enterAddWorkflowStepMode()` | Move the canvas into workflow-step placement mode. |
| `selectPlacementTarget(row, col)` | Select where the next workflow DAG node should be placed. |
| `confirmDependencyAddition()` | Create a dependency edge between selected workflow nodes. |
| `confirmWorkflowStepDeletion()` | Remove a workflow DAG node and its attached dependencies. |
| `cancelCanvasAction()` | Return the canvas to its neutral editing state. |

---

## Actions

### Graph Authoring Actions

#### `enterAddWorkflowStepMode()`

**Purpose:**

Move the canvas into workflow-step placement mode.

**State Transition Flow:**

1. Set the active canvas mode to add-step.
2. Clear conflicting node, edge, and dependency selections.
3. Enable valid placement targets for the current graph state.

---

#### `selectPlacementTarget(row, col)`

**Purpose:**

Choose where the next workflow DAG node should be placed.

**State Transition Flow:**

1. Store the selected placement location.
2. Open the workflow step assignment flow.
3. Preserve the current graph editing context.

---

#### `confirmDependencyAddition()`

**Purpose:**

Create a dependency edge between two workflow DAG nodes.

**State Transition Flow:**

1. Validate that source and target nodes are selected.
2. Reject invalid dependency relationships.
3. Create the dependency edge.
4. Clear temporary dependency selection state.
5. Return the canvas to normal editing mode.

---

#### `confirmWorkflowStepDeletion()`

**Purpose:**

Remove a workflow DAG node and its attached dependencies.

**State Transition Flow:**

1. Validate that a node is selected.
2. Remove the selected node.
3. Remove dependency edges connected to the node.
4. Clear node selection state.
5. Update the canvas with the remaining graph.

---

#### `cancelCanvasAction()`

**Purpose:**

Return the canvas to its neutral editing state.

**State Transition Flow:**

1. Clear active graph editing mode.
2. Clear temporary placement state.
3. Clear temporary node and edge selections.
4. Return the canvas to standard browsing mode.
```
# 6. Components

## Purpose

Defines the high-level frontend decomposition and visual realization of the page.

Components answer:

> "How is the user interface divided, and how should each part be visually constructed?"

This section translates regions into concrete UI units by defining:

- Component boundaries and decomposition
- Visual structure and hierarchy
- Component interfaces (props)
- Internal UI subdivisions

Only top-level components should receive full specifications. Child elements should be documented as subdivisions of their parent unless they represent a reusable or architecturally significant component.

The goals of this section are:

1. **Component Decomposition**
   - Define the major UI building blocks.
   - Establish ownership boundaries between components.
   - Identify which UI elements belong together.

2. **Visual Design**
   - Describe how the component should look and be arranged.
   - Capture hierarchy, emphasis, grouping, spacing philosophy, and layout relationships.
   - Provide an ASCII UI outline to communicate the intended composition.

3. **Component Interface**
   - Define the data and callbacks passed into the component.
   - Establish the contract between parent and child components.

---

## Fields

| Field | Description |
|---|---|
| Name | Top-level component name |
| Purpose | Responsibility of the component within the page |
| UI Outline | Character-based diagram showing the intended visual structure and hierarchy |
| UI | Detailed description of visual composition, layout, emphasis, grouping, and presentation behavior |
| Props | Data and callbacks required by the component |
| Children | Internal subdivisions of the component, described briefly |

## Example

```
## Components

### SampleSetAnalyticsPanel

**Purpose**

Displays analytics for the currently selected sample set.

---

**UI Outline**

```text
┌────────────────────────────────────────────┐
│ Sample Set Summary                         │
│ Name                                       │
│ 1,204 Samples • 5 Workflows                │
├────────────────────────────────────────────┤
│                                            │
│ Quality Metrics                            │
│ ┌─────┐ ┌─────┐ ┌───────────────────────┐  │
│ │ CER │ │ WER │ │ Hallucinations        │  │
│ └─────┘ └─────┘ └───────────────────────┘  │
│                                            │
├──────────────────────┬─────────────────────┤
│ Workflows            │ Samples             │
│ • Workflow A         │ • sample_001        │
│ • Workflow B         │ • sample_002        │
│ • Workflow C         │ • sample_003        │
└──────────────────────┴─────────────────────┘

---

**UI**

- Occupies the primary content area of the dashboard.
- Uses a top-to-bottom information hierarchy.
- Summary establishes context before any analytical information.
- Metrics receive the greatest visual emphasis after the summary.
- Workflows and samples are presented as secondary supporting sections.
- Major sections are visually separated using cards or spacing.
- Loading and empty states preserve the overall layout.

---

**Props**

| Prop | Description |
|------|-------------|
| analytics | Analytics for the selected sample set |
| loading | Analytics loading state |
| onDeleteWorkflow | Deletes a workflow |

---

**Children**

- **Summary Header** — Displays the selected sample set name and aggregate counts.
- **Metrics Section** — Presents quality metrics and summary statistics.
- **Workflow List** — Displays workflows associated with the sample set.
- **Sample Inventory** — Displays the samples belonging to the selected sample set.
```

# Specification Flow

The sections should form a dependency chain:

```
Layout
  ↓
Regions
  ↓
Interactions
  ↓
State
  ↓
Hooks
  ↓
Components
```

Meaning:

- **Layout** defines the page structure.
- **Regions** define the meaning of each area.
- **Interactions** define user behavior.
- **State** defines UI conditions.
- **Hooks** expose required state and actions.
- **Components** implement the experience.

This keeps the frontend specification stable even when the React implementation changes.