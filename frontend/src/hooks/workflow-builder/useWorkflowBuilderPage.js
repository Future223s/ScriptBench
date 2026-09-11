"use client";

import { useEffect, useState } from "react";

import { workflowBuilderApi } from "../../api/endpoints/workflowBuilder.ts";
import { APP_DATA_CHANGED_EVENT } from "../../utils/appEvents.js";
import { defaultWorkflowDraft } from "../../utils/workflow.js";
import { useNotificationOverlay } from "../../components/layout/NotificationOverlay.js";

const INITIAL_CANVAS_ROWS = 3;
const INITIAL_CANVAS_COLS = 7;

function createEmptyWorkflowDraft() {
  return {
    ...defaultWorkflowDraft(),
    description: "",
  };
}

function normalizeStep(record) {
  return { ...record, id: String(record.id), name: record.name || `Workflow step ${record.id}` };
}

function normalizeNode(record, stepCatalog) {
  const step = stepCatalog.find((item) => Number(item.id) === Number(record.workflow_step_id));
  return {
    ...record,
    id: Number(record.id),
    label: step?.name || `Workflow step ${record.workflow_step_id}`,
    name: step?.name || `Workflow step ${record.workflow_step_id}`,
    step_executor_id: step?.step_executor_id,
    executor_config: step?.executor_config || {},
    description: step?.description || "",
    row: Number(record.row),
    col: Number(record.col),
  };
}

function normalizeEdge(record) {
  return {
    ...record,
    id: Number(record.id),
    from: Number(record.from_workflow_dag_node_id),
    to: Number(record.to_workflow_dag_node_id),
    condition: record.condition || { type: "depends_on" },
  };
}

function createInitialState() {
  return {
    loading: true,
    workflowLoading: false,
    error: "",
    notice: "",
    saving: false,
    finalizing: false,
    sampleSets: [],
    workflows: [],
    selectedWorkflowId: null,
    workflowDraft: createEmptyWorkflowDraft(),
    mode: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    detailOpen: false,
    detailNodeId: null,
    dependencySourceNodeId: null,
    dependencyTargetNodeId: null,
    assignmentOpen: false,
    assignmentMode: "existing",
    assignmentStepId: "",
    stepCatalog: [],
    nodes: [],
    edges: [],
  };
}

function getNextId(items) {
  return (
    items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1
  );
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
    assignmentOpen: false,
    assignmentMode: "existing",
  };
}

