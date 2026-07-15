## Dashboard
### 1. Layout

**Structure:**

Page header
  - Title: `Sample Sets`

Sample set hero area
  - Horizontally scrollable sample set card strip
  - Each card summarizes one sample set

Analytics workspace
  - Detailed analytics for the selected sample set
  - Primary content area below the sample set strip

**Positioning:**

- The page is organized vertically from top to bottom.
- The sample set hero area sits near the top of the page and acts as the primary navigation surface.
- The analytics workspace occupies the lower portion of the page and takes up most of the remaining vertical space.
- The sample set strip should feel prominent but compact enough that analytics remains the main reading area.

**Behavior:**

- The dashboard should immediately communicate the current set of available sample sets.
- The sample set strip should support horizontal browsing without forcing the page into a tall list.
- The selected sample set determines which analytics content is shown below.
- The layout should preserve a clear hierarchy between selection at the top and analysis below.

### 2. Regions

#### Sample Set Hero

**Purpose:**

Lets the user quickly browse available sample sets and choose the active dashboard context.

**Contents:**

- Page title with sample sets count
- Horizontally scrollable row of sample set cards 
- Sample set summary on each containing the sample set's name, creation date, and short description, truncated when necessary

**Behavior:**

- The user can scroll horizontally through sample set cards.
- Selecting a sample set updates the active dashboard context.
- The active sample set should remain visually distinguishable from the rest.

**Empty State:**

- Show guidance that no sample sets are available yet.
- Direct the user toward creating or uploading sample data before returning to the dashboard.

**Loading State:**

- Show a compact placeholder version of the sample set strip while data loads.

#### Analytics Workspace

**Purpose:**

Displays detailed information for the selected sample set.

**Contents**: 

- Sample set summary
  - Shows the selected sample set name and the high-level counts that frame the dataset, including workflow, and samples. 
  - First thing the user should read 

- Metrics and quality indicators
  - Shows key quality metrics for the selected sample set, currently CER, WER, and Hallucinations.
  - Each metric is summarized with min, median, and max values so the user can scan performance at a glance.

- Related workflows
  - Shows the workflows attached to the selected sample set as a compact list of cards. Each workflow entry includes its name and short metadata, with deletion treated as a secondary action.

- Sample inventory
  - Shows the sample IDs attached to the selected sample set. This is a read-only inventory list that helps the user confirm what records are included in the current context.

┌───────────────────────────────────────┐
│ Sample Set Summary                     │
│ Name                                   │
│ 1,240 Samples | 4 Workflows            │
└───────────────────────────────────────┘


┌───────────────────────────────────────┐
│ Quality Overview                       │
│                                       │
│ CER        WER        Hallucinations   │
│  ↓          ↓              ↓            │
│ min med max min med max min med max   │
└───────────────────────────────────────┘


┌───────────────────┐  ┌─────────────────┐
│ Workflows         │  │ Samples         │
│                   │  │                 │
│ Workflow A        │  │ sample_001      │
│ Workflow B        │  │ sample_002      │
└───────────────────┘  └─────────────────┘

**Behavior:**

- Updates when the active sample set changes.
- Should feel like the main workspace of the page.
- Preserves the same overall frame while content refreshes.

**Empty State:**

- Prompt the user to select a sample set if none is active.
- If the selected sample set has no analytics yet, show a clear no-data message.

**Loading State:**

- Show analytics placeholders while the selected sample set data is being retrieved.
### 3. Interactions

#### Browse Sample Sets

Trigger:

User scrolls through the sample set hero strip.

Flow:

1. User moves horizontally through the sample set cards.
2. Additional sample sets become visible.

Result:

- The user can scan available sample sets without leaving the page.


#### Select Sample Set

Trigger:

User clicks a sample set card.

Flow:

1. The clicked sample set becomes active.
2. The selected state updates in the hero strip.
3. The analytics workspace refreshes to show the selected sample set.

Result:

- The dashboard context switches to the selected sample set.
- The analytics workspace shows the selected sample set’s details.


#### Review Sample Set Analytics

Trigger:

User views the analytics workspace after selecting a sample set.

Flow:

1. The page shows the sample set summary.
2. Metrics, workflows, and sample inventory are displayed below.

Result:

- The user can inspect the selected sample set at a glance.
- The dashboard presents analysis as the primary page content.


#### Delete Sample Set

Trigger:

User clicks delete on a sample set card.

Flow:

1. User confirms deletion.
2. Sample set is removed from the hero strip.
3. Selection updates if the deleted sample set was active.

Result:

- The deleted sample set no longer appears.
- The dashboard remains usable with the next available sample set, if any.


#### Delete Related Workflow

Trigger:

User clicks delete on a workflow in the analytics workspace.

Flow:

1. User confirms deletion.
2. Workflow is removed from the selected sample set’s workflow list.

Result:

- The workflow no longer appears in the analytics workspace.
- The sample set analytics update to reflect the change.


#### Start From Empty State

Trigger:

No sample sets exist yet.

Flow:

1. Dashboard shows onboarding guidance instead of analytics.
2. User follows the call to action to create or upload sample data.

Result:

- The user is directed toward File Management as the first step.
- The dashboard avoids showing an empty analytics surface.
### 4. State

### 4. State

#### Dashboard Data

| State | Type | Description |
|---|---|---|
| `sampleSets` | `SampleSet[]` | The sample sets available in the dashboard hero strip. |
| `selectedSampleSetId` | `ID \| null` | The currently active sample set shown in the analytics workspace. |
| `sampleSetAnalytics` | `SampleSetAnalytics \| null` | The analytics payload for the selected sample set. |

#### Async State

| State | Type | Description |
|---|---|---|
| `isLoadingDashboard` | `boolean` | Whether the dashboard is loading its initial sample set data. |
| `isLoadingAnalytics` | `boolean` | Whether analytics for the selected sample set are being refreshed. |
| `error` | `string \| null` | Page-level error state shown when dashboard or analytics data cannot load. |

#### UI State

| State                   | Type                | Description                                                                          |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| `hasSampleSets`         | `boolean`           | Whether the page should show the populated dashboard layout or the onboarding state. |
| `deleteTargetSampleSet` | `SampleSet \| null` | The sample set currently targeted for deletion.                                      |
| `deleteTargetWorkflow`  | `Workflow \| null`  | The workflow currently targeted for deletion from the analytics workspace.           |
| `activeSampleSetCard`   | `SampleSet \| null` | The sample set card currently highlighted in the hero strip.                         |

### 5. Hooks

## useDashboardPage

### State

| State | Description |
|---|---|
| `sampleSets` | Available sample sets displayed in the hero strip. |
| `selectedSampleSetId` | The currently active sample set. |
| `sampleSetAnalytics` | Analytics data for the selected sample set. |
| `loading` | Initial dashboard loading state. |
| `sampleSetAnalyticsLoading` | Analytics refresh state for the selected sample set. |
| `error` | Page-level dashboard error state. |
| `sampleSetAnalyticsError` | Error state specific to analytics loading. |
| `notice` | Success message shown after actions complete. |

---

### Actions

| Action | Purpose |
|---|---|
| `loadDashboard()` | Load available sample sets and initialize the dashboard. |
| `selectSampleSet(sampleSetId)` | Change the active sample set. |
| `refresh()` | Reload the dashboard and selected sample set analytics. |
| `removeSampleSet(sampleSetId)` | Delete a sample set after confirmation. |
| `removeWorkflow(workflowId, workflowLabel)` | Delete a workflow from the selected sample set after confirmation. |

---

### State Transitions

#### `loadDashboard()`

1. Set the dashboard loading state.
2. Retrieve available sample sets.
3. Store the returned sample sets.
4. Set an initial selected sample set if one is available.
5. Load analytics for the selected sample set if applicable.
6. Clear the loading state.

---

#### `selectSampleSet(sampleSetId)`

1. Update the selected sample set.
2. Set the analytics loading state.
3. Retrieve analytics for the selected sample set.
4. Store the returned analytics.
5. Clear the analytics loading state.

---

#### `refresh()`

1. Reload the dashboard sample sets.
2. Preserve the current selection if it still exists.
3. Reload analytics for the selected sample set if one is active.
4. Update the loading and error state as needed.

---

#### `removeSampleSet(sampleSetId)`

1. Confirm the delete action with the user.
2. Remove the sample set.
3. Refresh the dashboard data.
4. Clear or update selection if the deleted sample set was active.
5. Update success or error state.

---

#### `removeWorkflow(workflowId, workflowLabel)`

1. Confirm the delete action with the user.
2. Remove the workflow.
3. Refresh analytics for the current sample set.
4. Update success or error state.

---

### Notes

- The hook coordinates page-level dashboard behavior rather than individual component behavior.
- It acts as the behavioral contract between the dashboard UI and the integration layer.
- Selection changes and deletion actions should keep the page in a consistent state even when data changes underneath it.

### 6. Components

#### DashboardPage

**Purpose**

