"use client";

import { useEffect, useState } from "react";

import {
  CollapsibleSection,
  Button,
  EmptyState,
  Grid,
  Icon,
  IconButton,
  ListRow,
  LoadingPlaceholder,
  Panel,
  Select,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";

function metricValue(value) {
  return value == null || Number.isNaN(Number(value))
    ? "—"
    : Number(value).toFixed(3);
}

function errorColor(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) {
    return undefined;
  }

  const firstHalf = rate <= 0.5;
  const start = firstHalf ? [137, 207, 153] : [248, 204, 103];
  const end = firstHalf ? [248, 204, 103] : [244, 139, 130];
  const progress = Math.max(
    0,
    Math.min(1, firstHalf ? rate / 0.5 : (rate - 0.5) / 0.5),
  );
  const color = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * progress),
  );

  return `rgb(${color.join(" ")})`;
}

function MetricPanel({ label, values, tone, vertical }) {
  if (tone === "hallucinations") {
    return (
      <section className="analytics-metric-group">
        <h3>{label}</h3>
        <p className="analytics-coming-soon">Coming soon</p>
      </section>
    );
  }
  const items = [
    ["Min", values?.min],
    ["Max", values?.max],
    ["Avg", values?.mean],
  ];
  return (
    <section className="analytics-metric-group">
      <h3>{label}</h3>
      <div
        className={`analytics-metric-circles analytics-metric-circles--${tone}${
          vertical ? " analytics-metric-circles--vertical" : ""
        }`}
      >
        {items.map(([name, value]) => (
          <div
            className="analytics-metric-circle analytics-metric-circle--scored"
            key={name}
            style={{ "--metric-color": errorColor(value) }}
          >
            <span>{name}</span>
            <strong>{metricValue(value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowMetrics({ metrics, completedCount, sampleCount, compare }) {
  return (
    <Panel className="analytics-workflow-panel">
      <Grid columns={3}>
        <MetricPanel
          label="CER"
          values={metrics.cer}
          tone="cer"
          vertical={compare}
        />
        <MetricPanel
          label="WER"
          values={metrics.wer}
          tone="wer"
          vertical={compare}
        />
        <MetricPanel
          label="Hallucinations"
          values={metrics.hallucinations}
          tone="hallucinations"
          vertical={compare}
        />
      </Grid>
      <p className="analytics-completed-count">
        <strong>
          {completedCount} of {sampleCount} samples fully processed
        </strong>
      </p>
    </Panel>
  );
}

function WorkflowRow({ workflow, onDelete }) {
  const name = workflow.workflow_name || `Workflow ${workflow.workflow_id}`;
  const detail = [
    workflow.workflow_stage || workflow.stage,
    workflow.model_family,
    workflow.model,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <ListRow
      title={name}
      detail={detail || "No model details"}
      action={
        <IconButton
          label={`Delete workflow ${name}`}
          variant="danger"
          onClick={onDelete}
        >
          <Icon name="delete" />
        </IconButton>
      }
    />
  );
}

export function SampleSetAnalyticsPanel({
  workflow,
  sampleSet,
  sampleSetAnalytics,
  analyticsLoading = false,
  analyticsError = "",
  onDeleteWorkflow,
}) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [comparisonWorkflowId, setComparisonWorkflowId] = useState("");
  const [comparing, setComparing] = useState(false);
  const workflowsForSelection = sampleSetAnalytics?.workflows || [];
  useEffect(() => {
    setSelectedWorkflowId(String(workflowsForSelection[0]?.workflow_id || ""));
  }, [sampleSetAnalytics]);
  if (analyticsError) {
    return (
      <Panel title="Analytics">
        <EmptyState title="Analytics unavailable">{analyticsError}</EmptyState>
      </Panel>
    );
  }
  if (analyticsLoading) {
    return (
      <Panel title="Analytics">
        <LoadingPlaceholder label="Loading analytics" />
      </Panel>
    );
  }
  if (!sampleSetAnalytics) {
    return (
      <Panel title="Analytics">
        <EmptyState title="No analytics">
          {workflow
            ? "This sample set has no analytics yet."
            : "Select a sample set to view analytics."}
        </EmptyState>
      </Panel>
    );
  }

  const currentSet = sampleSet || sampleSetAnalytics.sample_set || {};
  const analyticsByWorkflow = sampleSetAnalytics.analytics_by_workflow || {};
  const workflows = sampleSetAnalytics.workflows || [];
  const sampleIds =
    sampleSetAnalytics.sample_ids || currentSet.sample_ids || [];
  const sampleCount = Number(currentSet.sample_count ?? sampleIds.length);
  const selectedAnalytics = analyticsByWorkflow[String(selectedWorkflowId)] || {
    metrics: {},
    completed_sample_count: 0,
  };
  const comparisonAnalytics = analyticsByWorkflow[
    String(comparisonWorkflowId || selectedWorkflowId)
  ] || {
    metrics: {},
    completed_sample_count: 0,
  };

  return (
    <Stack>
      <Panel
        eyebrow="Sample set"
        title={currentSet.sample_set_name || "Sample set"}
        actions={<StatusBadge>{sampleCount} samples</StatusBadge>}
      >
        <div className="analytics-workflow-controls">
          <Select
            value={selectedWorkflowId}
            onChange={(event) => setSelectedWorkflowId(event.target.value)}
          >
            {workflows.map((item) => (
              <option key={item.workflow_id} value={item.workflow_id}>
                {item.workflow_name || `Workflow ${item.workflow_id}`}
              </option>
            ))}
          </Select>
          {comparing ? (
            <>
              <span className="analytics-workflow-versus">vs.</span>
              <Select
                value={comparisonWorkflowId || selectedWorkflowId}
                onChange={(event) =>
                  setComparisonWorkflowId(event.target.value)
                }
              >
                {workflows.map((item) => (
                  <option key={item.workflow_id} value={item.workflow_id}>
                    {item.workflow_name || `Workflow ${item.workflow_id}`}
                  </option>
                ))}
              </Select>
              <Button size="compact" onClick={() => setComparing(false)}>
                Remove compare
              </Button>
            </>
          ) : (
            <Button size="compact" onClick={() => setComparing(true)}>
              + Compare
            </Button>
          )}
        </div>
      </Panel>
      <Grid columns={comparing ? 2 : 1}>
        <WorkflowMetrics
          metrics={selectedAnalytics.metrics}
          completedCount={selectedAnalytics.completed_sample_count}
          sampleCount={sampleCount}
          compare={comparing}
        />
        {comparing ? (
          <WorkflowMetrics
            metrics={comparisonAnalytics.metrics}
            completedCount={comparisonAnalytics.completed_sample_count}
            sampleCount={sampleCount}
            compare
          />
        ) : null}
      </Grid>
      <CollapsibleSection title="Workflows" count={workflows.length}>
        <Stack gap="compact">
          {workflows.length ? (
            workflows.map((item) => (
              <WorkflowRow
                key={item.workflow_id}
                workflow={item}
                onDelete={() =>
                  onDeleteWorkflow?.(
                    Number(item.workflow_id),
                    item.workflow_name || `Workflow ${item.workflow_id}`,
                  )
                }
              />
            ))
          ) : (
            <EmptyState title="No workflows" />
          )}
        </Stack>
      </CollapsibleSection>
      <CollapsibleSection title="Samples" count={sampleIds.length}>
        <Stack gap="compact">
          {sampleIds.length ? (
            sampleIds.map((sampleId) => (
              <ListRow key={sampleId} title={String(sampleId)} />
            ))
          ) : (
            <EmptyState title="No samples" />
          )}
        </Stack>
      </CollapsibleSection>
    </Stack>
  );
}