export function useWorkflowBuilderPage() {
  const { syncNotifications } = useNotificationOverlay() || {};
  const [state, setState] = useState(createInitialState);

  async function loadWorkflow(workflowId, stepCatalog = state.stepCatalog) {
    if (!workflowId) return;
    try {
      setState((current) => ({ ...current, workflowLoading: true, error: "" }));
      const [workflowResponse, nodesResponse, edgesResponse] =
        await Promise.all([
          workflowBuilderApi.getWorkflow(workflowId),
          workflowBuilderApi.getWorkflowDagNodes(workflowId),
          workflowBuilderApi.getWorkflowDagEdges(workflowId),
        ]);
      const workflow = workflowResponse.data;
      if (!workflow)
        throw new Error("Workflow response did not include workflow data.");
      setState((current) => ({
        ...current,
        workflowLoading: false,
        selectedWorkflowId: Number(workflow.id),
        workflowDraft: {
          ...current.workflowDraft,
          name: workflow.name || "",
          description: workflow.description || "",
          sample_set_id: workflow.sample_set_id || null,
          status: workflow.status || "draft",
        },
        nodes: (nodesResponse.items || []).map((node) =>
          normalizeNode(node, stepCatalog),
        ),
        edges: (edgesResponse.items || []).map(normalizeEdge),
        mode: null,
        selectedNodeId: null,
        selectedEdgeId: null,
        error: "",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        workflowLoading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function loadBuilderData() {
    try {
      const [sampleSetsResponse, workflowsResponse, stepsResponse] =
        await Promise.all([
          workflowBuilderApi.getSampleSets(),
          workflowBuilderApi.getWorkflows(),
          workflowBuilderApi.getWorkflowSteps(),
        ]);
      const sampleSets = sampleSetsResponse.items || [];
      const workflows = workflowsResponse.items || [];
      const stepCatalog = (stepsResponse.items || []).map(normalizeStep);
      const firstWorkflow = workflows[0] || null;
      setState((current) => ({
        ...current,
        loading: false,
        sampleSets,
        workflows,
        stepCatalog,
        assignmentStepId: current.assignmentStepId || stepCatalog[0]?.id || "",
        workflowDraft: {
          ...current.workflowDraft,
          sample_set_id:
            current.workflowDraft.sample_set_id ||
            Number(firstWorkflow?.sample_set_id) ||
            Number(sampleSets[0]?.id) ||
            null,
        },
      }));
      if (firstWorkflow) {
        await loadWorkflow(firstWorkflow.id, stepCatalog);
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  function setWorkflowDraftField(field, value) {
    setState((current) => ({
      ...current,
      workflowDraft: { ...current.workflowDraft, [field]: value },
    }));
  }

  function selectWorkflow(workflowId) {
    const normalizedId = Number(workflowId) || null;
    if (!normalizedId) {
      setState((current) => ({
        ...current,
        workflowLoading: false,
        selectedWorkflowId: null,
        workflowDraft: {
          ...createEmptyWorkflowDraft(),
          sample_set_id:
            current.workflowDraft.sample_set_id ||
            Number(current.sampleSets[0]?.id) ||
            null,
        },
        nodes: [],
        edges: [],
        mode: null,
        selectedNodeId: null,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        dependencySourceNodeId: null,
        dependencyTargetNodeId: null,
        assignmentOpen: false,
        assignmentMode: "existing",
        assignmentStepId:
          current.assignmentStepId || current.stepCatalog[0]?.id || "",
        error: "",
        notice: "New workflow ready.",
      }));
      return;
    }
    void loadWorkflow(normalizedId);
  }

  function selectNode(nodeId) {
    if (state.mode === "delete-step") {
      void confirmWorkflowStepDeletion(nodeId);
      return;
    }
    if (state.mode === "add-dependency") {
      const sourceNodeId = state.dependencySourceNodeId;
      if (!sourceNodeId || Number(sourceNodeId) === Number(nodeId)) {
        setState((current) => ({
          ...current,
          dependencySourceNodeId: nodeId,
          dependencyTargetNodeId: null,
          selectedNodeId: nodeId,
          selectedEdgeId: null,
          detailOpen: false,
          detailNodeId: null,
          error: "",
        }));
        return;
      }
      setState((current) => ({
        ...current,
        dependencyTargetNodeId: nodeId,
        selectedNodeId: nodeId,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
      }));
      void confirmDependencyAddition(sourceNodeId, nodeId);
      return;
    }
    setState((current) => ({
      ...current,
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
    }));
  }

  function selectWorkflowEdge(edgeId) {
    if (state.mode === "delete-dependency") {
      void confirmDependencyDeletion(edgeId);
      return;
    }
    setState((current) => ({
      ...current,
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      detailOpen: false,
      detailNodeId: null,
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

  function selectPlacementTarget(row, col) {
    setState((current) => ({
      ...current,
      selectedPlacement: { row, col },
      assignmentOpen: true,
      assignmentMode: "existing",
      assignmentStepId: current.assignmentStepId || current.stepCatalog[0]?.id || "",
      detailOpen: false,
      detailNodeId: null,
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
      assignmentStepId:
        current.assignmentStepId || current.stepCatalog[0]?.id || "",
      error: "",
    }));
  }

  function selectWorkflowStep(stepId) {
    setState((current) => ({ ...current, assignmentStepId: stepId }));
  }

  function setAssignmentMode(mode) {
    setState((current) => ({
      ...current,
      assignmentMode: mode === "create" ? "create" : "existing",
    }));
  }

  function enterGraphMode(mode) {
    setState((current) => ({
      ...current,
      mode,
      selectedNodeId: null,
      selectedEdgeId: null,
      detailOpen: false,
      detailNodeId: null,
      dependencySourceNodeId: null,
      dependencyTargetNodeId: null,
      assignmentOpen: false,
      assignmentMode: "existing",
      error: "",
    }));
  }

  function enterAddWorkflowStepMode() {
    enterGraphMode("add-step");
  }
  function enterAddDependencyMode() {
    enterGraphMode("add-dependency");
  }
  function enterDeleteWorkflowStepMode() {
    enterGraphMode("delete-step");
  }
  function enterDeleteDependencyMode() {
    enterGraphMode("delete-dependency");
  }
  function cancelCanvasAction() {
    setState((current) => resetCanvasSelections(current));
  }

  function resetCanvas() {
    setState((current) => ({
      ...resetCanvasSelections(current),
      nodes: [],
      edges: [],
    }));
  }

  async function submitWorkflowStepAssignment() {
    const current = state;
    if (!current.selectedPlacement) {
      setState((value) => ({ ...value, error: "Choose a canvas position first." }));
      return;
    }
    const selectedStep = current.stepCatalog.find(
      (step) => step.id === current.assignmentStepId,
    );
    if (!selectedStep) {
      setState((value) => ({
        ...value,
        error: "Choose a workflow step before confirming the placement.",
      }));
      return;
    }

    try {
      let nextNode;
      if (current.selectedWorkflowId) {
        const response = await workflowBuilderApi.createWorkflowDagNode(
          current.selectedWorkflowId,
          {
            workflow_step_id: Number(selectedStep.id),
            row: current.selectedPlacement.row,
            col: current.selectedPlacement.col,
          },
        );
        if (!response.data)
          throw new Error(
            "Workflow DAG node response did not include node data.",
          );
        nextNode = normalizeNode(response.data, current.stepCatalog);
      } else {
        const nodeId = getNextId(current.nodes);
        nextNode = normalizeNode(
          {
            id: nodeId,
            workflow_step_id: Number(selectedStep.id),
            row: current.selectedPlacement.row,
            col: current.selectedPlacement.col,
          },
          current.stepCatalog,
        );
      }
      setState((value) => ({
        ...value,
        nodes: [...value.nodes, nextNode],
        selectedNodeId: nextNode.id,
        selectedEdgeId: null,
        detailOpen: false,
        detailNodeId: null,
        assignmentOpen: false,
        mode: null,
        error: "",
        notice: `Added workflow step "${selectedStep.name}".`,
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const confirmWorkflowStepAddition = submitWorkflowStepAssignment;

  async function confirmWorkflowStepDeletion(nodeId = state.selectedNodeId) {
    const current = state;
    const normalizedNodeId = Number(nodeId);
    if (!normalizedNodeId) {
      setState((value) => ({
        ...value,
        error: "Select a workflow step to delete.",
      }));
      return;
    }
    try {
      if (current.selectedWorkflowId)
        await workflowBuilderApi.deleteWorkflowDagNode(
          current.selectedWorkflowId,
          [normalizedNodeId],
        );
      setState((value) => ({
        ...value,
        nodes: value.nodes.filter((node) => node.id !== normalizedNodeId),
        edges: value.edges.filter(
          (edge) =>
            edge.from !== normalizedNodeId && edge.to !== normalizedNodeId,
        ),
        selectedNodeId: null,
        selectedEdgeId: null,
        mode: null,
        error: "",
        notice: "Workflow step deleted.",
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function confirmDependencyAddition(
    sourceId = state.dependencySourceNodeId,
    targetId = state.dependencyTargetNodeId,
  ) {
    const current = state;
    const sourceNodeId = Number(sourceId);
    const targetNodeId = Number(targetId);
    if (!sourceNodeId || !targetNodeId) {
      setState((value) => ({
        ...value,
        error: "Select a source and destination workflow step.",
      }));
      return;
    }
    if (sourceNodeId === targetNodeId) {
      setState((value) => ({
        ...value,
        error: "Choose two different workflow steps.",
      }));
      return;
    }
    if (
      current.edges.some(
        (edge) =>
          Number(edge.from) === sourceNodeId &&
          Number(edge.to) === targetNodeId,
      )
    ) {
      setState((value) => ({
        ...value,
        error: "That dependency already exists.",
      }));
      return;
    }
    const sourceNode = current.nodes.find((node) => node.id === sourceNodeId);
    const targetNode = current.nodes.find((node) => node.id === targetNodeId);
    if (!sourceNode || !targetNode) {
      setState((value) => ({
        ...value,
        error: "Select valid workflow steps.",
      }));
      return;
    }
    try {
      let nextEdge;
      if (current.selectedWorkflowId) {
        const response = await workflowBuilderApi.createWorkflowDagEdge(
          current.selectedWorkflowId,
          {
            from_workflow_dag_node_id: sourceNodeId,
            to_workflow_dag_node_id: targetNodeId,
            condition: { type: "depends_on" },
          },
        );
        if (!response.data)
          throw new Error(
            "Workflow DAG edge response did not include edge data.",
          );
        nextEdge = normalizeEdge(response.data);
      } else {
        nextEdge = {
          id: getNextId(current.edges),
          from: sourceNodeId,
          to: targetNodeId,
          condition: { type: "depends_on" },
        };
      }
      setState((value) => ({
        ...value,
        edges: [...value.edges, nextEdge],
        selectedNodeId: null,
        selectedEdgeId: null,
        dependencySourceNodeId: null,
        dependencyTargetNodeId: null,
        mode: null,
        error: "",
        notice: `Linked "${sourceNode.label}" to "${targetNode.label}".`,
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function confirmDependencyDeletion(edgeId = state.selectedEdgeId) {
    const current = state;
    const normalizedEdgeId = Number(edgeId);
    if (!normalizedEdgeId) {
      setState((value) => ({
        ...value,
        error: "Select a dependency edge to delete.",
      }));
      return;
    }
    try {
      if (current.selectedWorkflowId)
        await workflowBuilderApi.deleteWorkflowDagEdge(
          current.selectedWorkflowId,
          normalizedEdgeId,
        );
      setState((value) => ({
        ...value,
        edges: value.edges.filter((edge) => edge.id !== normalizedEdgeId),
        selectedEdgeId: null,
        mode: null,
        error: "",
        notice: "Dependency deleted.",
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function saveWorkflow() {
    const current = state;
    const sampleSetId = Number(current.workflowDraft.sample_set_id) || null;
    if (!sampleSetId) {
      setState((value) => ({
        ...value,
        error: "Select a sample set before saving.",
      }));
      return;
    }
    if (!String(current.workflowDraft.name || "").trim()) {
      setState((value) => ({ ...value, error: "Workflow name is required." }));
      return;
    }
    if (current.selectedWorkflowId) {
      try {
        setState((value) => ({ ...value, saving: true, error: "" }));
        const response = await workflowBuilderApi.saveWorkflow(
          current.selectedWorkflowId,
          {
            name: current.workflowDraft.name.trim(),
            description:
              current.workflowDraft.description.trim() || null,
            sample_set_id: sampleSetId,
          },
        );
        if (!response.data)
          throw new Error(
            "Workflow save response did not include workflow data.",
          );
        setState((value) => ({
          ...value,
          saving: false,
          workflows: value.workflows.map((workflow) =>
            workflow.id === response.data.id
              ? response.data
              : workflow,
          ),
          notice: "Workflow saved.",
        }));
      } catch (error) {
        setState((value) => ({
          ...value,
          saving: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
      return;
    }
    try {
      setState((value) => ({ ...value, saving: true, error: "" }));
      const createdResponse = await workflowBuilderApi.createWorkflow({
        name: current.workflowDraft.name.trim(),
        description:
          current.workflowDraft.description.trim() || null,
        sample_set_id: sampleSetId,
        status: "draft",
      });
      const workflow = createdResponse.data;
      if (!workflow)
        throw new Error("Workflow response did not include workflow data.");
      const nodeIdMap = new Map();
      for (const node of current.nodes) {
        const response = await workflowBuilderApi.createWorkflowDagNode(
          workflow.id,
          {
            workflow_step_id: node.workflow_step_id,
            row: node.row,
            col: node.col,
          },
        );
        if (!response.data)
          throw new Error(
            "Workflow DAG node response did not include node data.",
          );
        nodeIdMap.set(node.id, response.data.id);
      }
      for (const edge of current.edges) {
        await workflowBuilderApi.createWorkflowDagEdge(workflow.id, {
          from_workflow_dag_node_id: nodeIdMap.get(edge.from),
          to_workflow_dag_node_id: nodeIdMap.get(edge.to),
          condition: edge.condition || { type: "depends_on" },
        });
      }
      setState((value) => ({
        ...value,
        saving: false,
        workflows: [...value.workflows, workflow],
        selectedWorkflowId: workflow.id,
        notice: "Workflow saved.",
      }));
      await loadWorkflow(workflow.id, current.stepCatalog);
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    } catch (error) {
      setState((value) => ({
        ...value,
        saving: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function finalizeWorkflow() {
    const workflowId = Number(state.selectedWorkflowId) || null;
    if (!workflowId) {
      setState((value) => ({
        ...value,
        error: "Save the workflow before finalizing it.",
      }));
      return;
    }

    try {
      setState((value) => ({ ...value, finalizing: true, error: "" }));
      const response = await workflowBuilderApi.finalizeWorkflow(workflowId);
      if (!response.data)
        throw new Error(
          "Workflow finalize response did not include workflow data.",
        );
      setState((value) => ({
        ...value,
        finalizing: false,
        workflowDraft: { ...value.workflowDraft, status: response.data.status },
        workflows: value.workflows.map((workflow) =>
          workflow.id === response.data.id
            ? response.data
            : workflow,
        ),
        notice: "Workflow finalized.",
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        finalizing: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  useEffect(() => {
    void loadBuilderData();
    function handleDataChanged() {
      void loadBuilderData();
    }
    window.addEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
    return () =>
      window.removeEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged);
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
      selectWorkflow,
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
      submitWorkflowStepAssignment,
      confirmWorkflowStepAddition,
      confirmWorkflowStepDeletion,
      confirmDependencyAddition,
      confirmDependencyDeletion,
      saveWorkflow,
      finalizeWorkflow,
    },
  };
}