Provides the page-level frame for the dashboard and connects the dashboard hook state and actions to the sample set navigation and analytics components.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Sample Sets (N)                                                      │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Sample Set Hero                                                  │ │
│ │ [Set A — active] [Set B] [Set C] [Set D]  →                     │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Analytics Workspace                                              │ │
│ │                                                                  │ │
│ │ Selected Sample Set Summary                                      │ │
│ │ Quality Overview                                                 │ │
│ │ Workflows                              Samples                    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ [Page notice or error message, when present]                         │
└──────────────────────────────────────────────────────────────────────┘
```

---

**UI**

- Uses a vertical page composition with the sample set hero above the analytics workspace.
- Keeps the page title and sample set count visually associated with the hero area.
- Gives the analytics workspace most of the page width and vertical reading space.
- Preserves the overall page frame while initial data or analytics are loading.
- Replaces the populated layout with onboarding guidance when no sample sets exist.
- Displays page-level errors and success notices without obscuring the active dashboard context.
- Coordinates deletion confirmation surfaces for sample sets and related workflows.
- On smaller screens, preserves the vertical hierarchy and allows the hero strip and dense content sections to scroll without forcing the entire page into a wide fixed layout.

---

**Props**

The page component receives no domain props when used as the route-level dashboard entry point. It owns the `useDashboardPage` hook and derives child props from the hook state and actions.

| Prop | Description |
|---|---|
| None | Route-level component; dashboard data and actions are provided by `useDashboardPage`. |

---

**Children**

- **Dashboard Header** — Displays the page title and available sample set count.
- **SampleSetHero** — Displays and controls sample set browsing, selection, and sample set deletion.
- **SampleSetAnalyticsPanel** — Displays analytics for the active sample set and supports workflow deletion.
- **Dashboard Empty State** — Directs the user to create or upload sample data when no sample sets exist.
- **Confirmation Dialogs** — Confirm sample set or workflow deletion before invoking the corresponding action.

---

#### SampleSetHero

**Purpose**

Lets the user browse available sample sets, identify the active sample set, select a different dashboard context, and initiate sample set deletion.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Sample Sets (4)                                                      │
│                                                                      │
│  ◀  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────┐ │
│     │ Sample Set A       │ │ Sample Set B       │ │ Sample Set C   │ │
│     │ Created Jun 12     │ │ Created Jun 18     │ │ Created Jul 2  │ │
│     │ Short description  │ │ Short description  │ │ Description…   │ │
│     │                    │ │                    │ │                │ │
│     │ Active             │ │              [⋯]   │ │          [⋯]   │ │
│     └────────────────────┘ └────────────────────┘ └────────────────┘ │
│                                                               ▶      │
└──────────────────────────────────────────────────────────────────────┘
```

---

**UI**

- Appears near the top of the dashboard as a prominent but compact horizontal card strip.
- Presents each sample set as a consistently sized summary card containing its name, creation date, and truncated description.
- Uses a clear selected treatment such as stronger border emphasis, elevated surface treatment, or an active indicator.
- Supports horizontal scrolling through touch, trackpad, mouse wheel translation, or visible directional controls where needed.
- Keeps destructive actions visually secondary to selection.
- Uses the whole card as the primary selection target while preventing the delete control from also triggering selection.
- Keeps the active card visible after selection whenever practical.
- Shows compact skeleton cards during initial dashboard loading.
- When the collection is empty, the component is replaced by the dashboard onboarding state rather than an empty horizontal strip.

---

**Props**

| Prop | Type | Description |
|---|---|---|
| `sampleSets` | `SampleSet[]` | Sample sets available for browsing. |
| `selectedSampleSetId` | `ID \| null` | Identifier of the currently active sample set. |
| `loading` | `boolean` | Whether the initial sample set collection is loading. |
| `onSelectSampleSet` | `(sampleSetId: ID) => void` | Changes the active dashboard context. |
| `onDeleteSampleSet` | `(sampleSet: SampleSet) => void` | Opens or initiates confirmation for sample set deletion. |

---

**Children**

- **Hero Header** — Displays the `Sample Sets` title and collection count.
- **Horizontal Card Strip** — Provides the horizontal browsing surface.
- **Sample Set Card** — Displays one sample set summary and selected state.
- **Card Action Control** — Exposes sample set deletion as a secondary action.
- **Scroll Controls** — Provide directional navigation when overflow exists.
- **Loading Cards** — Preserve the strip shape while sample sets load.

---

#### SampleSetAnalyticsPanel

**Purpose**

Displays the primary analytical workspace for the currently selected sample set.

---

