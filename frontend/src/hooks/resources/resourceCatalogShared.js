"use client";

import { formatDate } from "../../utils/date.js";

export const resourceModes = {
  "payload-template": {
    title: "Payload Templates",
    shortTitle: "Payload templates",
    detailLabel: "Payload template",
  },
  "workflow-step": {
    title: "Workflow Steps",
    shortTitle: "Workflow steps",
    detailLabel: "Workflow step",
  },
  "output-spec": {
    title: "Output Specifications",
    shortTitle: "Output specifications",
    detailLabel: "Output specification",
  },
};

const resourceDetailLabels = {
  "sample-set": "Sample set",
  "artifact-group": "Artifact group",
  "payload-template": "Payload template",
  "workflow-step": "Workflow step",
  "output-spec": "Output specification",
};

export const DEFAULT_RESOURCE_FILTERS = {
  "sample-set": {
    query: "",
    status: "",
  },
  "artifact-group": {
    query: "",
    mappingType: "",
    status: "",
  },
  "payload-template": {
    query: "",
    version: "",
  },
  "workflow-step": {
    query: "",
    modelFamily: "",
    payloadTemplateId: "",
    outputSpecId: "",
  },
  "output-spec": {
    query: "",
    outputType: "",
  },
};

export function cloneResourceFilters(filters = DEFAULT_RESOURCE_FILTERS) {
  return {
    "sample-set": { ...filters["sample-set"] },
    "artifact-group": { ...filters["artifact-group"] },
    "payload-template": { ...filters["payload-template"] },
    "workflow-step": { ...filters["workflow-step"] },
    "output-spec": { ...filters["output-spec"] },
  };
}

export function normalizeResourceType(type) {
  if (resourceModes[type]) return type;
  return "workflow-step";
}

