# File Management

The file management page is the catalog and upload workspace for samples, artifacts, and assets.

This spec follows the frontend specification template and treats the current React page as the evidence source for layout, regions, interactions, and component structure. State and hooks are documented with explicit support status so the current implementation gaps stay visible.

## Status Legend

- `complete` = present in the current page and aligned with the target behavior.
- `incomplete` = present, but still local-state driven, loosely modeled, or missing support that the endstate needs.
- `not present` = part of the target page contract, but absent from the current implementation.

## 1. Layout

### File Management Layout

**Purpose:**

Provides a single workspace for browsing, filtering, inspecting, uploading, and deleting file-backed records without leaving the page.

**Structure:**

- Page header
  - Title
  - Management mode switcher
  - Upload entry action
- Catalog workspace
  - Mode-specific filter and record browser
  - Selection and record actions
- Overlay layer
  - Record detail modal
  - Management modal
  - Upload modal

**Positioning:**

- The header spans the top of the page and anchors the page identity.
- The mode switcher sits in the header so the user can move between samples, artifacts, and assets without changing routes.
- The upload entry action stays visually prominent at the far right of the header.
- The catalog workspace occupies the main page body and reuses one shared browsing surface for all three record types.
- Overlay flows sit above the page frame rather than replacing it.

**Behavior:**

- The page preserves one stable shell while the current mode changes.
- The selected mode controls both the browser content and the default action semantics for that mode.
- Filtering, selection, detail inspection, and destructive actions all stay in-place.
- Loading should keep the page frame visible so the user retains orientation.

## 2. Regions

### File Management Header

**Purpose:**

Provides page identity, mode switching, and the entry point for upload flows.

**Contents:**

- Page title
- Mode switcher for `Samples`, `Artifacts`, and `Assets`
- `Upload files` button

**Behavior:**

- Switching mode changes the browser context below the header.
- The active mode remains visibly highlighted.
- The upload button opens the upload modal for the current page, not a separate route.

**Empty State:**

- No distinct empty state.

**Loading State:**

- The header remains visible while the catalog data loads.

### Record Browser

**Purpose:**

Displays the currently active record set with filters, summary actions, and selectable rows.

**Contents:**

- Mode-specific filters
- Result summary
- Record rows
- Apply, clear, and select-all actions

**Behavior:**

- The browser switches between sample, artifact, and asset perspectives using the same structural shell.
- The browser supports text search plus one or more mode-specific selectors.
- Visible rows are the source of truth for selection and bulk actions.

**Empty State:**

- Show an empty-state message when no visible records match the current filters.

**Loading State:**

- Keep the browser shell visible while data is loading.

### Record Detail Modal

**Purpose:**

Lets the user inspect one sample, artifact, or asset in detail without leaving the page.

**Contents:**

- Record title and type label
- Preview area
- Metadata grid
- Metadata block for all non-core fields
- Delete and close actions

**Behavior:**

- Opens from a record row.
- Uses the same detail shell for all three record types.
- Deletion from the detail modal is destructive and requires confirmation.

**Empty State:**

- Show a clear no-preview message when the record has no image preview.

**Loading State:**

- The current implementation does not expose a dedicated detail-loading state.

### Management Modal

**Purpose:**

Collects mode-specific create or delete intent for the current record type.

**Contents:**

- Mode title and summary
- Sample set or artifact group creation fields when relevant
- Delete-only handling for assets
- Cancel and confirm actions

**Behavior:**

- `Samples` mode creates sample sets.
- `Artifacts` mode creates artifact groups.
- `Assets` mode only supports deletion.
- The modal uses the current visible selection as the working set for destructive actions.

**Empty State:**

- Assets show a delete-only message instead of a create form.

**Loading State:**

- The current implementation does not expose a dedicated management-loading state.

### Upload Modal

**Purpose:**

Captures new samples, artifacts, or assets using single-file or folder upload flows.

**Contents:**

- Upload type switcher
- Upload mode switcher
- Mode-specific file fields
- Submit action

**Behavior:**

- The upload form changes shape by record type and by upload mode.
- Sample uploads support optional ground-truth text.
- Artifact uploads stay linked to one originating sample.
- Asset uploads remain lightweight and default to file-derived names when possible.

**Empty State:**

- The form falls back to guidance when the required source list, such as samples for artifact upload, is empty.

**Loading State:**

- The current implementation does not expose a dedicated upload-loading state.

## 3. Interactions

### Open File Management Page

**Trigger:**

User navigates to the file management page.

**Flow:**

1. Load samples, sample sets, artifacts, artifact groups, and assets.
2. Show the page shell.
3. Render the default record mode and browser content.

**Result:**

- The file management workspace becomes available with its current mode and record catalog.

**Failure Behavior:**

- Surface a page-level error while keeping the shell visible.

### Switch Management Mode

**Trigger:**

User clicks `Samples`, `Artifacts`, or `Assets` in the header.

