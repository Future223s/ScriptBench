import { escapeHtml, truncate } from "../utils/html.js";
import { filterSamplesForPicker, imageDataUrl, membershipsForSample, modelFamilies, normalizeGroupValue, selectedGrouping, valuesForGrouping, visibleSamples, visibleWorkflowSamples } from "../utils/workflow.js";
import { renderSampleFilterPanel } from "./SampleFilterPanel.js";

export function renderUploadModal({ open, uploadMode }) {
  const isFolderMode = uploadMode === "folder";
  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="upload">
      <form class="modal small" id="upload-form" data-upload-mode="${escapeHtml(uploadMode)}">
        <div class="modal-header">
          <h2>Upload samples</h2>
          <button class="btn-ghost" type="button" data-action="close-modals">Close</button>
        </div>
        <div class="modal-body">
          <div class="mode-switch">
            <button class="mode-option ${isFolderMode ? "" : "is-active"}" type="button" data-action="set-upload-mode" data-upload-mode="single">Single file</button>
            <button class="mode-option ${isFolderMode ? "is-active" : ""}" type="button" data-action="set-upload-mode" data-upload-mode="folder">Folder</button>
          </div>
          <div class="form-grid">
            <div class="field wide ${isFolderMode ? "is-hidden" : ""}">
              <label for="upload-sample-id">Sample ID</label>
              <input id="upload-sample-id" name="sample_id" ${isFolderMode ? "" : "required"} />
            </div>
            <div class="field wide ${isFolderMode ? "is-hidden" : ""}">
              <label for="upload-file">File</label>
              <input id="upload-file" name="file" type="file" ${isFolderMode ? "" : "required"} />
            </div>
            <div class="field wide ${isFolderMode ? "is-hidden" : ""}">
              <label for="upload-ground-truth">Ground truth text ${isFolderMode ? "(single upload only)" : ""}</label>
              <textarea id="upload-ground-truth" name="ground_truth_text" rows="8" ${isFolderMode ? "" : "required"}></textarea>
            </div>
            <div class="field wide ${isFolderMode ? "" : "is-hidden"}">
              <label for="upload-image-folder">Folder of images</label>
              <input id="upload-image-folder" name="image_folder_files" type="file" webkitdirectory multiple ${isFolderMode ? "required" : ""} />
              <span class="count-label">Choose the folder containing the image files.</span>
            </div>
            <div class="field wide ${isFolderMode ? "" : "is-hidden"}">
              <label for="upload-ground-truth-folder">Folder of ground truth text files</label>
              <input id="upload-ground-truth-folder" name="ground_truth_folder_files" type="file" webkitdirectory multiple />
              <span class="count-label">Ground truth files must be .txt files named like the matching image with <code>_gt</code> appended, for example <code>page_01_gt.txt</code>.</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" data-action="close-modals">Cancel</button>
          <button class="btn-primary" type="submit">Upload</button>
        </div>
      </form>
    </div>
  `;
}

export function renderGroupModal({ open, samples, groupDraft }) {
  const visibleSamples = filterSamplesForPicker(samples, groupDraft.sample_query, groupDraft.sample_query_mode);
  const selectedVisibleCount = visibleSamples.filter((sample) => groupDraft.sample_ids.includes(sample.sample_id)).length;
  const rows = visibleSamples.map((sample) => `
    <label class="picker-row">
      <input type="checkbox" data-group-sample="${escapeHtml(sample.sample_id)}"
        ${groupDraft.sample_ids.includes(sample.sample_id) ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(sample.sample_id)}</strong>
        <span class="count-label">${escapeHtml(truncate(sample.ground_truth_text, 90))}</span>
      </span>
    </label>
  `).join("") || `<div class="empty-state">Upload samples before creating groups.</div>`;

  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="group">
      <form class="modal" id="group-form">
        <div class="modal-header">
          <h2>Create grouping</h2>
          <button class="btn-ghost" type="button" data-action="close-modals">Close</button>
        </div>
        <div class="modal-body">
          <div class="field wide">
            <label for="group-name">Group name</label>
            <input id="group-name" value="${escapeHtml(groupDraft.name)}" required />
          </div>
          ${renderSampleFilterPanel({
            filters: [
              {
                id: "group-sample-search",
                label: "Search samples",
                kind: "text",
                scope: "groupDraft",
                field: "sample_query",
                value: groupDraft.sample_query,
                placeholder: "Sample ID or ground truth",
              },
                {
                  id: "group-sample-match",
                  label: "Match",
                  kind: "select",
                scope: "groupDraft",
                field: "sample_query_mode",
                  value: groupDraft.sample_query_mode,
                  options: [
                    { value: "contains", label: "Contains" },
                    { value: "starts-with", label: "Begins with" },
                    { value: "exact", label: "Exact" },
                  ],
                },
            ],
            actions: `
              <button class="btn-secondary" type="button" data-action="select-group-samples-visible" ${!visibleSamples.length ? "disabled" : ""}>Select all visible</button>
              <button class="btn-primary" type="button" data-action="apply-group-filter">Apply filter</button>
            `,
            summary: `${visibleSamples.length} visible, ${selectedVisibleCount} selected.`,
            rows,
          })}
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" data-action="close-modals">Cancel</button>
          <button class="btn-primary" type="submit">Save grouping</button>
        </div>
      </form>
    </div>
  `;
}

