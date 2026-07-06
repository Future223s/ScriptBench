import { escapeHtml, truncate } from "../utils/html.js";
import { formatDate } from "../utils/date.js";
import { filterSamplesForPicker, membershipsForSample, selectedGrouping, valuesForGrouping, visibleSamples, visibleWorkflowSamples } from "../utils/workflow.js";
import { renderSampleFilterPanel } from "./SampleFilterPanel.js";

const fileManagementModes = {
  "create-grouping": {
    title: "Create grouping",
    description: "Collect the currently visible samples under a shared grouping name.",
    submitLabel: "Save grouping",
  },
  "create-sample-set": {
    title: "Create sample set",
    description: "Package the visible samples into a sample set for workflow authoring.",
    submitLabel: "Save sample set",
  },
  "assign-grouping-value": {
    title: "Assign grouping value",
    description: "Choose an existing grouping and assign a value to the visible samples.",
    submitLabel: "Save value",
  },
  "delete-samples": {
    title: "Delete samples",
    description: "Select the filtered samples you want to remove.",
    submitLabel: "Delete selected",
  },
};

function renderSampleRows(samples, groupings, { deletable = false, selectedSampleIds = [] } = {}) {
  return samples.length
    ? samples
      .map((sample) => {
        const memberships = membershipsForSample(groupings, sample.sample_id);
        const isSelected = selectedSampleIds.includes(sample.sample_id);
        if (deletable) {
          return `
            <label class="sample-row file-sample-row is-deletable ${isSelected ? "is-selected" : ""}">
              <input type="checkbox" data-file-management-selection="${escapeHtml(sample.sample_id)}" ${isSelected ? "checked" : ""} />
              <div class="sample-main">
                <strong>${escapeHtml(sample.sample_id)}</strong>
                <div class="meta-line">
                  <span>${sample.has_sample_blob ? `${escapeHtml(sample.sample_blob_size)} bytes` : "No file"}</span>
                  <span>${escapeHtml(formatDate(sample.updated_at))}</span>
                  <span>${memberships.length} groups</span>
                </div>
                <p>${escapeHtml(truncate(sample.ground_truth_text))}</p>
              </div>
              <span class="badge ${sample.ground_truth_text ? "green" : ""}">
                ${sample.ground_truth_text ? "Ground truth" : "Empty"}
              </span>
            </label>
          `;
        }
        return `
          <button class="sample-row file-sample-row ${isSelected ? "is-selected" : ""}" data-action="open-sample" data-sample-id="${escapeHtml(sample.sample_id)}">
            <div class="sample-main">
              <strong>${escapeHtml(sample.sample_id)}</strong>
              <div class="meta-line">
                <span>${sample.has_sample_blob ? `${escapeHtml(sample.sample_blob_size)} bytes` : "No file"}</span>
                <span>${escapeHtml(formatDate(sample.updated_at))}</span>
                <span>${memberships.length} groups</span>
              </div>
              <p>${escapeHtml(truncate(sample.ground_truth_text))}</p>
            </div>
            <span class="badge ${sample.ground_truth_text ? "green" : ""}">
              ${sample.ground_truth_text ? "Ground truth" : "Empty"}
            </span>
          </button>
        `;
      })
      .join("")
    : `<div class="empty-state">No samples match the current filters.</div>`;
}