**Flow:**

1. Update the active management mode.
2. Reset mode-specific selection and modal state as needed.
3. Recompute the browser filters and default action labels.

**Result:**

- The browser reorients to the chosen record type.

### Filter Records

**Trigger:**

User edits a search field or mode-specific filter control.

**Flow:**

1. Update the draft filter state.
2. Apply or clear the filter set.
3. Recompute the visible rows.

**Result:**

- The browser shows only matching records.

**Failure Behavior:**

- Preserve the current filters and show a page error only if the refresh or data load fails.

### Select Visible Records

**Trigger:**

User toggles one record row or chooses `Select all`.

**Flow:**

1. Update selection state for the current record type.
2. Preserve the active browser filters.
3. Keep the visible selection count in sync with the list.

**Result:**

- Bulk actions operate on the current visible selection.

### Open Record Detail

**Trigger:**

User opens a sample, artifact, or asset row.

**Flow:**

1. Request the full record by ID.
2. Open the detail modal.
3. Render the record preview and metadata.

**Result:**

- The user can inspect the record without leaving the page.

**Failure Behavior:**

- Surface the fetch error in the page notification state.

### Upload Files

**Trigger:**

User opens the upload modal and submits files.

**Flow:**

1. User chooses a record type.
2. User chooses single-file or folder mode.
3. User provides the required file inputs and optional labels.
4. The upload request is submitted.
5. The page refreshes the catalogs.

**Result:**

- The new records appear in the refreshed browser.

**Failure Behavior:**

- Keep the modal open and show the upload error.

### Create Sample Set

**Trigger:**

User chooses `Samples` mode in the management modal and confirms creation.

**Flow:**

1. Validate the sample set name.
2. Resolve the selected or visible sample IDs.
3. Submit the sample set creation request.
4. Refresh the sample and sample-set catalogs.

**Result:**

- A new sample set is created from the selected samples.

**Failure Behavior:**

- Preserve the current selection and show the validation or persistence error.

### Create Artifact Group

**Trigger:**

User chooses `Artifacts` mode in the management modal and confirms creation.

**Flow:**

1. Validate the artifact group name.
2. Resolve the selected or visible artifact IDs.
3. Submit the artifact-group creation request.
4. Refresh the artifact and artifact-group catalogs.

**Result:**

- A new artifact group is created from the selected artifacts.

**Failure Behavior:**

- Preserve the current selection and show the validation or persistence error.

### Delete Selected Records

**Trigger:**

User confirms deletion from the management modal or from record detail.

**Flow:**

1. Confirm the destructive action.
2. Delete the selected record or records.
3. Clear the matching selection state.
4. Refresh the catalogs.

**Result:**

- The deleted records disappear from the browser after refresh.

**Failure Behavior:**

- Keep the selection intact and show the delete error.

### Refresh Catalogs

**Trigger:**

User triggers refresh or the page refreshes after a mutation.

**Flow:**

1. Reload all catalog collections.
2. Rebuild the current browser view.
3. Preserve the active mode and the current selection where possible.

**Result:**

- The page shows the latest catalog state.

## 4. State

### Legend

- `complete` = present and working in the current page.
- `incomplete` = present, but still broad, local-only, or missing the stronger contract shape implied by the persistence model.
- `not present` = needed by the target endstate, but absent from the current implementation.

### Catalog State

| State | Type | Status | Description | Source | Consumers |
|---|---|---|---|---|---|
| `samples` | `Sample[]` | complete | Loaded sample records shown in `Samples` mode. | `getSamples()` | Browser, sample-set creation, artifact upload |
| `sampleSets` | `SampleSetSummary[]` | complete | Loaded sample sets used for browsing and grouping. | `getSampleSets()` | Browser, sample-set creation, detail views |
| `artifacts` | `Artifact[]` | complete | Loaded artifact records shown in `Artifacts` mode. | `getArtifacts()` | Browser, artifact-group creation, detail views |
| `artifactGroups` | `ArtifactGroup[]` | complete | Loaded artifact groups used for browsing and grouping. | `getArtifactGroups()` | Browser, artifact-group creation, detail views |
| `assets` | `Asset[]` | complete | Loaded asset records shown in `Assets` mode. | `getAssets()` | Browser, asset upload, detail views |

### Mode And Selection State