function containsText(values, query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

function sortedUnique(values) {
  return [
    ...new Set(
      values.map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ].sort();
}

function buildArtifactGroupRows(records) {
  return (records || []).map((record) => ({
    id: String(record.artifact_group_id),
    name:
      record.artifact_group_name ||
      `Artifact group ${record.artifact_group_id}`,
    type: "artifact-group",
    badgeLabel: record.status || "draft",
    summaryFields: [
      record.mapping_type ? `Mapping: ${record.mapping_type}` : "",
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: record.artifact_group_description || "",
    detail: {
      title:
        record.artifact_group_name ||
        `Artifact group ${record.artifact_group_id}`,
      typeLabel: resourceDetailLabels["artifact-group"],
      metadata: [
        ["ID", record.artifact_group_id],
        ["Status", record.status || "draft"],
        ["Mapping type", record.mapping_type || "one-to-one"],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Description",
          content:
            record.artifact_group_description || "No description provided.",
        },
        {
          title: "Position rule",
          content: JSON.stringify(record.position_rule || {}, null, 2),
        },
      ],
      raw: record,
    },
  }));
}

function buildSampleSetRows(records) {
  return (records || []).map((record) => ({
    id: String(record.sample_set_id),
    name: record.sample_set_name || `Sample set ${record.sample_set_id}`,
    type: "sample-set",
    badgeLabel: record.status || "draft",
    summaryFields: [
      `${(record.sample_ids || []).length} samples`,
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: record.sample_set_description || "",
    detail: {
      title: record.sample_set_name || `Sample set ${record.sample_set_id}`,
      typeLabel: resourceDetailLabels["sample-set"],
      metadata: [
        ["ID", record.sample_set_id],
        ["Status", record.status || "draft"],
        ["Sample count", (record.sample_ids || []).length],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Description",
          content: record.sample_set_description || "No description provided.",
        },
        {
          title: "Samples",
          content:
            (record.sample_ids || []).join("\n") || "No samples in this set.",
        },
      ],
      raw: record,
    },
  }));
}

function templateParts(template) {
  if (!template || typeof template !== "object") return [];
  const parts = template.parts || template.content || [];
  return Array.isArray(parts) ? parts : [];
}

function resolvePayloadTemplateContents(record) {
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const inputs = Array.isArray(record.inputs) ? record.inputs : [];
  const inputRef = (input) => ({
    input_id: `payload_input:${input.payload_input_id}`,
  });
  const inputsForMessage = (messageId) =>
    inputs
      .filter((input) => (input.payload_message_id ?? null) === messageId)
      .map(inputRef);

  return {
    root: {
      ...record.payload_template,
      parts: [
        ...templateParts(record.payload_template),
        ...inputs
          .filter((input) => input.payload_message_id == null)
          .map(inputRef),
      ],
    },
    messages: messages.map((message) => ({
      payload_message_id: message.payload_message_id,
      role: message.role,
      parts: [
        ...templateParts(message.message_template),
        ...inputsForMessage(message.payload_message_id),
      ],
    })),
    inputs,
  };
}

function buildPayloadTemplateRows(records) {
  return (records || []).map((record) => ({
    id: String(record.payload_template_id),
    name:
      record.payload_template_name ||
      `Payload template ${record.payload_template_id}`,
    type: "payload-template",
    badgeLabel: record.version ? `v${record.version}` : "Template",
    summaryFields: [
      record.version ? `Version ${record.version}` : "",
      record.updated_at ? formatDate(record.updated_at) : "",
    ].filter(Boolean),
    previewText: `${(record.messages || []).length} messages · ${(record.inputs || []).length} inputs`,
    resolvedContents: resolvePayloadTemplateContents(record),
    detail: {
      title:
        record.payload_template_name ||
        `Payload template ${record.payload_template_id}`,
      typeLabel: resourceModes["payload-template"].detailLabel,
      metadata: [
        ["ID", record.payload_template_id],
        ["Version", record.version || ""],
        ["Updated", record.updated_at ? formatDate(record.updated_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Resolved contents",
          content: JSON.stringify(
            resolvePayloadTemplateContents(record),
            null,
            2,
          ),
        },
      ],
      raw: {
        ...record,
        resolved_contents: resolvePayloadTemplateContents(record),
      },
    },
  }));
}

function buildWorkflowStepRows(records, payloadTemplates, outputSpecs) {
  const payloadNames = new Map(
    (payloadTemplates || []).map((record) => [
      String(record.payload_template_id),
      record.payload_template_name,
    ]),
  );
  const outputNames = new Map(
    (outputSpecs || []).map((record) => [
      String(record.output_spec_id),
      record.output_spec_name,
    ]),
  );
  return (records || []).map((record) => ({
    id: String(record.workflow_step_id),
    name: record.step_name || `Workflow step ${record.workflow_step_id}`,
    type: "workflow-step",
    badgeLabel: record.model_family || "Step",
    summaryFields: [
      record.model ? `Model: ${record.model}` : "",
      record.version ? `Version ${record.version}` : "",
      record.updated_at ? formatDate(record.updated_at) : "",
    ].filter(Boolean),
    previewText: [
      record.payload_template_id
        ? `Payload: ${payloadNames.get(String(record.payload_template_id)) || record.payload_template_id}`
        : "",
      record.output_spec_id
        ? `Output: ${outputNames.get(String(record.output_spec_id)) || record.output_spec_id}`
        : "",
    ]
      .filter(Boolean)
      .join(" • "),
    detail: {
      title: record.step_name || `Workflow step ${record.workflow_step_id}`,
      typeLabel: resourceModes["workflow-step"].detailLabel,
      metadata: [
        ["ID", record.workflow_step_id],
        ["Model family", record.model_family || ""],
        ["Model", record.model || ""],
        ["Version", record.version || ""],
        ["Payload template", record.payload_template_id || ""],
        ["Output specification", record.output_spec_id || ""],
        ["Updated", record.updated_at ? formatDate(record.updated_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [],
      raw: record,
    },
  }));
}

function buildOutputSpecRows(records) {
  return (records || []).map((record) => ({
    id: String(record.output_spec_id),
    name:
      record.output_spec_name ||
      `Output specification ${record.output_spec_id}`,
    type: "output-spec",
    badgeLabel: record.type || "Spec",
    summaryFields: [
      record.version ? `Version ${record.version}` : "",
      record.updated_at ? formatDate(record.updated_at) : "",
    ].filter(Boolean),
    previewText: record.instructions || "",
    detail: {
      title:
        record.output_spec_name ||
        `Output specification ${record.output_spec_id}`,
      typeLabel: resourceModes["output-spec"].detailLabel,
      metadata: [
        ["ID", record.output_spec_id],
        ["Type", record.type || ""],
        ["Version", record.version || ""],
        ["Updated", record.updated_at ? formatDate(record.updated_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Instructions",
          content: record.instructions || "No instructions provided.",
        },
        {
          title: "Item schema",
          content: JSON.stringify(record.item_schema || {}, null, 2),
        },
      ],
      raw: record,
    },
  }));
}

export function buildResourceCatalog(catalogs) {
  return {
    "sample-set": buildSampleSetRows(catalogs.sampleSets),
    "artifact-group": buildArtifactGroupRows(catalogs.artifactGroups),
    "payload-template": buildPayloadTemplateRows(catalogs.payloadTemplates),
    "workflow-step": buildWorkflowStepRows(
      catalogs.workflowSteps,
      catalogs.payloadTemplates,
      catalogs.outputSpecs,
    ),
    "output-spec": buildOutputSpecRows(catalogs.outputSpecs),
  };
}

export function visibleResourceRows(resourceCatalog, appliedFilters, type) {
  const normalizedType = normalizeResourceType(type);
  const rows = resourceCatalog[normalizedType] || [];
  const filters =
    appliedFilters[normalizedType] || DEFAULT_RESOURCE_FILTERS[normalizedType];

  if (normalizedType === "artifact-group") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText(
          [row.name, raw.artifact_group_description],
          filters.query,
        ) &&
        (!filters.mappingType ||
          String(raw.mapping_type || "") === String(filters.mappingType)) &&
        (!filters.status || String(raw.status || "") === String(filters.status))
      );
    });
  }

  if (normalizedType === "sample-set") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText([row.name, raw.sample_set_description], filters.query) &&
        (!filters.status || String(raw.status || "") === String(filters.status))
      );
    });
  }

  if (normalizedType === "payload-template") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText(
          [row.name, JSON.stringify(raw.payload_template || {})],
          filters.query,
        ) &&
        (!filters.version ||
          String(raw.version || "") === String(filters.version))
      );
    });
  }

  if (normalizedType === "workflow-step") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText([row.name, raw.model_family, raw.model], filters.query) &&
        (!filters.modelFamily ||
          String(raw.model_family || "") === String(filters.modelFamily)) &&
        (!filters.payloadTemplateId ||
          String(raw.payload_template_id || "") ===
            String(filters.payloadTemplateId)) &&
        (!filters.outputSpecId ||
          String(raw.output_spec_id || "") === String(filters.outputSpecId))
      );
    });
  }

  return rows.filter((row) => {
    const raw = row.detail.raw;
    return (
      containsText([row.name, raw.type, raw.instructions], filters.query) &&
      (!filters.outputType ||
        String(raw.type || "") === String(filters.outputType))
    );
  });
}