export function renderGroupDetailModal({ open, groupings, selectedGroupName }) {
  const group = selectedGrouping(groupings, selectedGroupName);
  const values = valuesForGrouping(group);
  const valueRows = values.length
    ? values.map((entry) => `
      <div class="value-block">
        <div class="value-heading">
          <div class="value-heading-main">
            <strong>${escapeHtml(entry.value)}</strong>
            <span class="badge">${entry.sampleIds.length}</span>
          </div>
          <button class="btn-ghost btn-tight" type="button" data-action="edit-value" data-value-name="${escapeHtml(entry.value)}">Edit</button>
        </div>
        <div class="chip-list">
          ${entry.sampleIds.map((sampleId) => `<span class="badge">${escapeHtml(sampleId)}</span>`).join("")}
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">No samples are assigned to this grouping yet.</div>`;

  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="group-detail">
      <section class="modal">
        <div class="modal-header">
          <div class="panel-title">
            <h2>${escapeHtml(group?.name || "Grouping")}</h2>
            <span>${Object.keys(group?.assignments || {}).length} samples</span>
          </div>
          <div class="inline-actions">
            <button class="btn-danger" type="button" data-action="delete-group" data-group-name="${escapeHtml(group?.name || "")}">Delete grouping</button>
            <button class="btn-ghost" type="button" data-action="close-modals">Close grouping</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="inline-actions">
            <button class="btn-primary" type="button" data-action="open-value">Add value</button>
          </div>
          <div class="value-list">${valueRows}</div>
        </div>
      </section>
    </div>
  `;
}

export function renderValueModal({ open, samples, groupings, selectedGroupName, valueDraft }) {
  const group = selectedGrouping(groupings, selectedGroupName);
  const scopedSamples = selectedGroupName ? visibleSamples(samples, groupings, selectedGroupName) : [];
  const visibleSamplesForQuery = filterSamplesForPicker(scopedSamples, valueDraft.sample_query, valueDraft.sample_query_mode);
  const selectedVisibleCount = visibleSamplesForQuery.filter((sample) => valueDraft.sample_ids.includes(sample.sample_id)).length;
  const rows = visibleSamplesForQuery.map((sample) => `
    <label class="picker-row">
      <input type="checkbox" data-value-sample="${escapeHtml(sample.sample_id)}"
        ${valueDraft.sample_ids.includes(sample.sample_id) ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(sample.sample_id)}</strong>
        <span class="count-label">${escapeHtml(normalizeGroupValue(group?.assignments?.[sample.sample_id]))}</span>
      </span>
    </label>
  `).join("") || `<div class="empty-state">${selectedGroupName ? `No samples match the current filters for ${escapeHtml(selectedGroupName)}.` : "Select a grouping before adding values."}</div>`;

  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="value">
      <form class="modal small" id="value-form">
        <div class="modal-header">
          <h2>${valueDraft.editing_value ? "Edit value" : "Add value"}</h2>
          <button class="btn-ghost" type="button" data-action="close-value">Close value</button>
        </div>
        <div class="modal-body">
          <div class="field wide">
            <label for="value-name">Value name</label>
            <input id="value-name" value="${escapeHtml(valueDraft.value)}" required />
          </div>
          ${renderSampleFilterPanel({
            filters: [
              {
                id: "value-sample-search",
                label: "Search samples",
                kind: "text",
                scope: "valueDraft",
                field: "sample_query",
                value: valueDraft.sample_query,
                placeholder: "Sample ID or ground truth",
              },
                {
                  id: "value-sample-match",
                  label: "Match",
                  kind: "select",
                scope: "valueDraft",
                field: "sample_query_mode",
                  value: valueDraft.sample_query_mode,
                  options: [
                    { value: "contains", label: "Contains" },
                    { value: "starts-with", label: "Begins with" },
                    { value: "exact", label: "Exact" },
                  ],
                },
            ],
            actions: `
              <button class="btn-secondary" type="button" data-action="select-value-samples-visible" ${!visibleSamplesForQuery.length ? "disabled" : ""}>Select all visible</button>
              <button class="btn-primary" type="button" data-action="apply-value-filter">Apply filter</button>
            `,
            summary: selectedGroupName
              ? `${visibleSamplesForQuery.length} visible in ${selectedGroupName}, ${selectedVisibleCount} selected.`
              : "Select a grouping first.",
            rows,
            listClass: "sample-picker value-sample-picker",
          })}
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" data-action="close-value">Cancel</button>
          <button class="btn-primary" type="submit">${valueDraft.editing_value ? "Save changes" : "Submit"}</button>
        </div>
      </form>
    </div>
  `;
}

export function renderSampleDetailModal({ open, sample, groupings }) {
  const memberships = sample
    ? [
      ...(sample.sample_group
        ? [{ group: "sample_group", value: normalizeGroupValue(sample.sample_group) }]
        : []),
      ...membershipsForSample(groupings, sample.sample_id),
    ]
    : [];
  const src = imageDataUrl(sample);

  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="sample-detail">
      <section class="modal">
        <div class="modal-header">
          <div class="panel-title">
            <h2>${escapeHtml(sample?.sample_id || "Sample")}</h2>
            <span>${escapeHtml(sample?.sample_mime_type || "")}</span>
          </div>
          <div class="inline-actions">
            <button class="btn-danger" type="button" data-action="delete-sample" data-sample-id="${escapeHtml(sample?.sample_id || "")}">Delete sample</button>
            <button class="btn-ghost" type="button" data-action="close-modals">Close</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="sample-detail-grid">
            <div class="sample-preview">
              ${src
                ? `<img src="${src}" alt="${escapeHtml(sample.sample_id)}" />`
                : `<div class="empty-state">No image preview available.</div>`}
            </div>
            <div class="ground-truth-box">
              <h3>Ground truth</h3>
              <pre>${escapeHtml(sample?.ground_truth_text || "")}</pre>
            </div>
          </div>
          <div class="membership-footer">
            <h3>Grouping values</h3>
            <div class="chip-list">
              ${memberships.length
                ? memberships.map((membership) => `
                  <span class="badge">${escapeHtml(membership.group)}: ${escapeHtml(membership.value)}</span>
                `).join("")
                : `<span class="count-label">No grouping values yet.</span>`}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function renderWorkflowModal({ open, wizardStep, workflowDraft, sampleSets, groupings }) {
  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="workflow">
      <form class="modal" id="workflow-form">
        <div class="modal-header">
          <h2>Create workflow</h2>
          <button class="btn-ghost" type="button" data-action="close-modals">Close workflow</button>
        </div>
        <div class="modal-body">
          <div class="stepper">
            ${["Identity", "Sample set", "Prompt spec"].map((label, index) => `
              <div class="step ${wizardStep === index ? "is-active" : ""}">${label}</div>
            `).join("")}
          </div>
          ${renderWizardStep({ wizardStep, workflowDraft, sampleSets, groupings })}
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" type="button" data-action="${wizardStep === 0 ? "close-modals" : "wizard-back"}">
            ${wizardStep === 0 ? "Cancel" : "Back"}
          </button>
          <div class="inline-actions">
            ${wizardStep < 2
              ? `<button class="btn-primary" type="button" data-action="wizard-next">Next</button>`
              : `<button class="btn-primary" type="submit">Create</button>`}
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderWizardStep({ wizardStep, workflowDraft, sampleSets, groupings }) {
  if (wizardStep === 0) {
    return `
      <div class="form-grid">
        <div class="field wide">
          <label for="workflow-name">Workflow name</label>
          <input id="workflow-name" data-draft="workflow_name" value="${escapeHtml(workflowDraft.workflow_name)}" required />
        </div>
        <div class="field">
          <label for="workflow-stage">Workflow stage</label>
          <input id="workflow-stage" data-draft="workflow_stage" value="${escapeHtml(workflowDraft.workflow_stage)}" required />
        </div>
        <div class="field">
          <label for="model-family">Model family</label>
          <select id="model-family" data-draft="model_family">
            ${modelFamilies.map((family) => `
              <option value="${family}" ${family === workflowDraft.model_family ? "selected" : ""}>${family}</option>
            `).join("")}
          </select>
        </div>
        <div class="field">
          <label for="model-name">Model</label>
          <input id="model-name" data-draft="model" value="${escapeHtml(workflowDraft.model)}" />
        </div>
        <div class="field">
          <label for="workflow-groups">Groups</label>
          <input id="workflow-groups" data-draft="groups" value="${escapeHtml(workflowDraft.groups)}" placeholder="Comma separated" />
        </div>
      </div>
    `;
  }

  if (wizardStep === 1) {
    const selectedSampleSetId = Number(workflowDraft.sample_set_id) || null;
    const selectedSampleSet = sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === selectedSampleSetId) || null;
    const sampleSetOptions = sampleSets.length
      ? sampleSets.map((sampleSet) => `
        <option value="${escapeHtml(sampleSet.sample_set_id)}" ${Number(sampleSet.sample_set_id) === selectedSampleSetId ? "selected" : ""}>
          ${escapeHtml(sampleSet.sample_set_name)} (${escapeHtml(sampleSet.sample_count || 0)} samples)
        </option>
      `).join("")
      : `<option value="">No sample sets available</option>`;

    return `
      <div class="form-grid">
        <div class="field wide">
          <label for="workflow-sample-set">Sample set</label>
          <select id="workflow-sample-set" data-draft="sample_set_id" required ${sampleSets.length ? "" : "disabled"}>
            <option value="">Choose a sample set</option>
            ${sampleSetOptions}
          </select>
        </div>
        <div class="field wide">
          <label>Selected sample set</label>
          <div class="detail-card">
            <h3>${escapeHtml(selectedSampleSet?.sample_set_name || "No sample set selected")}</h3>
            <div class="metadata-grid">
              <div class="metadata-row"><span>Samples</span><strong>${escapeHtml(selectedSampleSet?.sample_count || 0)}</strong></div>
              <div class="metadata-row"><span>Workflows</span><strong>${escapeHtml(selectedSampleSet?.workflow_count || 0)}</strong></div>
            </div>
            <div class="count-label">The workflow will use this sample set as its backbone.</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="form-grid">
      <div class="field wide">
        <label for="prompt-instructions">Instructions</label>
        <textarea id="prompt-instructions" data-draft="instructions" rows="7" required>${escapeHtml(workflowDraft.instructions)}</textarea>
      </div>
      <div class="field wide">
        <label>Examples</label>
        ${workflowDraft.examples.map((example, index) => `
          <div class="example-editor">
            <div class="field">
              <label for="example-title-${index}">Title</label>
              <input id="example-title-${index}" data-example-field="title" data-example-index="${index}" value="${escapeHtml(example.title)}" />
            </div>
            <div class="field">
              <label for="example-instructions-${index}">Instruction text</label>
              <textarea id="example-instructions-${index}" data-example-field="instruction_text" data-example-index="${index}" rows="4">${escapeHtml(example.instruction_text)}</textarea>
            </div>
            <div class="field">
              <label for="example-assets-${index}">Assets</label>
              <textarea id="example-assets-${index}" data-example-field="assets" data-example-index="${index}" rows="2">${escapeHtml(example.assets)}</textarea>
            </div>
            <button class="btn-danger" type="button" data-action="remove-example" data-example-index="${index}">Remove example</button>
          </div>
        `).join("")}
        <button class="btn-ghost" type="button" data-action="add-example">Add example</button>
      </div>
      <div class="field wide">
        <label>Inputs</label>
        <div class="inputs-card">
          <div class="inputs-row">
            <div class="field">
              <label for="workflow-input-mode-detail">Selection mode</label>
              <select id="workflow-input-mode-detail" data-draft="input_mode">
                <option value="single" ${workflowDraft.input_mode === "single" ? "selected" : ""}>Single sample</option>
                <option value="batch" ${workflowDraft.input_mode !== "single" ? "selected" : ""}>Batch sample set</option>
              </select>
            </div>
            <div class="field">
              <label for="workflow-batch-size">Batch size</label>
              <input id="workflow-batch-size" type="number" min="1" data-draft="batch_size" value="${escapeHtml(workflowDraft.batch_size)}" ${workflowDraft.input_mode === "single" ? "disabled" : ""} />
            </div>
          </div>
          <div class="field">
            <label>Sample set inputs</label>
            <span class="count-label">${workflowDraft.sample_set_id ? "Sample IDs are derived from the selected sample set." : "Choose a sample set in the previous step."}</span>
          </div>
        </div>
      </div>
      <div class="field wide">
        <label>Output format</label>
        <div class="inputs-card">
          <div class="inputs-row">
            <div class="field">
              <label for="output-format-type">Output format type</label>
              <select id="output-format-type" data-draft="output_format_type">
                <option value="plain_text" ${workflowDraft.output_format_type === "plain_text" ? "selected" : ""}>plain_text</option>
                <option value="json_array" ${workflowDraft.output_format_type === "json_array" ? "selected" : ""}>json_array</option>
              </select>
            </div>
          <div class="field">
            <label>Type hint</label>
            <span class="count-label">Single input defaults to plain_text. Batch input defaults to json_array.</span>
          </div>
          </div>
          ${workflowDraft.output_format_type === "plain_text" ? "" : `
            <div class="field">
              <label>Item schema</label>
              <div class="example-editor">
                ${workflowDraft.item_schema_entries.map((entry, index) => `
                  <div class="schema-row">
                    <div class="field">
                      <label for="item-schema-field-${index}">Field</label>
                      <input id="item-schema-field-${index}" data-schema-field="field" data-schema-index="${index}" value="${escapeHtml(entry.field)}" placeholder="text" />
                    </div>
                    <div class="field">
                      <label for="item-schema-description-${index}">Description</label>
                      <input id="item-schema-description-${index}" data-schema-field="description" data-schema-index="${index}" value="${escapeHtml(entry.description)}" placeholder="Describe this field" />
                    </div>
                    <div class="field">
                      <label>&nbsp;</label>
                      <button class="btn-danger" type="button" data-action="remove-schema-field" data-schema-index="${index}">Remove</button>
                    </div>
                  </div>
                `).join("")}
                <button class="btn-ghost" type="button" data-action="add-schema-field">Add field</button>
                <span class="count-label">Used when the output format is structured, such as json_array.</span>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function renderJobDetailModal({ open, job }) {
  const sampleIds = Array.isArray(job?.sample_ids) ? job.sample_ids : [];
  const promptJson = safeJsonStringify(job?.resolved_prompt);
  const transcriptionText = job?.raw_content || "";
  const transcriptionParsed = safeJsonParse(transcriptionText);
  return `
    <div class="modal-backdrop ${open ? "" : "is-hidden"}" data-modal="job-detail">
      <section class="modal job-modal">
        <div class="modal-header">
          <div class="panel-title">
            <h2>Job ${escapeHtml(job?.job_id || "")}</h2>
            <span>${escapeHtml(job?.status || "Unknown status")}</span>
          </div>
          <button class="btn-ghost" type="button" data-action="close-job-detail">Close</button>
        </div>
        <div class="modal-body">
          <div class="job-detail-grid">
            <div class="detail-card">
              <h3>Metadata</h3>
              <div class="metadata-grid">
                <div class="metadata-row"><span>Workflow</span><strong>${escapeHtml(job?.workflow_id || "")}</strong></div>
                <div class="metadata-row"><span>Job</span><strong>${escapeHtml(job?.job_id || "")}</strong></div>
                <div class="metadata-row"><span>Status</span><strong>${escapeHtml(job?.status || "")}</strong></div>
                <div class="metadata-row"><span>Elapsed</span><strong>${job?.time_elapsed != null ? `${escapeHtml(Number(job.time_elapsed).toFixed(1))}s` : "n/a"}</strong></div>
                <div class="metadata-row"><span>Created</span><strong>${escapeHtml(job?.created_at || "")}</strong></div>
                <div class="metadata-row"><span>Started</span><strong>${escapeHtml(job?.started_at || "")}</strong></div>
                <div class="metadata-row"><span>Completed</span><strong>${escapeHtml(job?.completed_at || "")}</strong></div>
              </div>
              <div class="field">
                <label>Sample IDs</label>
                <div class="chip-list">
                  ${sampleIds.length
                    ? sampleIds.map((sampleId) => `<span class="badge">${escapeHtml(sampleId)}</span>`).join("")
                    : `<span class="count-label">No sample IDs attached.</span>`}
                </div>
              </div>
              ${job?.failure_reason ? `
                <div class="field wide">
                  <label>Failure reason</label>
                  <pre>${escapeHtml(job.failure_reason)}</pre>
                </div>
              ` : ""}
            </div>
            <div class="job-detail-right">
              <details class="detail-card detail-accordion">
                <summary>
                  <h3>Resolved prompt</h3>
                  <span>Expand to inspect the prompt payload</span>
                </summary>
                <pre>${escapeHtml(promptJson || "No resolved prompt available.")}</pre>
              </details>
              <details class="detail-card detail-accordion">
                <summary>
                  <h3>Transcription content</h3>
                  <span>Expand to inspect the model output</span>
                </summary>
                ${transcriptionParsed != null
                  ? renderJsonTree(transcriptionParsed)
                  : `<pre>${escapeHtml(transcriptionText || "No transcription content yet.")}</pre>`}
              </details>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function safeJsonStringify(value) {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function safeJsonParse(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function renderJsonTree(value) {
  if (value == null) {
    return `<div class="json-tree"><div class="json-line json-null">null</div></div>`;
  }

  if (Array.isArray(value)) {
    return `
      <div class="json-tree">
        <div class="json-line json-bracket">[</div>
        ${value.map((item, index) => renderJsonTreeLine(`[${index}]`, item, index === value.length - 1)).join("")}
        <div class="json-line json-bracket">]</div>
      </div>
    `;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    return `
      <div class="json-tree">
        <div class="json-line json-bracket">{</div>
        ${entries.map(([key, item], index) => renderJsonTreeLine(key, item, index === entries.length - 1)).join("")}
        <div class="json-line json-bracket">}</div>
      </div>
    `;
  }

  return `<div class="json-tree"><div class="json-line json-scalar">${escapeHtml(renderJsonScalar(value))}</div></div>`;
}

function renderJsonTreeLine(key, value, isLast) {
  if (value == null || typeof value !== "object") {
    return `
      <div class="json-line json-pair">
        <span class="json-key">${escapeHtml(JSON.stringify(key))}:</span>
        <span class="json-value json-scalar">${escapeHtml(renderJsonScalar(value))}${isLast ? "" : ","}</span>
      </div>
    `;
  }

  const nested = renderJsonTree(value);
  return `
    <div class="json-line json-pair json-nested">
      <div class="json-key-line">${escapeHtml(JSON.stringify(key))}:</div>
      <div class="json-nested-block">
        ${nested}
      </div>
      ${isLast ? "" : `<div class="json-line json-comma">,</div>`}
    </div>
  `;
}

function renderJsonScalar(value) {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}
