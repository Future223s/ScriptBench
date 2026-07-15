"use client";

import { useEffect, useState } from "react";

import { workflowBuilderApi } from "../../api/endpoints/workflowBuilder.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { buildWorkflowPayload, defaultBatchItemSchemaEntries, defaultWorkflowDraft } from "../../utils/workflow.js";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";

const INITIAL_CANVAS_ROWS = 3;
const INITIAL_CANVAS_COLS = 7;

function createEmptyWorkflowDraft() {
  return {
    ...defaultWorkflowDraft(),
    workflow_description: "",
  };
}

function createStepCatalog() {
  return [
    {
      id: "step-intake",
      name: "Sample Intake",
      version: 1,
      model_family: "gemini",
      model: "gemini-3-flash-preview",
      description: "Collect the selected sample set and prepare the first branch in the workflow.",
      payload_template_id: "template-intake",
      output_spec_id: "output-json",
    },
    {
      id: "step-transcribe",
      name: "Transcription",
      version: 1,
      model_family: "gemini",
      model: "gemini-3-pro-preview",
      description: "Run the transcription model against the current batch.",
      payload_template_id: "template-transcribe",
      output_spec_id: "output-json",
    },
    {
      id: "step-review",
      name: "Quality Review",
      version: 1,
      model_family: "claude",
      model: "claude-sonnet-4",
      description: "Inspect the transcript and capture cleanup notes before saving.",
      payload_template_id: "template-review",
      output_spec_id: "output-text",
    },
  ];
}

function createPayloadTemplates() {
  return [
    {
      id: "template-intake",
      name: "Intake template",
      description: "Kick off the workflow with sample metadata and the source text.",
      inputs: [
        { name: "sample_text", description: "Primary text payload for the model." },
        { name: "sample_id", description: "Stable identifier for the sample." },
      ],
    },
    {
      id: "template-transcribe",
      name: "Transcription template",
      description: "Send the transcription target text and sample identity to the model.",
      inputs: [
        { name: "sample_text", description: "Primary text payload for the model." },
        { name: "sample_id", description: "Stable identifier for the sample." },
      ],
    },
    {
      id: "template-review",
      name: "Review template",
      description: "Ask the reviewer step to normalize and flag problems.",
      inputs: [
        { name: "transcription_text", description: "The generated transcription content." },
        { name: "review_notes", description: "Human review comments or corrections." },
      ],
    },
  ];
}

function createOutputSpecifications() {
  return [
    {
      id: "output-json",
      name: "Structured JSON output",
      description: "A list of normalized output rows.",
      format_type: "json_array",
      fields: [
        { name: "sample_id", description: "Sample identifier." },
        { name: "output_text", description: "Generated output text." },
        { name: "confidence", description: "Confidence score for the step output." },
      ],
    },
    {
      id: "output-text",
      name: "Plain text output",
      description: "A compact text result for downstream inspection.",
      format_type: "plain_text",
      fields: [
        { name: "output_text", description: "Final text emitted by the step." },
      ],
    },
  ];
}

function createStepWizardDraft() {
  return {
    step_name: "",
    step_description: "",
    payload_template_mode: "existing",
    payload_template_id: "template-intake",
    payload_template_name: "",
    payload_template_description: "",
    payload_template_inputs: [
      { name: "sample_text", description: "Primary text payload for the model." },
      { name: "sample_id", description: "Stable identifier for the sample." },
    ],
    output_spec_mode: "existing",
    output_spec_id: "output-json",
    output_spec_name: "",
    output_spec_description: "",
    output_spec_fields: [
      { name: "sample_id", description: "Sample identifier." },
      { name: "output_text", description: "Generated output text." },
      { name: "confidence", description: "Confidence score for the step output." },
    ],
  };
}