| State | Type | Status | Description | Source | Consumers |
|---|---|---|---|---|---|
| `managementType` | `"sample" \| "artifact" \| "asset"` | complete | Active browser mode for the page. | Header toggle | Header, browser, overlays |
| `managementAction` | `string` | incomplete | Derived default action for the current mode, but still a UI proxy rather than a normalized domain action model. | Local derivation | Management modal |
| `uploadType` | `"sample" \| "artifact" \| "asset"` | complete | Current upload record type. | Upload modal toggle | Upload modal |
| `uploadMode` | `"single" \| "folder"` | complete | Current upload input mode. | Upload modal toggle | Upload modal |
| `selections.sample` | `string[]` | complete | Selected sample IDs in the current browser mode. | Row selection | Browser, sample-set creation, delete flow |
| `selections.artifact` | `string[]` | complete | Selected artifact IDs in the current browser mode. | Row selection | Browser, artifact-group creation, delete flow |
| `selections.asset` | `string[]` | complete | Selected asset IDs in the current browser mode. | Row selection | Browser, delete flow |
| `filters.sample` | `object` | incomplete | Draft sample filters, including text query and sample-set filter, but still local-only and not normalized into a reusable query model. | Filter controls | Sample browser |
| `appliedFilters.sample` | `object` | incomplete | Committed sample filters used to render visible rows. | Apply filter action | Sample browser |
| `filters.artifact` | `object` | incomplete | Draft artifact filters, including artifact group and category controls. | Filter controls | Artifact browser |
| `appliedFilters.artifact` | `object` | incomplete | Committed artifact filters used to render visible rows. | Apply filter action | Artifact browser |
| `filters.asset` | `object` | incomplete | Draft asset filters. | Filter controls | Asset browser |
| `appliedFilters.asset` | `object` | incomplete | Committed asset filters used to render visible rows. | Apply filter action | Asset browser |
| `drafts.sample_set_name` | `string` | complete | Sample-set creation name field. | Management modal | Sample-set creation |
| `drafts.sample_set_description` | `string` | complete | Sample-set creation description field. | Management modal | Sample-set creation |
| `drafts.artifact_group_name` | `string` | complete | Artifact-group creation name field. | Management modal | Artifact-group creation |
| `drafts.artifact_group_description` | `string` | complete | Artifact-group creation description field. | Management modal | Artifact-group creation |
| `uploadDraft` | `object` | incomplete | In-progress upload payload for the active flow, but the current page still reads most upload values directly from uncontrolled refs instead of hook-owned state. | Upload field changes | Upload modal |

### Overlay And Async State

| State                 | Type                                        | Status     | Description                                                                         | Source                       | Consumers            |
| --------------------- | ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- | ---------------------------- | -------------------- |
| `catalogLoading`      | `Record<"sample" \| "sampleSet" \| "artifact" \| "artifactGroup" \| "asset", boolean>` | complete | Independent loading flags for each catalog request so one slow or failed collection does not block unrelated page regions. | Initial load and refresh | Page shell, browser, filters |
| `catalogErrors`       | `Partial<Record<"sample" \| "sampleSet" \| "artifact" \| "artifactGroup" \| "asset", string>>` | complete | Independent catalog errors displayed near the affected data surface while other successful catalogs remain usable. | Failed catalog requests | Page shell, browser, filters |
| `createSampleSetLoading` | `boolean` | complete | Whether sample-set creation is in flight. | Sample-set creation | Management modal |
| `createSampleSetError` | `string \| null` | complete | Error specific to sample-set creation. | Failed sample-set creation | Management modal |
| `createArtifactGroupLoading` | `boolean` | complete | Whether artifact-group creation is in flight. | Artifact-group creation | Management modal |
| `createArtifactGroupError` | `string \| null` | complete | Error specific to artifact-group creation. | Failed artifact-group creation | Management modal |
| `deleteLoadingByType` | `Record<"sample" \| "artifact" \| "asset", boolean>` | complete | Independent deletion progress by record type. | Delete actions | Browser, detail modal, management modal |
| `deleteErrorsByType` | `Partial<Record<"sample" \| "artifact" \| "asset", string>>` | complete | Independent deletion errors by record type. | Failed delete actions | Browser, detail modal, management modal |
| `uploadLoading` | `boolean` | complete | Whether a single-file upload or repeated folder-upload sequence is active. | Upload submission | Upload modal |
| `uploadError` | `string \| null` | complete | Upload-level failure message, including partial-failure summaries for folder uploads. | Failed upload requests | Upload modal |
| `detailLoading` | `boolean` | complete | Whether the selected record detail is being fetched. | Detail fetch | Detail modal |
| `detailError` | `string \| null` | complete | Error specific to loading the selected record detail. | Failed detail fetch | Detail modal |
| `notice`              | `string`                                    | complete   | Shared success and informational message surfaced through notifications.            | Successful operations        | Page shell, overlays |
| `detailOpen`          | `boolean`                                   | complete   | Whether the record detail modal is open.                                            | Open record action           | Detail modal         |
| `detailType`          | `"sample" \| "artifact" \| "asset" \| null` | complete   | Current detail record type.                                                         | Open record action           | Detail modal         |
| `selectedRecord`      | `Sample \| Artifact \| Asset \| null`       | incomplete | Full record object for detail inspection, but not a discriminated typed view model. | Detail fetch                 | Detail modal         |
| `managementModalOpen` | `boolean`                                   | complete   | Whether the management modal is open.                                               | Header action or page action | Management modal     |
| `uploadPanelOpen`     | `boolean`                                   | complete   | Whether the upload modal is open.                                                   | Header action                | Upload modal         |