function renderModeFields({ mode, draft, groupings }) {
  if (mode === "create-sample-set") {
    return `
      <div class="form-grid">
        <div class="field wide">
          <label for="sample-set-name">Sample set name</label>
          <input id="sample-set-name" name="sample_set_name" data-file-management-draft="sample_set_name" value="${escapeHtml(draft.sample_set_name)}" placeholder="EMMO line crops" required />
        </div>
        <div class="field">
          <label for="sample-set-type">Sample set type</label>
          <input id="sample-set-type" name="sample_set_type" data-file-management-draft="sample_set_type" value="${escapeHtml(draft.sample_set_type)}" placeholder="source, crop, evaluation" required />
        </div>
        <div class="field">
          <label for="sample-set-description">Description</label>
          <input id="sample-set-description" name="sample_set_description" data-file-management-draft="sample_set_description" value="${escapeHtml(draft.sample_set_description)}" placeholder="Optional notes" />
        </div>
      </div>
    `;
  }

  if (mode === "assign-grouping-value") {
    const selectedGroupingName = draft.grouping_value_group_name || groupings[0]?.name || "";
    const groupingOptions = groupings.length
      ? groupings.map((group) => `
        <option value="${escapeHtml(group.name)}" ${group.name === selectedGroupingName ? "selected" : ""}>${escapeHtml(group.name)}</option>
      `).join("")
      : `<option value="">No groupings available</option>`;

    return `
      <div class="form-grid">
        <div class="field wide">
          <label for="grouping-value-group">Grouping</label>
            <select
              id="grouping-value-group"
              name="grouping_value_group_name"
              data-file-management-draft="grouping_value_group_name"
              ${groupings.length ? "" : "disabled"}
              required
            >
            ${groupingOptions}
          </select>
        </div>
        <div class="field wide">
          <label for="grouping-value-name">Value name</label>
          <input id="grouping-value-name" name="grouping_value_name" data-file-management-draft="grouping_value_name" value="${escapeHtml(draft.grouping_value_name)}" placeholder="front page, handwritten, clean" required />
        </div>
      </div>
    `;
  }

  if (mode === "delete-samples") {
    return `
    `;
  }

  return `
    <div class="form-grid">
      <div class="field wide">
        <label for="grouping-name">Grouping name</label>
        <input id="grouping-name" name="grouping_name" data-file-management-draft="grouping_name" value="${escapeHtml(draft.grouping_name)}" placeholder="EMMO Sample" required />
      </div>
    </div>
  `;
}