function createInitialState() {
  return {
    loading: true,
    error: "",
    notice: "",
    saving: false,
    sampleSets: [],
    workflowDraft: createEmptyWorkflowDraft(),
    mode: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    detailOpen: false,
    detailNodeId: null,
    dependencySourceNodeId: null,
    dependencyTargetNodeId: null,
    selectedPlacement: null,
    assignmentOpen: false,
    assignmentMode: "existing",
    assignmentStepId: "step-transcribe",
    stepCatalog: createStepCatalog(),
    payloadTemplates: createPayloadTemplates(),
    outputSpecifications: createOutputSpecifications(),
    nodes: [],
    edges: [],
    wizardOpen: false,
    wizardStep: 0,
    wizardDraft: createStepWizardDraft(),
  };
}

function createCanvasState() {
  return {
    mode: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    detailOpen: false,
    detailNodeId: null,
    dependencySourceNodeId: null,
    dependencyTargetNodeId: null,
    selectedPlacement: null,
    assignmentOpen: false,
    assignmentMode: "existing",
    assignmentStepId: "step-transcribe",
    stepCatalog: createStepCatalog(),
    payloadTemplates: createPayloadTemplates(),
    outputSpecifications: createOutputSpecifications(),
    nodes: [],
    edges: [],
    wizardOpen: false,
    wizardStep: 0,
    wizardDraft: createStepWizardDraft(),
  };
}

function getNextId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function summarizeGraph(state) {
  const nodeSummary = state.nodes.length
    ? state.nodes.map((node) => `${node.label} at row ${node.row}, column ${node.col}`).join("; ")
    : "No workflow steps yet.";
  const edgeSummary = state.edges.length
    ? state.edges
        .map((edge) => {
          const fromNode = state.nodes.find((node) => node.id === edge.from);
          const toNode = state.nodes.find((node) => node.id === edge.to);
          if (!fromNode || !toNode) return "";
          return `${fromNode.label} -> ${toNode.label}`;
        })
        .filter(Boolean)
        .join("; ")
    : "No dependencies yet";

  return `Workflow canvas summary: ${nodeSummary}\nDependencies: ${edgeSummary}`;
}