export function resourceFilterConfig(type, state, actions) {
  const normalizedType = normalizeResourceType(type);
  if (normalizedType === "artifact-group") {
    return [
      {
        id: "resource-artifact-group-search",
        label: "Search",
        kind: "text",
        value: state.filters["artifact-group"].query,
        placeholder: "Name or description",
        onChange: (value) =>
          actions.setFilterField("artifact-group", "query", value),
      },
      {
        id: "resource-artifact-group-mapping-type",
        label: "Mapping type",
        kind: "select",
        value: state.filters["artifact-group"].mappingType,
        onChange: (value) =>
          actions.setFilterField("artifact-group", "mappingType", value),
        options: [
          { value: "", label: "All mapping types" },
          ...sortedUnique(
            state.artifactGroups.map((record) => record.mapping_type),
          ).map((value) => ({
            value,
            label: value,
          })),
        ],
      },
      {
        id: "resource-artifact-group-status",
        label: "Status",
        kind: "select",
        value: state.filters["artifact-group"].status,
        onChange: (value) =>
          actions.setFilterField("artifact-group", "status", value),
        options: [
          { value: "", label: "All statuses" },
          ...sortedUnique(
            state.artifactGroups.map((record) => record.status),
          ).map((value) => ({
            value,
            label: value,
          })),
        ],
      },
    ];
  }

  if (normalizedType === "sample-set") {
    return [
      {
        id: "resource-sample-set-search",
        label: "Search",
        kind: "text",
        value: state.filters["sample-set"].query,
        placeholder: "Name or description",
        onChange: (value) =>
          actions.setFilterField("sample-set", "query", value),
      },
      {
        id: "resource-sample-set-status",
        label: "Status",
        kind: "select",
        value: state.filters["sample-set"].status,
        onChange: (value) =>
          actions.setFilterField("sample-set", "status", value),
        options: [
          { value: "", label: "All statuses" },
          ...sortedUnique(state.sampleSets.map((record) => record.status)).map(
            (value) => ({
              value,
              label: value,
            }),
          ),
        ],
      },
    ];
  }

  if (normalizedType === "payload-template") {
    return [
      {
        id: "resource-payload-template-search",
        label: "Search",
        kind: "text",
        value: state.filters["payload-template"].query,
        placeholder: "Name or payload content",
        onChange: (value) =>
          actions.setFilterField("payload-template", "query", value),
      },
      {
        id: "resource-payload-template-version",
        label: "Version",
        kind: "select",
        value: state.filters["payload-template"].version,
        onChange: (value) =>
          actions.setFilterField("payload-template", "version", value),
        options: [
          { value: "", label: "All versions" },
          ...sortedUnique(
            state.payloadTemplates.map((record) => record.version),
          ).map((value) => ({
            value,
            label: `v${value}`,
          })),
        ],
      },
    ];
  }

  if (normalizedType === "workflow-step") {
    return [
      {
        id: "resource-workflow-step-search",
        label: "Search",
        kind: "text",
        value: state.filters["workflow-step"].query,
        placeholder: "Step name or model",
        onChange: (value) =>
          actions.setFilterField("workflow-step", "query", value),
      },
      {
        id: "resource-workflow-step-model-family",
        label: "Model",
        kind: "select",
        value: state.filters["workflow-step"].modelFamily,
        onChange: (value) =>
          actions.setFilterField("workflow-step", "modelFamily", value),
        options: [
          { value: "", label: "All model families" },
          ...sortedUnique(
            state.workflowSteps.map((record) => record.model_family),
          ).map((value) => ({
            value,
            label: value,
          })),
        ],
      },
      {
        id: "resource-workflow-step-payload-template",
        label: "Payload template",
        kind: "select",
        value: state.filters["workflow-step"].payloadTemplateId,
        onChange: (value) =>
          actions.setFilterField("workflow-step", "payloadTemplateId", value),
        options: [
          { value: "", label: "All payload templates" },
          ...state.payloadTemplates.map((record) => ({
            value: String(record.payload_template_id),
            label:
              record.payload_template_name ||
              String(record.payload_template_id),
          })),
        ],
      },
      {
        id: "resource-workflow-step-output-specification",
        label: "Output specification",
        kind: "select",
        value: state.filters["workflow-step"].outputSpecId,
        onChange: (value) =>
          actions.setFilterField("workflow-step", "outputSpecId", value),
        options: [
          { value: "", label: "All output specifications" },
          ...state.outputSpecs.map((record) => ({
            value: String(record.output_spec_id),
            label: record.output_spec_name || String(record.output_spec_id),
          })),
        ],
      },
    ];
  }

  return [
    {
      id: "resource-output-spec-search",
      label: "Search",
      kind: "text",
      value: state.filters["output-spec"].query,
      placeholder: "Name or instructions",
      onChange: (value) =>
        actions.setFilterField("output-spec", "query", value),
    },
    {
      id: "resource-output-spec-type",
      label: "Type",
      kind: "select",
      value: state.filters["output-spec"].outputType,
      onChange: (value) =>
        actions.setFilterField("output-spec", "outputType", value),
      options: [
        { value: "", label: "All types" },
        ...sortedUnique(state.outputSpecs.map((record) => record.type)).map(
          (value) => ({
            value,
            label: value,
          }),
        ),
      ],
    },
  ];
}
