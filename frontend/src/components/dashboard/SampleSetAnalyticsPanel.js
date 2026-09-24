"use client";

import { useEffect, useState } from "react";

import {
  CollapsibleSection,
  Button,
  DataTable,
  EmptyState,
  Icon,
  IconButton,
  LoadingPlaceholder,
  Panel,
  Select,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";

function metricValue(value) {
  return value == null || Number.isNaN(Number(value))
    ? "—"
    : Number(value).toFixed(3);
}

function axisValue(value) {
  const precision = Math.abs(value) < 1 ? 2 : Math.abs(value) < 10 ? 1 : 0;
  return String(Number(value.toFixed(precision)));
}

function boxPlotValues(summary) {
  const min = Number(summary?.min);
  const max = Number(summary?.max);
  const median = Number(summary?.median ?? summary?.mean);
  const mean = summary?.mean == null ? null : Number(summary.mean);
  if (![min, max, median].every(Number.isFinite)) return null;

  const q1 = Number(summary?.q1);
  const q3 = Number(summary?.q3);
  return {
    min,
    q1: Number.isFinite(q1) ? q1 : (min + median) / 2,
    median,
    mean: mean != null && Number.isFinite(mean) ? mean : null,
    q3: Number.isFinite(q3) ? q3 : (median + max) / 2,
    max,
  };
}

function axisStep(maximum) {
  const candidates = [
    0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100,
    250, 500, 1000,
  ];
  const targetIntervals = 5;
  return candidates.reduce((best, candidate) => {
    const count = Math.ceil(maximum / candidate);
    const bestCount = Math.ceil(maximum / best);
    return Math.abs(count - targetIntervals) < Math.abs(bestCount - targetIntervals)
      ? candidate
      : best;
  }, candidates[0]);
}

function sharedRateScale(metricSeries) {
  const maxima = metricSeries
    .map((series) =>
      Math.max(...series.flatMap(({ values }) => (values ? [values.max] : []))),
    )
    .filter(Number.isFinite);
  if (!maxima.length) return null;

  const minimumMaximum = Math.min(...maxima);
  const maximum = Math.max(...maxima);
  const cap = minimumMaximum > 0 ? minimumMaximum * 2 : maximum;
  const limit = Math.min(maximum, cap);
  const step = axisStep(limit || 0.01);
  const end = Math.max(step, Math.ceil(limit / step) * step);
  return {
    end,
    limit,
    ticks: Array.from({ length: Math.round(end / step) + 1 }, (_, index) =>
      index * step,
    ),
  };
}

function MetricBoxPlot({ label, unit, series, scale }) {
  const plottedSeries = series.map((item) => ({
    ...item,
    values: boxPlotValues(item.summary),
  }));
  if (!scale) {
    return (
      <section className="analytics-boxplot">
        <div className="analytics-boxplot-heading">
          <h3>{label}</h3>
          <span>{unit}</span>
        </div>
        <p className="analytics-coming-soon">No scored outputs yet</p>
      </section>
    );
  }

  const position = (value) =>
    Math.max(0, Math.min(100, (Math.min(value, scale.end) / scale.end) * 100));

  return (
    <section className="analytics-boxplot">
      <div className="analytics-boxplot-heading">
        <h3>{label}</h3>
        <span>{unit}</span>
      </div>
      <div className="analytics-boxplot-rows">
        {plottedSeries.map(({ label: seriesLabel, values, workflowId }, index) => {
          const overflow = values && values.max > scale.limit;
          return (
            <div
              className="analytics-boxplot-row"
              key={`${workflowId ?? seriesLabel}-${index}`}
            >
              <strong title={seriesLabel}>{seriesLabel}</strong>
              {values ? (
                <div
                  className={`analytics-boxplot-track analytics-boxplot-track--${index + 1}`}
                  title={`Min ${metricValue(values.min)} · Q1 ${metricValue(values.q1)} · Median ${metricValue(values.median)} · Mean ${metricValue(values.mean)} · Q3 ${metricValue(values.q3)} · Max ${metricValue(values.max)}`}
                >
                  <span
                    className="analytics-boxplot-whisker analytics-boxplot-whisker--left"
                    style={{ left: `${position(values.min)}%`, right: `${100 - position(values.q1)}%` }}
                  />
                  <span
                    className="analytics-boxplot-box"
                    style={{ left: `${position(values.q1)}%`, right: `${100 - position(values.q3)}%` }}
                  >
                    <i style={{ left: `${(values.median - values.q1) / (values.q3 - values.q1 || 1) * 100}%` }} />
                  </span>
                  <span
                    className="analytics-boxplot-whisker analytics-boxplot-whisker--right"
                    style={{ left: `${position(values.q3)}%`, right: `${100 - position(values.max)}%` }}
                  />
                  {values.mean != null ? (
                    <span
                      className="analytics-boxplot-mean"
                      style={{ left: `${position(values.mean)}%` }}
                      aria-label={`Mean ${metricValue(values.mean)}`}
                    />
                  ) : null}
                  {overflow ? <span className="analytics-boxplot-overflow">---</span> : null}
                </div>
              ) : (
                <span className="analytics-boxplot-empty">No scored outputs</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="analytics-boxplot-axis">
        <span />
        <div>
          {scale.ticks.map((tick) => (
            <span key={tick}>{axisValue(tick)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowMetrics({ series, sampleCount }) {
  const cerSeries = series.map((item) => ({
    ...item,
    summary: item.metrics.cer,
    values: boxPlotValues(item.metrics.cer),
  }));
  const werSeries = series.map((item) => ({
    ...item,
    summary: item.metrics.wer,
    values: boxPlotValues(item.metrics.wer),
  }));
  const scale = sharedRateScale([cerSeries, werSeries]);
  return (
    <Panel className="analytics-workflow-panel">
      <div className="analytics-boxplot-list">
        <MetricBoxPlot
          label="CER"
          unit=""
          series={cerSeries}
          scale={scale}
        />
        <MetricBoxPlot
          label="WER"
          unit=""
          series={werSeries}
          scale={scale}
        />
      </div>
      <p className="analytics-completed-count">
        <strong>
          {series
            .map(
              (item) => `${item.label}: ${item.completedCount} of ${sampleCount}`,
            )
            .join(" · ")} samples fully processed
        </strong>
      </p>
    </Panel>
  );
}

function workflowColumns(onDeleteWorkflow) {
  return [
    {
      id: "name",
      label: "Name",
      width: "34%",
      className: "ui-data-table__primary",
      render: (workflow) => workflow.name || `Workflow ${workflow.id}`,
    },
    {
      id: "status",
      label: "Status",
      width: "18%",
      render: (workflow) => (
        <StatusBadge>{workflow.status || "draft"}</StatusBadge>
      ),
    },
    {
      id: "updated",
      label: "Updated",
      width: "24%",
      render: (workflow) =>
        formatDate(workflow.updated_at || workflow.created_at) || "—",
    },
    {
      id: "description",
      label: "Description",
      width: "18%",
      render: (workflow) => workflow.description || "—",
    },
    {
      id: "actions",
      label: "",
      width: "6%",
      className: "ui-data-table__actions",
      render: (workflow) => {
        const name = workflow.name || `Workflow ${workflow.id}`;
        return (
        <IconButton
          label={`Delete workflow ${name}`}
          variant="danger"
          onClick={() => onDeleteWorkflow?.(Number(workflow.id), name)}
        >
          <Icon name="delete" />
        </IconButton>
        );
      },
    },
  ];
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
  const [comparisonWorkflowIds, setComparisonWorkflowIds] = useState([]);
  const workflowsForSelection = sampleSetAnalytics?.workflows || [];
  useEffect(() => {
    setSelectedWorkflowId(String(workflowsForSelection[0]?.id || ""));
    setComparisonWorkflowIds([]);
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
  const selectedWorkflow = workflows.find(
    (item) => String(item.id) === String(selectedWorkflowId),
  );
  const comparisonWorkflows = comparisonWorkflowIds
    .map((workflowId) =>
      workflows.find((item) => String(item.id) === String(workflowId)),
    )
    .filter(Boolean);
  const chartSeries = [
    {
      workflowId: selectedWorkflow?.id,
      label: selectedWorkflow?.name || "Selected workflow",
      metrics: selectedAnalytics.metrics,
      completedCount: selectedAnalytics.completed_sample_count,
    },
    ...comparisonWorkflows.map((comparisonWorkflow) => {
      const comparisonAnalytics = analyticsByWorkflow[
        String(comparisonWorkflow.id)
      ] || { metrics: {}, completed_sample_count: 0 };
      return {
        workflowId: comparisonWorkflow.id,
        label: comparisonWorkflow.name || "Comparison workflow",
        metrics: comparisonAnalytics.metrics,
        completedCount: comparisonAnalytics.completed_sample_count,
      };
    }),
  ];

  function addComparison() {
    const alternative = workflows.find(
      (item) =>
        String(item.id) !== String(selectedWorkflowId) &&
        !comparisonWorkflowIds.includes(String(item.id)),
    );
    if (!alternative) return;
    setComparisonWorkflowIds((current) => [...current, String(alternative.id)]);
  }

  function updateComparison(index, workflowId) {
    setComparisonWorkflowIds((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? workflowId : item)),
    );
  }

  return (
    <Stack>
      <Panel
        eyebrow="Sample set"
        title={currentSet.name || "Sample set"}
        actions={<StatusBadge>{sampleCount} samples</StatusBadge>}
      >
        <div className="analytics-workflow-controls">
          <Select
            value={selectedWorkflowId}
            onChange={(event) => setSelectedWorkflowId(event.target.value)}
          >
            {workflows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || `Workflow ${item.id}`}
              </option>
            ))}
          </Select>
          {comparisonWorkflowIds.map((comparisonWorkflowId, index) => (
            <div className="analytics-workflow-comparison" key={`${comparisonWorkflowId}-${index}`}>
              <span className="analytics-workflow-versus">vs.</span>
              <Select
                value={comparisonWorkflowId}
                onChange={(event) => updateComparison(index, event.target.value)}
              >
                {workflows.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || `Workflow ${item.id}`}
                  </option>
                ))}
              </Select>
              <Button size="compact" onClick={() => setComparisonWorkflowIds((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                Remove compare
              </Button>
            </div>
          ))}
          {comparisonWorkflowIds.length < 3 ? (
            <Button
              size="compact"
              onClick={addComparison}
              disabled={!workflows.some(
                (item) =>
                  String(item.id) !== String(selectedWorkflowId) &&
                  !comparisonWorkflowIds.includes(String(item.id)),
              )}
            >
              + Compare
            </Button>
          ) : null}
        </div>
      </Panel>
      <WorkflowMetrics series={chartSeries} sampleCount={sampleCount} />
      <CollapsibleSection title="Workflows" count={workflows.length}>
        <div className="dashboard-workflow-list">
          <DataTable
            ariaLabel="Sample set workflows"
            columns={workflowColumns(onDeleteWorkflow)}
            rows={workflows}
            emptyState="No workflows are connected to this sample set."
          />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Samples" count={sampleIds.length}>
        <div className="dashboard-sample-list">
          <DataTable
            ariaLabel="Sample set samples"
            columns={[
              {
                id: "id",
                label: "Sample",
                className: "ui-data-table__primary",
              },
            ]}
            rows={sampleIds.map((sampleId) => ({ id: String(sampleId) }))}
            emptyState="No samples are connected to this sample set."
          />
        </div>
      </CollapsibleSection>
    </Stack>
  );
}