function createSaveDraft(state) {
  const selectedSampleSet = state.sampleSets.find((sampleSet) => Number(sampleSet.sample_set_id) === Number(state.workflowDraft.sample_set_id)) || null;
  const selectedNode = state.nodes.find((node) => Number(node.id) === Number(state.selectedNodeId)) || state.nodes[0] || null;
  const selectedOutputSpec = selectedNode
    ? state.outputSpecifications.find((spec) => spec.id === selectedNode.output_spec_id) || state.outputSpecifications[0] || null
    : state.outputSpecifications[0] || null;
  const itemSchemaEntries = selectedOutputSpec?.fields?.length
    ? selectedOutputSpec.fields.map((field) => ({
        field: field.name,
        description: field.description,
      }))
    : defaultBatchItemSchemaEntries();

  return {
    ...state.workflowDraft,
    instructions: [
      String(state.workflowDraft.workflow_description || "").trim(),
      summarizeGraph(state),
      selectedSampleSet?.sample_set_name ? `Sample set: ${selectedSampleSet.sample_set_name}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    examples: state.nodes.map((node) => {
      const payloadTemplate = state.payloadTemplates.find((template) => template.id === node.payload_template_id) || null;
      const inputSummary = Array.isArray(payloadTemplate?.inputs)
        ? payloadTemplate.inputs.map((input) => input.name).filter(Boolean).join(", ")
        : "";

      return {
        title: node.label,
        instruction_text: node.description || payloadTemplate?.description || "",
        assets: inputSummary,
      };
    }),
    output_format_type: selectedOutputSpec?.format_type || "json_array",
    item_schema_entries: itemSchemaEntries,
    sample_ids: Array.isArray(selectedSampleSet?.sample_ids) ? [...selectedSampleSet.sample_ids] : [],
  };
}

function resetCanvasSelections(current) {
  return {
    ...current,
    mode: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    detailOpen: false,
    detailNodeId: null,
    dependencySourceNodeId: null,
    dependencyTargetNodeId: null,
    selectedPlacement: null,
    assignmentOpen: false,
    assignmentMode: "existing",
  };
}

export function useWorkflowBuilderPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [state, setState] = useState(createInitialState);

  async function loadSampleSets() {
    try {
      const response = await workflowBuilderApi.getSampleSets();
      const sampleSets = response.sample_sets || [];
      setState((current) => {
        const nextWorkflowDraft = { ...current.workflowDraft };
        if (!nextWorkflowDraft.sample_set_id && sampleSets.length) {
          nextWorkflowDraft.sample_set_id = Number(sampleSets[0].sample_set_id) || null;
        }
        return {
          ...current,
          loading: false,
          sampleSets,
          workflowDraft: nextWorkflowDraft,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        sampleSets: [],
      }));
    }
  }

  function setWorkflowDraftField(field, value) {
    setState((current) => ({
      ...current,
      workflowDraft: {
        ...current.workflowDraft,
        [field]: value,
      },
    }));
  }

  function selectNode(nodeId) {
    setState((current) => {
      if (current.mode === "add-dependency") {
        if (!current.dependencySourceNodeId || Number(current.dependencySourceNodeId) === Number(nodeId)) {
          return {
            ...current,
            dependencySourceNodeId: nodeId,
            dependencyTargetNodeId: null,
            selectedNodeId: nodeId,
            selectedEdgeId: null,
            detailOpen: false,
            detailNodeId: null,
          };
        }

        return {
          ...current,
          dependencyTargetNodeId: nodeId,
          selectedNodeId: nodeId,
          selectedEdgeId: null,
          detailOpen: false,
          detailNodeId: null,
        };
      }

      return {
        ...current,
        selectedNodeId: nodeId,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
      };
    });
  }

  function selectWorkflowEdge(edgeId) {
    setState((current) => ({
      ...current,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      detailOpen: false,
      detailNodeId: null,
    }));
  }

  function selectPlacementTarget(row, col) {
    setState((current) => ({
      ...current,
      selectedPlacement: { row, col },
      assignmentOpen: true,
      assignmentMode: "existing",
      detailOpen: false,
      detailNodeId: null,
      assignmentStepId: current.assignmentStepId || current.stepCatalog[0]?.id || "",
      error: "",
    }));
  }

  function openNodeDetail(nodeId) {
    setState((current) => ({
      ...current,
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      detailOpen: true,
      detailNodeId: nodeId,
      error: "",
    }));
  }

  function closeNodeDetail() {
    setState((current) => ({
      ...current,
      detailOpen: false,
      detailNodeId: null,
    }));
  }

  function openWorkflowStepAssignment() {
    setState((current) => ({
      ...current,
      assignmentOpen: true,
      assignmentMode: "existing",
    }));
  }

  function selectWorkflowStep(stepId) {
    setState((current) => ({
      ...current,
      assignmentStepId: stepId,
    }));
  }

  function setAssignmentMode(mode) {
    setState((current) => ({
      ...current,
      assignmentMode: mode === "create" ? "create" : "existing",
    }));
  }

  function enterAddWorkflowStepMode() {
    setState((current) => ({
      ...current,
      mode: "add-step",
      selectedNodeId: null,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
      dependencySourceNodeId: null,
      dependencyTargetNodeId: null,
      selectedPlacement: null,
      assignmentOpen: false,
      assignmentMode: "existing",
      error: "",
    }));
  }

  function enterAddDependencyMode() {
    setState((current) => ({
      ...current,
      mode: "add-dependency",
      selectedNodeId: null,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
      dependencySourceNodeId: null,
      dependencyTargetNodeId: null,
      selectedPlacement: null,
      assignmentOpen: false,
      assignmentMode: "existing",
      error: "",
    }));
  }

  function enterDeleteWorkflowStepMode() {
    setState((current) => ({
      ...current,
      mode: "delete-step",
      selectedNodeId: null,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
      dependencySourceNodeId: null,
      dependencyTargetNodeId: null,
      selectedPlacement: null,
      assignmentOpen: false,
      assignmentMode: "existing",
      error: "",
    }));
  }

  function enterDeleteDependencyMode() {
    setState((current) => ({
      ...current,
      mode: "delete-dependency",
      selectedNodeId: null,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
      dependencySourceNodeId: null,
      dependencyTargetNodeId: null,
      selectedPlacement: null,
      assignmentOpen: false,
      assignmentMode: "existing",
      error: "",
    }));
  }

  function cancelCanvasAction() {
    setState((current) => resetCanvasSelections(current));
  }

  function resetCanvas() {
    setState((current) => ({
      ...current,
      ...createCanvasState(),
    }));
  }

  function openWorkflowStepCreationWizard() {
    setState((current) => ({
      ...current,
      wizardOpen: true,
      wizardStep: 0,
      wizardDraft: createStepWizardDraft(),
      error: "",
    }));
  }

  function closeWorkflowStepCreationWizard() {
    setState((current) => ({
      ...current,
      wizardOpen: false,
      wizardStep: 0,
    }));
  }

  function nextWorkflowStepCreationWizardStep() {
    setState((current) => ({
      ...current,
      wizardStep: Math.min(2, current.wizardStep + 1),
      error: "",
    }));
  }

  function previousWorkflowStepCreationWizardStep() {
    setState((current) => ({
      ...current,
      wizardStep: Math.max(0, current.wizardStep - 1),
    }));
  }

  function setStepWizardField(field, value) {
    setState((current) => ({
      ...current,
      wizardDraft: {
        ...current.wizardDraft,
        [field]: value,
      },
    }));
  }

  function setStepWizardPayloadTemplateField(field, value) {
    setState((current) => ({
      ...current,
      wizardDraft: {
        ...current.wizardDraft,
        [field]: value,
      },
    }));
  }

  function setStepWizardOutputSpecField(field, value) {
    setState((current) => ({
      ...current,
      wizardDraft: {
        ...current.wizardDraft,
        [field]: value,
      },
    }));
  }

  function createStepWizardPayloadTemplate() {
    setState((current) => {
      const payloadTemplateName = String(current.wizardDraft.payload_template_name || "").trim();
      if (!payloadTemplateName) {
        return {
          ...current,
          error: "Payload template name is required.",
        };
      }

      const nextPayloadTemplates = [...current.payloadTemplates];
      const payloadTemplateId = `template-${getNextId(nextPayloadTemplates)}`;
      nextPayloadTemplates.push({
        id: payloadTemplateId,
        name: payloadTemplateName,
        description: String(current.wizardDraft.payload_template_description || "").trim(),
        inputs: current.wizardDraft.payload_template_inputs
          .map((input) => ({
            name: String(input.name || "").trim(),
            description: String(input.description || "").trim(),
          }))
          .filter((input) => input.name && input.description),
      });

      return {
        ...current,
        payloadTemplates: nextPayloadTemplates,
        wizardDraft: {
          ...current.wizardDraft,
          payload_template_mode: "existing",
          payload_template_id: payloadTemplateId,
          payload_template_name: "",
          payload_template_description: "",
          payload_template_inputs: [
            { name: "sample_text", description: "Primary text payload for the model." },
            { name: "sample_id", description: "Stable identifier for the sample." },
          ],
        },
        error: "",
        notice: `Created payload template "${payloadTemplateName}".`,
      };
    });
  }

  function addStepWizardPayloadTemplateInput() {
    setState((current) => ({
      ...current,
      wizardDraft: {
        ...current.wizardDraft,
        payload_template_inputs: [...current.wizardDraft.payload_template_inputs, { name: "", description: "" }],
      },
    }));
  }

  function updateStepWizardPayloadTemplateInput(index, field, value) {
    setState((current) => {
      const payloadTemplateInputs = [...current.wizardDraft.payload_template_inputs];
      payloadTemplateInputs[index] = {
        ...payloadTemplateInputs[index],
        [field]: value,
      };
      return {
        ...current,
        wizardDraft: {
          ...current.wizardDraft,
          payload_template_inputs: payloadTemplateInputs,
        },
      };
    });
  }

  function removeStepWizardPayloadTemplateInput(index) {
    setState((current) => {
      const payloadTemplateInputs = [...current.wizardDraft.payload_template_inputs];
      payloadTemplateInputs.splice(index, 1);
      if (!payloadTemplateInputs.length) {
        payloadTemplateInputs.push({ name: "", description: "" });
      }
      return {
        ...current,
        wizardDraft: {
          ...current.wizardDraft,
          payload_template_inputs: payloadTemplateInputs,
        },
      };
    });
  }

  function addStepWizardOutputSpecField() {
    setState((current) => ({
      ...current,
      wizardDraft: {
        ...current.wizardDraft,
        output_spec_fields: [...current.wizardDraft.output_spec_fields, { name: "", description: "" }],
      },
    }));
  }

  function updateStepWizardOutputSpecField(index, field, value) {
    setState((current) => {
      const outputSpecFields = [...current.wizardDraft.output_spec_fields];
      outputSpecFields[index] = {
        ...outputSpecFields[index],
        [field]: value,
      };
      return {
        ...current,
        wizardDraft: {
          ...current.wizardDraft,
          output_spec_fields: outputSpecFields,
        },
      };
    });
  }

  function removeStepWizardOutputSpecField(index) {
    setState((current) => {
      const outputSpecFields = [...current.wizardDraft.output_spec_fields];
      outputSpecFields.splice(index, 1);
      if (!outputSpecFields.length) {
        outputSpecFields.push({ name: "", description: "" });
      }
      return {
        ...current,
        wizardDraft: {
          ...current.wizardDraft,
          output_spec_fields: outputSpecFields,
        },
      };
    });
  }

  function submitWorkflowStepAssignment() {
    setState((current) => {
      if (!current.selectedPlacement) {
        return {
          ...current,
          error: "Select a placement square first.",
        };
      }

      const selectedStep = current.stepCatalog.find((step) => step.id === current.assignmentStepId) || null;
      if (!selectedStep) {
        return {
          ...current,
          error: "Choose a workflow step before confirming the placement.",
        };
      }

      const payloadTemplate = current.payloadTemplates.find((template) => template.id === selectedStep.payload_template_id) || null;
      const outputSpec = current.outputSpecifications.find((spec) => spec.id === selectedStep.output_spec_id) || null;
      if (!payloadTemplate || !outputSpec) {
        return {
          ...current,
          error: "The selected step is missing a payload template or output specification.",
        };
      }

      const nodeId = getNextId(current.nodes);
      const nextNode = {
        id: nodeId,
        label: selectedStep.name,
        step_name: selectedStep.name,
        version: Number(selectedStep.version) || 1,
        model_family: selectedStep.model_family,
        model: selectedStep.model,
        description: selectedStep.description,
        row: current.selectedPlacement.row,
        col: current.selectedPlacement.col,
        payload_template_id: selectedStep.payload_template_id,
        output_spec_id: selectedStep.output_spec_id,
      };

      return {
        ...current,
        nodes: [...current.nodes, nextNode],
        selectedNodeId: nodeId,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        selectedPlacement: null,
        assignmentOpen: false,
        error: "",
        notice: `Added workflow step "${selectedStep.name}".`,
      };
    });
  }

  function confirmWorkflowStepAddition() {
    submitWorkflowStepAssignment();
  }

  function confirmWorkflowStepDeletion() {
    setState((current) => {
      if (!current.selectedNodeId) {
        return {
          ...current,
          error: "Select a workflow step to delete.",
        };
      }

      const nodeId = Number(current.selectedNodeId);
      const remainingNodes = current.nodes.filter((node) => node.id !== nodeId);
      const remainingEdges = current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);

      return {
        ...current,
        nodes: remainingNodes,
        edges: remainingEdges,
        selectedNodeId: null,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        dependencySourceNodeId: null,
        dependencyTargetNodeId: null,
        error: "",
        notice: "Workflow step deleted.",
      };
    });
  }

  function confirmDependencyAddition() {
    setState((current) => {
      const sourceNodeId = Number(current.dependencySourceNodeId);
      const targetNodeId = Number(current.dependencyTargetNodeId);
      if (!sourceNodeId || !targetNodeId) {
        return {
          ...current,
          error: "Select a source and destination workflow step.",
        };
      }
      if (sourceNodeId === targetNodeId) {
        return {
          ...current,
          error: "Choose two different workflow steps.",
        };
      }
      if (current.edges.some((edge) => edge.from === sourceNodeId && edge.to === targetNodeId)) {
        return {
          ...current,
          error: "That dependency already exists.",
        };
      }

      const sourceNode = current.nodes.find((node) => node.id === sourceNodeId) || null;
      const targetNode = current.nodes.find((node) => node.id === targetNodeId) || null;
      if (!sourceNode || !targetNode) {
        return {
          ...current,
          error: "Select valid workflow steps.",
        };
      }

      return {
        ...current,
        edges: [...current.edges, { id: getNextId(current.edges), from: sourceNodeId, to: targetNodeId, edge_condition: "depends_on" }],
        selectedNodeId: null,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        dependencySourceNodeId: null,
        dependencyTargetNodeId: null,
        error: "",
        notice: `Linked "${sourceNode.label}" to "${targetNode.label}".`,
      };
    });
  }

  function confirmDependencyDeletion() {
    setState((current) => {
      if (!current.selectedEdgeId) {
        return {
          ...current,
          error: "Select a dependency edge to delete.",
        };
      }

      return {
        ...current,
        edges: current.edges.filter((edge) => edge.id !== Number(current.selectedEdgeId)),
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        error: "",
        notice: "Dependency deleted.",
      };
    });
  }

  async function saveWorkflow() {
    setState((current) => ({
      ...current,
      saving: true,
      error: "",
    }));

    try {
      const payload = buildWorkflowPayload(createSaveDraft(state), state.sampleSets);
      if (!payload.sample_set_id) {
        setState((current) => ({
          ...current,
          saving: false,
          error: "Select a sample set before saving.",
        }));
        return;
      }

      await workflowBuilderApi.createWorkflow(payload);
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
      setState((current) => ({
        ...current,
        saving: false,
        notice: "Workflow saved.",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  function submitWorkflowStepCreation() {
    setState((current) => {
      const stepName = String(current.wizardDraft.step_name || "").trim();
      if (!stepName) {
        return {
          ...current,
          error: "Workflow step name is required.",
        };
      }

      const payloadTemplateName = current.wizardDraft.payload_template_mode === "new"
        ? String(current.wizardDraft.payload_template_name || "").trim()
        : String(current.payloadTemplates.find((template) => template.id === current.wizardDraft.payload_template_id)?.name || "").trim();
      if (!payloadTemplateName) {
        return {
          ...current,
          error: "Payload template name is required.",
        };
      }

      const outputSpecName = current.wizardDraft.output_spec_mode === "new"
        ? String(current.wizardDraft.output_spec_name || "").trim()
        : String(current.outputSpecifications.find((spec) => spec.id === current.wizardDraft.output_spec_id)?.name || "").trim();
      if (!outputSpecName) {
        return {
          ...current,
          error: "Output specification name is required.",
        };
      }

      const nextPayloadTemplates = [...current.payloadTemplates];
      const nextOutputSpecifications = [...current.outputSpecifications];

      const payloadTemplateId = current.wizardDraft.payload_template_mode === "new"
        ? `template-${getNextId(nextPayloadTemplates)}`
        : current.wizardDraft.payload_template_id;
      const outputSpecId = current.wizardDraft.output_spec_mode === "new"
        ? `output-${getNextId(nextOutputSpecifications)}`
        : current.wizardDraft.output_spec_id;

      if (current.wizardDraft.payload_template_mode === "new") {
        nextPayloadTemplates.push({
          id: payloadTemplateId,
          name: payloadTemplateName,
          description: String(current.wizardDraft.payload_template_description || "").trim(),
          inputs: current.wizardDraft.payload_template_inputs
            .map((input) => ({
              name: String(input.name || "").trim(),
              description: String(input.description || "").trim(),
            }))
            .filter((input) => input.name && input.description),
        });
      }

      if (current.wizardDraft.output_spec_mode === "new") {
        nextOutputSpecifications.push({
          id: outputSpecId,
          name: outputSpecName,
          description: String(current.wizardDraft.output_spec_description || "").trim(),
          format_type: "json_array",
          fields: current.wizardDraft.output_spec_fields
            .map((field) => ({
              name: String(field.name || "").trim(),
              description: String(field.description || "").trim(),
            }))
            .filter((field) => field.name && field.description),
        });
      }

      const nextStepId = `step-${getNextId(current.stepCatalog)}`;
      const nextStep = {
        id: nextStepId,
        name: stepName,
        version: 1,
        model_family: "gemini",
        model: "gemini-3-flash-preview",
        description: String(current.wizardDraft.step_description || "").trim(),
        payload_template_id: payloadTemplateId,
        output_spec_id: outputSpecId,
      };

      return {
        ...current,
        payloadTemplates: nextPayloadTemplates,
        outputSpecifications: nextOutputSpecifications,
        stepCatalog: [...current.stepCatalog, nextStep],
        assignmentOpen: true,
        assignmentMode: "existing",
        assignmentStepId: nextStepId,
        detailOpen: false,
        detailNodeId: null,
        wizardOpen: false,
        wizardStep: 0,
        wizardDraft: createStepWizardDraft(),
        error: "",
        notice: `Created workflow step "${stepName}".`,
      };
    });
  }

  useEffect(() => {
    void loadSampleSets();

    function handleDataChanged() {
      void loadSampleSets();
    }

    window.addEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      window.removeEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    };
  }, []);

  useEffect(() => {
    if (!syncNotifications) return undefined;

    syncNotifications("workflow-builder-page", [
      { kind: "error", message: state.error },
      { kind: "success", message: state.notice },
    ]);
  }, [syncNotifications, state.error, state.notice]);

  return {
    state: {
      ...state,
      initialCanvasRows: INITIAL_CANVAS_ROWS,
      initialCanvasCols: INITIAL_CANVAS_COLS,
    },
    actions: {
      setWorkflowDraftField,
      selectNode,
      selectWorkflowEdge,
      selectPlacementTarget,
      openNodeDetail,
      closeNodeDetail,
      openWorkflowStepAssignment,
      setAssignmentMode,
      selectWorkflowStep,
      enterAddWorkflowStepMode,
      enterAddDependencyMode,
      enterDeleteWorkflowStepMode,
      enterDeleteDependencyMode,
      cancelCanvasAction,
      resetCanvas,
      openWorkflowStepCreationWizard,
      closeWorkflowStepCreationWizard,
      nextWorkflowStepCreationWizardStep,
      previousWorkflowStepCreationWizardStep,
      setStepWizardField,
      setStepWizardPayloadTemplateField,
      setStepWizardOutputSpecField,
      createStepWizardPayloadTemplate,
      addStepWizardPayloadTemplateInput,
      updateStepWizardPayloadTemplateInput,
      removeStepWizardPayloadTemplateInput,
      addStepWizardOutputSpecField,
      updateStepWizardOutputSpecField,
      removeStepWizardOutputSpecField,
      submitWorkflowStepAssignment,
      confirmWorkflowStepAddition,
      confirmWorkflowStepDeletion,
      confirmDependencyAddition,
      confirmDependencyDeletion,
      saveWorkflow,
      submitWorkflowStepCreation,
    },
  };
}
