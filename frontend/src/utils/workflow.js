export const modelFamilies = ["gemini", "gpt", "claude", "mistral", "escriptorium"];

export function defaultWorkflowDraft() {
  return {
    workflow_name: "",
    workflow_stage: "draft",
    model_family: "gemini",
    model: "",
    groups: "",
    input_mode: "batch",
    batch_size: 5,
    sample_set_id: null,
    selection_group_name: "",
    selection_group_value: "",
    selection_query: "",
    selection_query_mode: "contains",
    sample_ids: [],
    instructions: "",
    examples: [{ title: "", instruction_text: "", assets: "" }],
    output_format_type: "json_array",
    item_schema_entries: defaultBatchItemSchemaEntries(),
  };
}

export function defaultBatchItemSchemaEntries() {
  return [
    { field: "sample_id", description: "Identifier for the sample." },
    { field: "output_text", description: "Transcribed output text." },
    { field: "confidence", description: "Confidence score for the output." },
  ];
}

export function defaultGroupDraft() {
  return {
    name: "",
    sample_ids: [],
    sample_query: "",
    sample_query_mode: "contains",
  };
}

export function defaultValueDraft() {
  return {
    value: "",
    sample_ids: [],
    sample_query: "",
    sample_query_mode: "contains",
    editing_value: "",
  };
}

export function normalizeGroupValue(value) {
  const text = String(value ?? "").trim();
  return text || "Unassigned";
}

export function splitAssets(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function imageDataUrl(sample) {
  if (!sample?.sample_blob_base64 || !sample?.sample_mime_type) return "";
  if (!String(sample.sample_mime_type).startsWith("image/")) return "";
  return `data:${sample.sample_mime_type};base64,${sample.sample_blob_base64}`;
}

function matchesSampleQuery(value, query, mode) {
  const queryText = String(query || "").trim().toLowerCase();
  if (!queryText) return true;

  const candidate = String(value ?? "").toLowerCase();
  if (mode === "exact") return candidate === queryText;
  if (mode === "starts-with") return candidate.startsWith(queryText);
  return candidate.includes(queryText);
}

export function filterSamplesForPicker(samples, query, mode = "contains") {
  return samples.filter((sample) => {
    return (
      matchesSampleQuery(sample.sample_id, query, mode)
      || matchesSampleQuery(sample.ground_truth_text, query, mode)
    );
  });
}

export function sampleHasGroup(groupings, sampleId, groupName) {
  const group = groupings.find((item) => item.name === groupName);
  return Boolean(group?.assignments && Object.hasOwn(group.assignments, sampleId));
}

export function visibleSamples(samples, groupings, groupFilter) {
  if (!groupFilter) return samples;
  return samples.filter((sample) => sampleHasGroup(groupings, sample.sample_id, groupFilter));
}

export function visibleWorkflowSamples(samples, groupings, groupName, groupValue) {
  if (!groupName) return samples;
  const group = selectedGrouping(groupings, groupName);
  if (!group) return [];

  const assignments = group.assignments || {};
  const normalizedGroupValue = normalizeGroupValue(groupValue);

  return samples.filter((sample) => {
    if (!Object.hasOwn(assignments, sample.sample_id)) return false;
    if (!groupValue) return true;
    return normalizeGroupValue(assignments[sample.sample_id]) === normalizedGroupValue;
  });
}

export function membershipsForSample(groupings, sampleId) {
  return groupings
    .filter((group) => group.assignments && Object.hasOwn(group.assignments, sampleId))
    .map((group) => ({
      group: group.name,
      value: normalizeGroupValue(group.assignments[sampleId]),
    }));
}

export function selectedGrouping(groupings, selectedGroupName) {
  return groupings.find((group) => group.name === selectedGroupName) || null;
}

export function valuesForGrouping(group) {
  const values = new Map();
  for (const [sampleId, value] of Object.entries(group?.assignments || {})) {
    const label = normalizeGroupValue(value);
    if (!values.has(label)) values.set(label, []);
    values.get(label).push(sampleId);
  }
  return [...values.entries()]
    .map(([value, sampleIds]) => ({ value, sampleIds: sampleIds.sort() }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export function buildWorkflowPayload(draft, sampleSets = []) {
  const selectionMode = draft.input_mode === "single" ? "single" : "batch";
  const batchSize = selectionMode === "single" ? 1 : Math.max(1, Number(draft.batch_size) || 5);
  const examples = draft.examples
    .filter((example) => example.title.trim() || example.instruction_text.trim() || example.assets.trim())
    .map((example) => ({
      title: example.title.trim(),
      instruction_text: example.instruction_text.trim(),
      assets: splitAssets(example.assets),
    }));
  const itemSchemaEntries = Array.isArray(draft.item_schema_entries) ? draft.item_schema_entries : [];
  const itemSchema = Object.fromEntries(
    itemSchemaEntries
      .map((entry) => ({
        field: String(entry?.field || "").trim(),
        description: String(entry?.description || "").trim(),
      }))
      .filter((entry) => entry.field && entry.description)
      .map((entry) => [entry.field, entry.description]),
  );
  const normalizedItemSchema = Object.keys(itemSchema).length ? itemSchema : null;
  const outputFormatType = draft.output_format_type.trim() || "plain_text";
  const sampleSetId = Number(draft.sample_set_id) || null;
  const sampleSet = sampleSets.find((item) => Number(item.sample_set_id) === sampleSetId) || null;
  const sampleIds = Array.isArray(draft.sample_ids) && draft.sample_ids.length
    ? draft.sample_ids
    : Array.isArray(sampleSet?.sample_ids)
      ? sampleSet.sample_ids
      : [];

  return {
    workflow_name: draft.workflow_name.trim(),
    workflow_stage: draft.workflow_stage.trim(),
    sample_set_id: sampleSetId,
    model_family: draft.model_family,
    model: draft.model.trim() || null,
    groups: draft.groups.split(",").map((item) => item.trim()).filter(Boolean),
    prompt_spec: {
      instructions: draft.instructions.trim(),
      examples,
      inputs: {
        sample_ids: sampleIds,
        selection_mode: selectionMode,
        batch_size: batchSize,
      },
      output_format: {
        type: outputFormatType,
        item_schema: outputFormatType === "plain_text" ? null : normalizedItemSchema,
      },
    },
    status: "draft",
  };
}
