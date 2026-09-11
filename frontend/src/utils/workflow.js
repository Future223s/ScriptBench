export function defaultWorkflowDraft() {
  return {
    name: "",
    sample_set_id: null,
    description: "",
  };
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

export function imageDataUrl(sample) {
  if (!sample?.blob_base64 || !sample?.mime_type) return "";
  if (!String(sample.mime_type).startsWith("image/")) return "";
  return `data:${sample.mime_type};base64,${sample.blob_base64}`;
}

function matchesSampleQuery(value, query, mode) {
  const queryText = String(query || "")
    .trim()
    .toLowerCase();
  if (!queryText) return true;

  const candidate = String(value ?? "").toLowerCase();
  if (mode === "exact") return candidate === queryText;
  if (mode === "starts-with") return candidate.startsWith(queryText);
  return candidate.includes(queryText);
}

export function filterSamplesForPicker(samples, query, mode = "contains") {
  return samples.filter((sample) => {
    return (
      matchesSampleQuery(sample.id, query, mode) ||
      matchesSampleQuery(sample.ground_truth_text, query, mode)
    );
  });
}

export function sampleHasGroup(groupings, sampleId, groupName) {
  const group = groupings.find((item) => item.name === groupName);
  return Boolean(
    group?.assignments && Object.hasOwn(group.assignments, sampleId),
  );
}

export function visibleSamples(samples, groupings, groupFilter) {
  if (!groupFilter) return samples;
  return samples.filter((sample) =>
    sampleHasGroup(groupings, sample.id, groupFilter),
  );
}

export function visibleWorkflowSamples(
  samples,
  groupings,
  groupName,
  groupValue,
) {
  if (!groupName) return samples;
  const group = selectedGrouping(groupings, groupName);
  if (!group) return [];

  const assignments = group.assignments || {};
  const normalizedGroupValue = normalizeGroupValue(groupValue);

  return samples.filter((sample) => {
    if (!Object.hasOwn(assignments, sample.id)) return false;
    if (!groupValue) return true;
    return (
      normalizeGroupValue(assignments[sample.id]) ===
      normalizedGroupValue
    );
  });
}

export function membershipsForSample(groupings, sampleId) {
  return groupings
    .filter(
      (group) =>
        group.assignments && Object.hasOwn(group.assignments, sampleId),
    )
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

export function buildWorkflowPayload(draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    sample_set_id: Number(draft.sample_set_id) || null,
    status: "draft",
  };
}