**UI Outline**

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Sample Set Summary                                                   │
│ Sample Set A                                                         │
│ 1,240 Samples • 4 Workflows                                          │
├──────────────────────────────────────────────────────────────────────┤
│ Quality Overview                                                     │
│                                                                      │
│ ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────────┐ │
│ │ CER              │ │ WER              │ │ Hallucinations         │ │
│ │ Min  Med  Max    │ │ Min  Med  Max    │ │ Min   Med   Max       │ │
│ │ .04  .08  .16    │ │ .09  .14  .25    │ │ 0     1     3         │ │
│ └──────────────────┘ └──────────────────┘ └────────────────────────┘ │
├─────────────────────────────────┬────────────────────────────────────┤
│ Related Workflows               │ Sample Inventory                   │
│                                 │                                    │
│ ┌─────────────────────────────┐ │ sample_001                         │
│ │ Workflow A         [Delete] │ │ sample_002                         │
│ │ Secondary metadata          │ │ sample_003                         │
│ └─────────────────────────────┘ │ sample_004                         │
│                                 │                                    │
└─────────────────────────────────┴────────────────────────────────────┘
```

---

**UI**

- Occupies the primary content area beneath the sample set hero.
- Uses a top-to-bottom information hierarchy: summary first, quality metrics second, supporting inventories last.
- Presents the selected sample set name and aggregate counts as the first readable context.
- Gives quality metrics the strongest visual emphasis after the summary.
- Displays CER, WER, and Hallucinations as parallel metric groups with consistently ordered minimum, median, and maximum values.
- Uses clear labels and aligned values so metrics remain scannable without relying on color alone.
- Places related workflows and sample inventory in a balanced two-column arrangement on wider screens.
- Stacks workflows above samples on narrower screens while preserving section order.
- Treats workflow deletion as a secondary action within each workflow entry.
- Presents sample IDs as a read-only inventory with internal scrolling or progressive disclosure when the list is long.
- Preserves section boundaries and approximate dimensions during analytics refreshes to avoid layout jumps.
- Shows a selection prompt when no sample set is active.
- Shows a clear no-data state when the selected sample set exists but analytics are unavailable.
- Displays analytics-specific errors within the workspace while preserving the selected sample set context.

---

**Props**

| Prop | Type | Description |
|---|---|---|
| `analytics` | `SampleSetAnalytics \| null` | Analytics payload for the active sample set. |
| `selectedSampleSet` | `SampleSet \| null` | Active sample set used for summary context. |
| `loading` | `boolean` | Whether analytics are being loaded or refreshed. |
| `error` | `string \| null` | Analytics-specific error message. |
| `onDeleteWorkflow` | `(workflow: Workflow) => void` | Opens or initiates confirmation for workflow deletion. |

---

**Children**

- **Sample Set Summary** — Displays the selected sample set name and aggregate sample and workflow counts.
- **Quality Overview** — Groups CER, WER, and Hallucination summaries.
- **Metric Summary** — Displays minimum, median, and maximum values for one metric.
- **Workflow List** — Displays workflows associated with the selected sample set.
- **Workflow Entry** — Displays workflow name, compact metadata, and a secondary delete action.
- **Sample Inventory** — Displays the read-only list of sample IDs.
- **Analytics Loading State** — Provides section-level placeholders during refresh.
- **Analytics Empty State** — Handles missing selection or unavailable analytics.
- **Analytics Error State** — Communicates analytics retrieval failure without replacing the entire dashboard.

---

#### ConfirmationDialog

**Purpose**

Provides a reusable confirmation surface for destructive dashboard actions while preserving the underlying page state.

---

**UI Outline**

```text
┌──────────────────────────────────────────────┐
│ Delete Sample Set?                           │
│                                              │
│ This action will remove “Sample Set A”.      │
│                                              │
│                         [Cancel] [Delete]     │
└──────────────────────────────────────────────┘
```

---

**UI**

- Appears above the dashboard as a focused modal or equivalent blocking confirmation surface.
- Clearly names the item and destructive action being confirmed.
- Uses a safe default focus target and keeps cancel visually available.
- Distinguishes the destructive confirmation action from the neutral cancel action.
- Prevents duplicate submission while deletion is in progress.
- Returns focus to the initiating control after cancellation or completion where possible.
- Does not clear the underlying dashboard selection until the confirmed action succeeds and refreshed state determines the next valid selection.

---

**Props**

| Prop | Type | Description |
|---|---|---|
| `open` | `boolean` | Whether the confirmation surface is visible. |
| `title` | `string` | Destructive action heading. |
| `description` | `string` | Explanation including the target item label. |
| `confirmLabel` | `string` | Label for the destructive confirmation action. |
| `loading` | `boolean` | Whether the confirmed action is in progress. |
| `onConfirm` | `() => void` | Executes the confirmed action. |
| `onCancel` | `() => void` | Closes the dialog without changing dashboard data. |

---

**Children**

- **Dialog Header** — States the destructive action.
- **Dialog Description** — Identifies the target and consequence.
- **Dialog Actions** — Provides cancel and destructive confirmation controls.
````