### Missing Endstate Support

| State                     | Type                                                 | Status      | Description                                                                                   |
| ------------------------- | ---------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `folderUploadProgress` | `{ totalFiles: number; completedFiles: number; failedFiles: number; currentFile: string \| null }` | not present | Folder upload repeats the same single-record endpoint once per file, but the hook still needs aggregate progress and partial-failure reporting across the sequence. |
| `selectionSummary`        | `Record<"sample" \| "artifact" \| "asset", number>`  | not present | The page does not keep a first-class selection summary; counts are derived ad hoc.            |
| `normalizedRecordPreview` | `RecordViewModel`                                    | not present | The page does not normalize samples, artifacts, and assets into one shared detail view model with `name`, `type`, `blob`, `mimeType`, `blobSize`, and `metadata` fields. |
| `uploadDraftByType`       | `Record<"sample" \| "artifact" \| "asset", UploadDraft>` | not present | The page does not keep first-class upload payload drafts per upload type, so text and select inputs are not preserved as hook-owned state. |
| `uploadFieldActions`      | `setUploadField()` / `setUploadFiles()`              | not present | The page does not expose field-level upload setters, so the upload contract cannot model incremental user input yet. |

## 5. Hooks

### Hooks Overview

| Hook                                                    | Purpose                                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFileManagementPage` `(present, incomplete)`         | Orchestrates the page by composing the browsing, selection-and-management, upload, and detail hooks, handling catalog refresh and shared notifications without owning their local behavior directly. |
| `useFileBrowser` `(present, incomplete)`                | Owns active browsing behavior: management mode, draft filters, applied filters, and the visible record set.                                                                                          |
| `useFileSelectionAndManagement` `(present, incomplete)` | Owns selection state plus the management modal workflow, including drafts and create/delete actions.                                                                                                 |
| `useFileUpload` `(present, incomplete)`                 | Owns the upload workflow end to end, including upload modal state, upload type and mode, draft payload, and submission.                                                                              |
| `useFileDetail` `(present, incomplete)`                 | Owns record inspection state and the detail fetch lifecycle.                                                                                                                                         |


## `useFileManagementPage` `(present, incomplete)`

### Purpose

Orchestrates the file management page by composing the four behavior hooks and exposing one page-facing API to the view layer.

This hook is the active behavioral unit used by the page today.

It should own per-catalog loading and error state, cross-hook coordination, refresh-after-mutation behavior, and notification syncing.

It should not own filter math, upload draft state, detail-fetch behavior, or management-draft logic directly.

### State

| State | Type | Purpose |
|---|---|---|
| `catalogLoading` | `Record<"sample" \| "sampleSet" \| "artifact" \| "artifactGroup" \| "asset", boolean>` | Tracks each catalog request independently so successful data can remain available while another catalog loads. |
| `catalogErrors` | `Partial<Record<"sample" \| "sampleSet" \| "artifact" \| "artifactGroup" \| "asset", string>>` | Stores request-specific catalog failures without overwriting errors from other operations. |
| `notice` | `string` | Stores shared success and informational feedback surfaced through notifications. |
| `samples` | `Sample[]` | Stores the sample catalog used by browsing, detail, sample-set creation, and artifact-upload context. |
| `sampleSets` | `SampleSetSummary[]` | Stores sample-set summaries used by filtering and grouping. |
| `artifacts` | `Artifact[]` | Stores the artifact catalog used by browsing, detail, and artifact-group creation. |
| `artifactGroups` | `ArtifactGroup[]` | Stores artifact-group summaries used by filtering and grouping. |
| `assets` | `Asset[]` | Stores the asset catalog used by browsing, detail, and asset upload refresh. |
| `browser` | `UseFileBrowserState` | Exposes the composed browsing state from `useFileBrowser`. |
| `selectionAndManagement` | `UseFileSelectionAndManagementState` | Exposes the composed selection and management state from `useFileSelectionAndManagement`. |
| `upload` | `UseFileUploadState` | Exposes the composed upload state from `useFileUpload`. |
| `detail` | `UseFileDetailState` | Exposes the composed detail state from `useFileDetail`. |

### Action Overview

| Action | Purpose |
|---|---|
| `refresh()` `(present)` | Reload all catalog collections and rebuild the current browser view. |
| `browserActions` `(present, incomplete)` | Exposes the browsing actions from `useFileBrowser` through the page-facing API. |
| `selectionAndManagementActions` `(present, incomplete)` | Exposes the selection and management actions from `useFileSelectionAndManagement`. |
| `uploadActions` `(present, incomplete)` | Exposes the upload actions from `useFileUpload`. |
| `detailActions` `(present, incomplete)` | Exposes the detail actions from `useFileDetail`. |

### Actions

### Catalog Actions

#### `refresh()` `(present)`

**Purpose:**

Reload all catalog collections and rebuild the current browser view.

**State Transition Flow:**

1. Set the loading boolean for each requested catalog.
2. Request samples, sample sets, artifacts, artifact groups, and assets in parallel.
3. Replace each catalog independently as its request succeeds.
4. Store any failure in the matching catalog error field without discarding successful results.
5. Clear each catalog loading boolean when its request settles.

### Composition Actions

#### `browserActions` `(present, incomplete)`

**Purpose:**

Delegate browsing behavior to `useFileBrowser` while keeping a single page-facing API.

**State Transition Flow:**

1. Forward mode and filter actions to the browser hook.
2. Preserve shared catalog state outside the browser hook.
3. Close conflicting overlays when the page-level orchestration requires it.

#### `selectionAndManagementActions` `(present, incomplete)`

**Purpose:**

Delegate selection and management behavior to `useFileSelectionAndManagement`.

**State Transition Flow:**

1. Forward selection and management actions to the selection-and-management hook.
2. Trigger shared refresh behavior after successful create or delete actions.
3. Preserve shared notifications while each composed hook owns operation-specific loading and error state.

#### `uploadActions` `(present, incomplete)`

**Purpose:**

Delegate the upload workflow to `useFileUpload`.

**State Transition Flow:**

1. Forward upload field and modal actions to the upload hook.
2. Trigger shared refresh behavior after successful upload.
3. Preserve shared notifications while each composed hook owns operation-specific loading and error state.

#### `detailActions` `(present, incomplete)`

**Purpose:**

Delegate record inspection behavior to `useFileDetail`.

**State Transition Flow:**

1. Forward detail open and close actions to the detail hook.
2. Preserve shared error and notification handling at the page level.
3. Close detail state when destructive page actions invalidate it.

## `useFileBrowser` `(present, incomplete)`

### Purpose

Owns the active browsing behavior for the page: management mode, draft filters, applied filters, and the visible record set.

### State

| State | Type | Purpose |
|---|---|---|
| `managementType` | `"sample" \| "artifact" \| "asset"` | Stores the active browser mode. |
| `managementAction` | `string` | Stores the default management action key associated with the active mode. Incomplete because it remains a loose string rather than a narrower action model. |
| `filters` | `Record<"sample" \| "artifact" \| "asset", object>` | Stores draft filter values for each record type. |
| `appliedFilters` | `Record<"sample" \| "artifact" \| "asset", object>` | Stores committed filter values used to render records. |
| `visibleRecords` | `Sample[] \| Artifact[] \| Asset[]` | Stores the currently visible records derived from the active mode and applied filters. |

### Action Overview

| Action | Purpose |
|---|---|
| `setManagementType(managementType)` `(present)` | Switch the active browser mode. |
| `setFilterField(type, field, value)` `(present)` | Update one draft filter value. |
| `clearFilters(type)` `(present)` | Reset one mode's filters. |
| `applyFilters()` `(present)` | Commit the draft filters. |

### Actions

#### `setManagementType(managementType)` `(present)`

**Purpose:**

Switch the active browser mode.

**State Transition Flow:**

1. Normalize the requested mode.
2. Store the new active browser mode.
3. Update the default management action that corresponds to the new mode.

#### `setFilterField(type, field, value)` `(present)`

**Purpose:**

Update one draft filter value.

**State Transition Flow:**

1. Resolve the requested record type.
2. Update the chosen draft filter field.
3. Preserve the other modes' filter state.

#### `clearFilters(type)` `(present)`

**Purpose:**

Reset one mode's filters.

**State Transition Flow:**

1. Resolve the requested record type.
2. Restore that mode's defaults.
3. Leave the other modes unchanged.

#### `applyFilters()` `(present)`

**Purpose:**

Commit draft filters to the visible record query.

**State Transition Flow:**

1. Copy draft filters into the applied filter set.
2. Recompute the visible records.

## `useFileSelectionAndManagement` `(present, incomplete)`

### Purpose

Owns selection state plus the management modal workflow, because those two behaviors are tightly coupled in this page.

### State

| State | Type | Purpose |
|---|---|---|
| `selections` | `Record<"sample" \| "artifact" \| "asset", string[]>` | Stores the selected record IDs for each record type. |
| `managementModalOpen` | `boolean` | Tracks whether the management modal is open. |
| `drafts` | `object` | Stores the current sample-set and artifact-group draft fields used by the management modal. |
| `createSampleSetLoading` | `boolean` | Tracks sample-set creation without blocking unrelated management actions. |
| `createSampleSetError` | `string \| null` | Stores only the latest sample-set creation failure. |
| `createArtifactGroupLoading` | `boolean` | Tracks artifact-group creation without blocking unrelated management actions. |
| `createArtifactGroupError` | `string \| null` | Stores only the latest artifact-group creation failure. |
| `deleteLoadingByType` | `Record<"sample" \| "artifact" \| "asset", boolean>` | Tracks deletion progress independently for each record type. |
| `deleteErrorsByType` | `Partial<Record<"sample" \| "artifact" \| "asset", string>>` | Stores deletion failures by record type so one failure does not replace another. |

### Action Overview

| Action | Purpose |
|---|---|
| `toggleSelection(type, recordId, shouldInclude)` `(present)` | Add or remove one record from the active selection bucket. |
| `selectAllVisible()` `(present)` | Select every currently visible record in the active browser mode. |
| `clearSelection(type)` `(present)` | Clear the selected IDs for one record type. |
| `setDraftField(field, value)` `(present)` | Update one sample-set or artifact-group draft field. |
| `openManagementModal()` `(present)` | Open the management modal. |
| `closeManagementModal()` `(present)` | Close the management modal. |
| `submitManagement(actionOverride)` `(present, incomplete)` | Create a sample set, create an artifact group, or delete selected records. |
| `deleteRecord(type, recordId)` `(present, incomplete)` | Delete one record with confirmation. |

### Actions

#### `toggleSelection(type, recordId, shouldInclude)` `(present)`

**Purpose:**

Add or remove one record from the active selection bucket.

**State Transition Flow:**

1. Resolve the requested record type and record ID.
2. Add the ID when selection is requested and it is not already selected.
3. Remove the ID when deselection is requested and it is currently selected.

#### `selectAllVisible()` `(present)`

**Purpose:**

Select every currently visible record in the active browser mode.

**State Transition Flow:**

1. Resolve the current management type.
2. Derive the visible rows for that mode from the browser hook.
3. Replace the selection bucket with the visible record IDs.

#### `clearSelection(type)` `(present)`

**Purpose:**

Clear the selected IDs for one record type.

**State Transition Flow:**

1. Resolve the requested record type.
2. Replace that selection bucket with an empty list.

#### `setDraftField(field, value)` `(present)`

**Purpose:**

Update one sample-set or artifact-group draft field.

**State Transition Flow:**

1. Resolve the requested draft field.
2. Store the new draft value.
3. Preserve the rest of the management draft state.

#### `openManagementModal()` `(present)`

**Purpose:**

Open the management modal.

**State Transition Flow:**

1. Open the management modal.
2. Preserve the active selection and current management drafts.

#### `closeManagementModal()` `(present)`

**Purpose:**

Close the management modal.

**State Transition Flow:**

1. Close the management modal.
2. Preserve the current selection and draft state.

#### `submitManagement(actionOverride)` `(present, incomplete)`

**Purpose:**

Create a sample set, create an artifact group, or delete selected records.

**State Transition Flow:**

1. Resolve the active mode and action.
2. Validate the required draft inputs or current selection.
3. Set the loading boolean and clear the error for the resolved operation.
4. Submit the create or delete request.
5. On success, clear the relevant draft or selection state and trigger page refresh.
6. On failure, store the error in the matching operation-specific field.
7. Clear the operation's loading boolean when the request settles.

#### `deleteRecord(type, recordId)` `(present, incomplete)`

**Purpose:**

Delete one record with confirmation.

**State Transition Flow:**

1. Resolve the requested record type and record ID.
2. Confirm the destructive action.
3. Set the matching record type's delete loading boolean and clear its delete error.
4. Submit the type-specific delete request.
5. On success, clear the matching selection bucket and trigger page refresh.
6. On failure, store the error for that record type.
7. Clear the matching delete loading boolean when the request settles.

## `useFileUpload` `(present, incomplete)`

### Purpose

Owns the upload workflow end to end, including upload modal state, upload type and mode, draft payload, and submission.

### State

| State | Type | Purpose |
|---|---|---|
| `uploadPanelOpen` | `boolean` | Tracks whether the upload modal is open. |
| `uploadType` | `"sample" \| "artifact" \| "asset"` | Stores the active upload record type. |
| `uploadMode` | `"single" \| "folder"` | Stores the active upload input mode. |
| `uploadDraft` | `UploadDraft` | Stores the current upload payload, including text, select, and file-or-folder inputs for the active upload flow. |
| `uploadLoading` | `boolean` | Tracks a single upload request or the full repeated-request folder upload sequence. |
| `uploadError` | `string \| null` | Stores upload failures without overwriting catalog, detail, create, or delete errors. |
| `folderUploadProgress` | `{ totalFiles: number; completedFiles: number; failedFiles: number; currentFile: string \| null }` | Communicates progress while folder mode calls the same single-record endpoint once per file. |

### Action Overview

| Action | Purpose |
|---|---|
| `openUploadPanel()` `(present)` | Open the upload modal. |
| `closeUploadPanel()` `(present)` | Close the upload modal. |
| `setUploadType(uploadType)` `(present)` | Switch the upload record type. |
| `setUploadMode(uploadMode)` `(present)` | Switch the upload input mode. |
| `setUploadField(field, value)` `(present)` | Update one text or select field in the upload draft. |
| `setUploadFiles(field, files)` `(present)` | Update one file or folder field in the upload draft. |
| `submitUpload()` `(present, incomplete)` | Submit the upload request. |

### Actions

#### `openUploadPanel()` `(present)`

**Purpose:**

Open the upload modal.

**State Transition Flow:**

1. Open the upload modal.
2. Preserve the active upload draft, type, and mode.

#### `closeUploadPanel()` `(present)`

**Purpose:**

Close the upload modal.

**State Transition Flow:**

1. Close the upload modal.
2. Preserve the current upload draft unless a successful submission clears it.

#### `setUploadType(uploadType)` `(present)`

**Purpose:**

Switch the upload record type.

**State Transition Flow:**

1. Normalize the requested upload type.
2. Update the active form layout.
3. Preserve the existing draft state for that type where possible.

#### `setUploadMode(uploadMode)` `(present)`

**Purpose:**

Switch the upload input mode.

**State Transition Flow:**

1. Normalize the requested upload mode.
2. Swap between single-file and folder inputs.
3. Preserve the active record type.

#### `setUploadField(field, value)` `(present)`

**Purpose:**

Update one text or select field in the upload draft.

**State Transition Flow:**

1. Resolve the active upload type.
2. Store the new field value in that type's upload draft.
3. Preserve the rest of the draft payload.

#### `setUploadFiles(field, files)` `(present)`

**Purpose:**

Update one file or folder field in the upload draft.

**State Transition Flow:**

1. Resolve the active upload type.
2. Store the selected file or folder payload.
3. Preserve the active text and select fields.

#### `submitUpload()` `(present, incomplete)`

**Purpose:**

Submit the upload request.

**State Transition Flow:**

1. Read the current upload draft for the active upload type and mode.
2. Validate the required inputs for the active upload type.
3. Set `uploadLoading`, clear `uploadError`, and initialize folder progress when applicable.
4. In single mode, submit one request. In folder mode, call the same single-record endpoint once per file and update completed, failed, and current-file progress after each request.
5. Preserve a partial-failure summary when some files fail instead of discarding successful uploads.
6. Clear the upload draft after a fully successful submission, or preserve enough state to retry failed files.
7. Trigger page refresh after successful uploads and clear `uploadLoading` when the sequence settles.

## `useFileDetail` `(present, incomplete)`

### Purpose

Owns the lifecycle for opening, loading, and closing one record detail view.

### State

| State | Type | Purpose |
|---|---|---|
| `detailOpen` | `boolean` | Would track whether the detail modal is visible. |
| `detailType` | `"sample" \| "artifact" \| "asset" \| null` | Would track which record type is being inspected. |
| `selectedRecord` | `RecordViewModel \| null` | Would store the shared normalized preview model for the open record. |
| `detailLoading` | `boolean` | Tracks in-flight state while fetching the detail record. |
| `detailError` | `string \| null` | Stores only the failure for the active detail request so the modal can report it in place. |

### Action Overview

| Action | Purpose |
|---|---|
| `openRecord(type, recordId)` `(present, incomplete)` | Load and open one record. |
| `closeRecordDetail()` `(present)` | Close the detail modal. |

### Actions

#### `openRecord(type, recordId)` `(present, incomplete)`

**Purpose:**

Load and open one record.

**State Transition Flow:**

1. Resolve the requested record type and ID.
2. Set `detailLoading` and clear `detailError`.
3. Fetch the full record payload.
4. Normalize the preview model and open the detail modal on success.
5. Store failures in `detailError` while keeping the surrounding page usable.
6. Clear `detailLoading` when the request settles.

#### `closeRecordDetail()` `(present)`

**Purpose:**

Close the detail modal.

**State Transition Flow:**

1. Clear the selected detail record.
2. Close the modal.

## 6. Components

### FileManagementPageView

**Status:** complete

**Purpose**

Top-level file management page composition. Renders the header, the mode-driven browser workspace, and the overlay layer.

**UI Outline**

```text
[File Management Header]
[Record Browser]
[Record Detail Modal]
[Management Modal]
[Upload Modal]
```

**UI**

- Keeps one page shell while the active record type changes.
- Makes the mode switcher and upload entry action available from the header.
- Uses overlays for inspect, create, delete, and upload flows.

**Props**

| Prop | Description |
|---|---|
| `state` | Page-level file management state. |
| `actions` | Page-level file management actions. |

**Children**

- `SampleManagementPanel` - Serves as the active browser panel for filters and list behavior.
- `FileManagementOverlays` - Hosts the modal flows.

### SampleManagementPanel

**Status:** complete

**Purpose**

Renders the shared browser panel for samples, artifacts, and assets, including filters, result summary, selection, and row rendering.

**UI Outline**

```text
[Mode Summary Bar]
[Filter Grid]
[Record List]
```

**UI**

- Reuses one browser shell for all three record types.
- Keeps the filter controls tightly paired with the visible list.
- Uses the current management mode to drive the list content and copy.

**Props**

| Prop | Description |
|---|---|
| `state` | Browser state, including records, filters, and selection. |
| `actions` | Browser actions. |

**Children**

- `SampleFilterPanel` - Wraps filters, summary, and the visible row list.
- `RecordRow` - Displays one sample, artifact, or asset row.

### SampleFilterPanel

**Status:** complete

**Purpose**

Generic filter-and-list shell used by the file management browser.

**UI Outline**

```text
[Summary]
[Actions]
[Filter Controls]
[Row List]
```

**UI**

- Keeps the summary and list in one vertical stack.
- Supports mode-specific filter controls without changing the outer shell.
- Shows a clear empty state when no records match.

**Props**

| Prop | Description |
|---|---|
| `filters` | Filter control descriptors. |
| `actions` | Row of action buttons for the current browser mode. |
| `summary` | Short result count summary. |
| `rows` | Rendered row content or an empty state. |
| `emptyState` | Empty-state copy. |
| `listClass` | CSS class for the row list container. |
| `listAttributes` | Additional attributes for the row list container. |

**Children**

- `Summary Bar` - Shows the current result count.
- `Action Row` - Holds filter actions and select-all.
- `Filter Grid` - Renders the active filters.
- `Row List` - Renders the visible records.

### FileManagementOverlays

**Status:** complete

**Purpose**

Hosts the page overlays for record inspection, management actions, and uploads.

**UI Outline**

```text
[Record Detail Modal]
[Management Modal]
[Upload Modal]
```

**UI**

- Keeps all modal flows above the page frame.
- Reuses one overlay layer for inspect, create, delete, and upload behavior.

**Props**

| Prop | Description |
|---|---|
| `state` | Overlay-related page state. |
| `actions` | Overlay and mutation actions. |

**Children**

- `RecordDetailModal` - Inspects one record.
- `ManagementModal` - Handles create/delete intent.
- `UploadModal` - Hosts the upload form.

### FileUploadPanel

**Status:** complete

**Purpose**

Acts as the upload form for samples, artifacts, and assets.

**UI Outline**

```text
[Upload Type Switch]
[Upload Mode Switch]
[Mode-Specific Fields]
[Upload Button]
```

**UI**

- Changes field layout by both upload type and upload mode.
- Uses folder mode only where the page supports it.
- Keeps the form compact and task-focused.

**Props**

| Prop | Description |
|---|---|
| `state` | Upload state, including type and mode. |
| `actions` | Upload actions. |

**Children**

- `UploadTypeToggle` - Switches between sample, artifact, and asset upload.
- `UploadModeToggle` - Switches between single-file and folder upload.
- `SampleUploadFields` - Sample-specific upload fields.
- `ArtifactUploadFields` - Artifact-specific upload fields.
- `AssetUploadFields` - Asset-specific upload fields.

### Record Detail Modal

**Status:** incomplete

**Purpose**

Shows the selected record in a preview-focused inspection surface.

**UI Outline**

```text
[Record Header]
[Preview]
[Metadata Grid]
[Metadata Block]
[Close / Delete]
```

**UI**

- Uses one detail shell across all record types.
- Shows image preview when the blob is an image.
- Falls back to text and metadata when no preview is available.

**Props**

| Prop | Description |
|---|---|
| `open` | Whether the detail modal is visible. |
| `type` | The active record type. |
| `record` | The selected record payload. |
| `actions` | Detail and delete actions. |

**Children**

- `Record Header` - Shows the record title and type label.
- `Preview Area` - Shows the blob preview when available.
- `Metadata Grid` - Shows the record metadata.
- `Metadata Block` - Shows all non-core fields.
- `Action Row` - Hosts delete and close actions.

### Management Modal

**Status:** incomplete

**Purpose**

Collects the create or delete action for the active browser mode.

**UI Outline**

```text
[Mode Title]
[Mode Copy]
[Mode Fields or Delete Hint]
[Cancel / Confirm]
```

**UI**

- Adapts its body by record type.
- Uses the current selection as the working set for bulk deletion or grouping.
- Shows delete-only behavior for assets.

**Props**

| Prop | Description |
|---|---|
| `open` | Whether the management modal is visible. |
| `state` | Current management state, selection, and drafts. |
| `actions` | Create, delete, and close actions. |

**Children**

- `Mode Title` - Shows the active management action label.
- `Mode Copy` - Explains the current mode.
- `Mode Fields` - Renders sample-set or artifact-group inputs when relevant.
- `Delete Hint` - Explains delete-only handling for assets.
- `Footer Actions` - Hosts cancel and confirm actions.