export function renderFileManagementPanel({
  samples,
  groupings,
  fileManagementQuery,
  fileManagementQueryMode,
  fileManagementGroupFilter,
  fileManagementGroupFilterValue,
  appliedFileManagementQuery,
  appliedFileManagementQueryMode,
  appliedFileManagementGroupFilter,
  appliedFileManagementGroupFilterValue,
  fileManagementSelection = [],
  uploadMode,
  fileManagementMode,
  fileManagementDraft,
}) {
  const mode = fileManagementModes[fileManagementMode] ? fileManagementMode : "create-grouping";
  const currentMode = fileManagementModes[mode];
  const isFolderUpload = uploadMode === "folder";
  const selectedFilterGrouping = selectedGrouping(groupings, appliedFileManagementGroupFilter);
  const filteredSamples = filterSamplesForPicker(
    visibleWorkflowSamples(samples, groupings, appliedFileManagementGroupFilter, appliedFileManagementGroupFilterValue),
    appliedFileManagementQuery,
    appliedFileManagementQueryMode || "contains",
  );
  const filterGroupValues = valuesForGrouping(selectedFilterGrouping);
  const rows = renderSampleRows(filteredSamples, groupings, {
    deletable: mode === "delete-samples",
    selectedSampleIds: fileManagementSelection,
  });

  return `
    <section class="file-management-grid">
      <aside class="panel file-upload-panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>Upload files</h2>
            <span>Source samples land here first</span>
          </div>
        </div>
        <form id="upload-form" data-upload-mode="${escapeHtml(uploadMode || "single")}" class="file-upload-form">
          <div class="mode-switch">
            <button class="mode-option ${isFolderUpload ? "" : "is-active"}" type="button" data-action="set-upload-mode" data-upload-mode="single">Single file</button>
            <button class="mode-option ${isFolderUpload ? "is-active" : ""}" type="button" data-action="set-upload-mode" data-upload-mode="folder">Folder</button>
          </div>
          <div class="file-upload-copy">
            <p>Use single file uploads for one-off samples and folder uploads for uploading a batch all at once.</p>
          </div>
          <div class="form-grid">
            <div class="field wide upload-single-field ${isFolderUpload ? "is-hidden" : ""}">
              <label for="upload-sample-id">Sample ID</label>
              <input id="upload-sample-id" name="sample_id" placeholder="page_001" ${isFolderUpload ? "" : "required"} />
            </div>
            <div class="field wide upload-single-field ${isFolderUpload ? "is-hidden" : ""}">
              <label for="upload-file">File</label>
              <input id="upload-file" name="file" type="file" ${isFolderUpload ? "" : "required"} />
            </div>
            <div class="field wide upload-single-field ${isFolderUpload ? "is-hidden" : ""}">
              <label for="upload-ground-truth">Ground truth text</label>
              <textarea id="upload-ground-truth" name="ground_truth_text" rows="7" ${isFolderUpload ? "" : "required"} placeholder="Optional transcription or reference text."></textarea>
            </div>
            <div class="field wide upload-folder-field ${isFolderUpload ? "" : "is-hidden"}">
              <label for="upload-image-folder">Folder of images</label>
              <input id="upload-image-folder" name="image_folder_files" type="file" webkitdirectory multiple ${isFolderUpload ? "required" : ""} />
              <span class="count-label">Choose the folder containing the image files.</span>
            </div>
            <div class="field wide upload-folder-field ${isFolderUpload ? "" : "is-hidden"}">
              <label for="upload-ground-truth-folder">Folder of ground truth text files</label>
              <input id="upload-ground-truth-folder" name="ground_truth_folder_files" type="file" webkitdirectory multiple />
              <span class="count-label">Ground truth files should be named like the image they match, with <code>_gt</code> appended.</span>
            </div>
          </div>
          <div class="inline-actions file-upload-actions">
            <button class="btn-primary" type="submit">Upload</button>
          </div>
        </form>
      </aside>

      <section class="panel file-mode-panel">
          <div class="panel-header">
            <div class="panel-title">
              <h2>File management</h2>
              <span>${escapeHtml(currentMode.title)}</span>
            </div>
          </div>
          <div class="mode-header">
            <div class="mode-switch file-mode-switch">
              ${Object.entries(fileManagementModes).map(([key, meta]) => `
                <button
                  class="mode-option ${key === mode ? "is-active" : ""}"
                  type="button"
                  data-action="set-file-management-mode"
                  data-file-management-mode="${escapeHtml(key)}"
                  aria-pressed="${key === mode ? "true" : "false"}"
                >
                  ${escapeHtml(meta.title)}
                </button>
              `).join("")}
            </div>
            <button class="btn-primary file-mode-submit" type="submit" form="file-management-form">
              ${escapeHtml(currentMode.submitLabel)}
            </button>
          </div>
          <form id="file-management-form" class="file-management-form">
            <div class="mode-copy">
              <strong>${escapeHtml(currentMode.title)}</strong>
              <p>${escapeHtml(currentMode.description)}</p>
            </div>
            ${renderModeFields({ mode, draft: fileManagementDraft, groupings })}
          </form>
          <div class="file-sample-stack">
            ${renderSampleFilterPanel({
              filters: [
                {
                  id: "sample-search",
                  label: "Search",
                  kind: "text",
                  scope: "fileManagement",
                  field: "fileManagementQuery",
                  value: fileManagementQuery,
                  placeholder: "Sample ID or ground truth",
                },
                {
                  id: "sample-match-mode",
                  label: "Match",
                  kind: "select",
                  scope: "fileManagement",
                  field: "fileManagementQueryMode",
                  value: fileManagementQueryMode || "contains",
                  options: [
                    { value: "contains", label: "Contains" },
                    { value: "starts-with", label: "Begins with" },
                    { value: "exact", label: "Exact" },
                  ],
                },
                {
                  id: "sample-group-filter",
                  label: "Group",
                  kind: "select",
                  scope: "fileManagement",
                  field: "fileManagementGroupFilter",
                  value: fileManagementGroupFilter,
                  options: [
                    { value: "", label: "All groupings" },
                    ...groupings.map((group) => ({ value: group.name, label: group.name })),
                  ],
                },
                {
                  id: "sample-group-filter-value",
                  label: "Value",
                  kind: "select",
                  scope: "fileManagement",
                  field: "fileManagementGroupFilterValue",
                  value: fileManagementGroupFilterValue,
                  disabled: !fileManagementGroupFilter,
                  options: [
                    { value: "", label: "All values" },
                    ...filterGroupValues.map((entry) => ({ value: entry.value, label: `${entry.value} (${entry.sampleIds.length})` })),
                  ],
                },
              ],
              actions: `
                <button class="btn-secondary" type="button" data-action="apply-file-management-filter">Apply filter</button>
                <button class="btn-secondary" type="button" data-action="select-all-file-management">Select all</button>
              `,
              summary: mode === "delete-samples"
                ? `${filteredSamples.length} samples currently visible. ${fileManagementSelection.length} selected for deletion.`
                : `${filteredSamples.length} samples currently visible.`,
              rows,
              listClass: "sample-picker file-sample-picker",
            })}
          </div>
        </section>
      </section>
    </section>
  `;
}
