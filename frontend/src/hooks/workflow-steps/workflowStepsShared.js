"use client";

import { formatDate } from "../../utils/date.js";

export const workflowStepModes = {
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

const workflowStepDetailLabels = {
  "sample-set": "Sample set",
  "derivative-group": "Derivative group",
  "payload-template": "Payload template",
  "workflow-step": "Workflow step",
  "output-spec": "Output specification",
};

export const DEFAULT_WORKFLOW_STEP_FILTERS = {
  "sample-set": {
    query: "",
    status: "",
  },
  "derivative-group": {
    query: "",
    mappingType: "",
    status: "",
  },
  "payload-template": {
    query: "",
    status: "",
  },
  "workflow-step": {
    query: "",
    stepExecutor: "",
    payloadTemplateId: "",
    outputSpecId: "",
  },
  "output-spec": {
    query: "",
    outputType: "",
  },
};

export function cloneWorkflowStepFilters(filters = DEFAULT_WORKFLOW_STEP_FILTERS) {
  return {
    "sample-set": { ...filters["sample-set"] },
    "derivative-group": { ...filters["derivative-group"] },
    "payload-template": { ...filters["payload-template"] },
    "workflow-step": { ...filters["workflow-step"] },
    "output-spec": { ...filters["output-spec"] },
  };
}

export function normalizeWorkflowStepType(type) {
  if (workflowStepModes[type]) return type;
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

function buildDerivativeGroupRows(records) {
  return (records || []).map((record) => ({
    id: String(record.id),
    name:
      record.name ||
      `Derivative group ${record.id}`,
    type: "derivative-group",
    badgeLabel: record.status || "draft",
    summaryFields: [
      record.mapping_type ? `Mapping: ${record.mapping_type}` : "",
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: record.description || "",
    detail: {
      title:
        record.name ||
        `Derivative group ${record.id}`,
      typeLabel: workflowStepDetailLabels["derivative-group"],
      metadata: [
        ["ID", record.id],
        ["Status", record.status || "draft"],
        ["Mapping type", record.mapping_type || "one-to-one"],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Description",
          content:
            record.description || "No description provided.",
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
    id: String(record.id),
    name: record.name || `Sample set ${record.id}`,
    type: "sample-set",
    badgeLabel: record.status || "draft",
    summaryFields: [
      `${(record.sample_ids || []).length} samples`,
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: record.description || "",
    detail: {
      title: record.name || `Sample set ${record.id}`,
      typeLabel: workflowStepDetailLabels["sample-set"],
      metadata: [
        ["ID", record.id],
        ["Status", record.status || "draft"],
        ["Sample count", (record.sample_ids || []).length],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Description",
          content: record.description || "No description provided.",
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

function buildPayloadTemplateRows(records) {
  return (records || []).map((record) => ({
    id: String(record.id),
    name:
      record.name ||
      `Payload template ${record.id}`,
    type: "payload-template",
    badgeLabel: record.status || "draft",
    summaryFields: [
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: `${(record.resources || []).length} prompt resources`,
    detail: {
      title:
        record.name ||
        `Payload template ${record.id}`,
      typeLabel: workflowStepModes["payload-template"].detailLabel,
      metadata: [
        ["ID", record.id],
        ["Status", record.status || ""],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
      ].filter(([, value]) => value !== ""),
      sections: [
        {
          title: "Payload and resources",
          content: JSON.stringify(
            { payload: record.payload, resources: record.resources || [] },
            null,
            2,
          ),
        },
      ],
      raw: record,
    },
  }));
}

function buildWorkflowStepRows(records, payloadTemplates, outputSpecs) {
  const payloadsById = new Map(
    (payloadTemplates || []).map((record) => [
      String(record.id),
      record,
    ]),
  );
  const outputSpecsById = new Map(
    (outputSpecs || []).map((record) => [
      String(record.id),
      record,
    ]),
  );
  return (records || []).map((record) => {
    const payloadTemplate = payloadsById.get(
      String(record.payload_template_id),
    );
    const outputSpec = outputSpecsById.get(String(record.output_spec_id));

    return {
      id: String(record.id),
      name: record.name || `Workflow step ${record.id}`,
      type: "workflow-step",
      badgeLabel: record.step_executor_id || "Step",
      summaryFields: [
        record.executor_config?.model
          ? `Model: ${record.executor_config?.model}`
          : "",
        record.status ? `Status: ${record.status}` : "",
        record.created_at ? formatDate(record.created_at) : "",
      ].filter(Boolean),
      previewText: [
        record.payload_template_id
          ? `Payload: ${payloadTemplate?.name || record.payload_template_id}`
          : "",
        record.output_spec_id
          ? `Output: ${outputSpec?.name || record.output_spec_id}`
          : "",
      ]
        .filter(Boolean)
        .join(" • "),
      detail: {
        title: record.name || `Workflow step ${record.id}`,
        typeLabel: workflowStepModes["workflow-step"].detailLabel,
        metadata: [
          ["ID", record.id],
          ["Step executor", record.step_executor_id || ""],
          ["Method", record.method || ""],
          ["Model", record.executor_config?.model || ""],
          ["Status", record.status || ""],
          ["Payload template", record.payload_template_id || ""],
          ["Output specification", record.output_spec_id || ""],
          ["Created", record.created_at ? formatDate(record.created_at) : ""],
        ].filter(([, value]) => value !== ""),
        sections: [
          payloadTemplate
            ? {
                title: "Payload template",
                content: JSON.stringify(payloadTemplate, null, 2),
                collapsible: true,
              }
            : null,
          outputSpec
            ? {
                title: "Output specification",
                content: JSON.stringify(outputSpec, null, 2),
                collapsible: true,
              }
            : null,
        ].filter(Boolean),
        raw: record,
      },
    };
  });
}

function buildOutputSpecRows(records) {
  return (records || []).map((record) => ({
    id: String(record.id),
    name:
      record.name ||
      `Output specification ${record.id}`,
    type: "output-spec",
    badgeLabel: record.type || "Spec",
    summaryFields: [
      record.status ? `Status: ${record.status}` : "",
      record.created_at ? formatDate(record.created_at) : "",
    ].filter(Boolean),
    previewText: record.instructions || "",
    detail: {
      title:
        record.name ||
        `Output specification ${record.id}`,
      typeLabel: workflowStepModes["output-spec"].detailLabel,
      metadata: [
        ["ID", record.id],
        ["Type", record.type || ""],
        ["Status", record.status || ""],
        ["Created", record.created_at ? formatDate(record.created_at) : ""],
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

export function buildWorkflowSteps(catalogs) {
  return {
    "sample-set": buildSampleSetRows(catalogs.sampleSets),
    "derivative-group": buildDerivativeGroupRows(catalogs.derivativeGroups),
    "payload-template": buildPayloadTemplateRows(catalogs.payloadTemplates),
    "workflow-step": buildWorkflowStepRows(
      catalogs.workflowSteps,
      catalogs.payloadTemplates,
      catalogs.outputSpecs,
    ),
    "output-spec": buildOutputSpecRows(catalogs.outputSpecs),
  };
}

export function visibleWorkflowStepRows(workflowSteps, appliedFilters, type) {
  const normalizedType = normalizeWorkflowStepType(type);
  const rows = workflowSteps[normalizedType] || [];
  const filters =
    appliedFilters[normalizedType] || DEFAULT_WORKFLOW_STEP_FILTERS[normalizedType];

  if (normalizedType === "derivative-group") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText(
          [row.name, raw.description],
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
        containsText([row.name, raw.description], filters.query) &&
        (!filters.status || String(raw.status || "") === String(filters.status))
      );
    });
  }

  if (normalizedType === "payload-template") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText(
          [row.name, JSON.stringify(raw.payload || {})],
          filters.query,
        ) &&
        (!filters.status ||
          String(raw.status || "") === String(filters.status))
      );
    });
  }

  if (normalizedType === "workflow-step") {
    return rows.filter((row) => {
      const raw = row.detail.raw;
      return (
        containsText([row.name, raw.step_executor_id, raw.executor_config?.model], filters.query) &&
        (!filters.stepExecutor ||
          String(raw.step_executor_id || "") === String(filters.stepExecutor)) &&
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

export function workflowStepsFilterConfig(type, state, actions) {
  const normalizedType = normalizeWorkflowStepType(type);
  if (normalizedType === "derivative-group") {
    return [
      {
        id: "resource-derivative-group-search",
        label: "Search",
        kind: "text",
        value: state.filters["derivative-group"].query,
        placeholder: "Name or description",
        onChange: (value) =>
          actions.setFilterField("derivative-group", "query", value),
      },
      {
        id: "resource-derivative-group-mapping-type",
        label: "Mapping type",
        kind: "select",
        value: state.filters["derivative-group"].mappingType,
        onChange: (value) =>
          actions.setFilterField("derivative-group", "mappingType", value),
        options: [
          { value: "", label: "All mapping types" },
          ...sortedUnique(
            state.derivativeGroups.map((record) => record.mapping_type),
          ).map((value) => ({
            value,
            label: value,
          })),
        ],
      },
      {
        id: "resource-derivative-group-status",
        label: "Status",
        kind: "select",
        value: state.filters["derivative-group"].status,
        onChange: (value) =>
          actions.setFilterField("derivative-group", "status", value),
        options: [
          { value: "", label: "All statuses" },
          ...sortedUnique(
            state.derivativeGroups.map((record) => record.status),
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
        id: "resource-payload-template-status",
        label: "Status",
        kind: "select",
        value: state.filters["payload-template"].status,
        onChange: (value) =>
          actions.setFilterField("payload-template", "status", value),
        options: [
          { value: "", label: "All statuses" },
          ...sortedUnique(
            state.payloadTemplates.map((record) => record.status),
          ).map((value) => ({
            value,
            label: value,
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
        label: "Executor",
        kind: "select",
        value: state.filters["workflow-step"].stepExecutor,
        onChange: (value) =>
          actions.setFilterField("workflow-step", "stepExecutor", value),
        options: [
          { value: "", label: "All executors" },
          ...sortedUnique(
            state.workflowSteps.map((record) => record.step_executor_id),
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
            value: String(record.id),
            label:
              record.name ||
              String(record.id),
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
            value: String(record.id),
            label: record.name || String(record.id),
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
