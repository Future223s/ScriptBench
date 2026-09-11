"use client";

import { useEffect, useState } from "react";

import {
  CollapsibleSection,
  Button,
  EmptyState,
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

function axisValue(value) {
  const precision = Math.abs(value) < 1 ? 2 : Math.abs(value) < 10 ? 1 : 0;
  return String(Number(value.toFixed(precision)));
}

function boxPlotValues(summary) {
  const min = Number(summary?.min);
  const max = Number(summary?.max);
  const median = Number(summary?.median ?? summary?.mean);
  if (![min, max, median].every(Number.isFinite)) return null;

  const q1 = Number(summary?.q1);
  const q3 = Number(summary?.q3);
  return {
    min,
    q1: Number.isFinite(q1) ? q1 : (min + median) / 2,
    median,
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
                  title={`Min ${metricValue(values.min)} · Q1 ${metricValue(values.q1)} · Median ${metricValue(values.median)} · Q3 ${metricValue(values.q3)} · Max ${metricValue(values.max)}`}
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

function WorkflowRow({ workflow, onDelete }) {
  const name = workflow.name || `Workflow ${workflow.id}`;
  const detail = [
    workflow.status,
    workflow.description,
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
    setSelectedWorkflowId(String(workflowsForSelection[0]?.id || ""));
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
  const selectedWorkflow = workflows.find(
    (item) => String(item.id) === String(selectedWorkflowId),
  );
  const comparisonWorkflow = workflows.find(
    (item) =>
      String(item.id) ===
      String(comparisonWorkflowId || selectedWorkflowId),
  );
  const chartSeries = [
    {
      workflowId: selectedWorkflow?.id,
      label: selectedWorkflow?.name || "Selected workflow",
      metrics: selectedAnalytics.metrics,
      completedCount: selectedAnalytics.completed_sample_count,
    },
    ...(comparing
      ? [
          {
            workflowId: comparisonWorkflow?.id,
            label: comparisonWorkflow?.name || "Comparison workflow",
            metrics: comparisonAnalytics.metrics,
            completedCount: comparisonAnalytics.completed_sample_count,
          },
        ]
      : []),
  ];

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
                  <option key={item.id} value={item.id}>
                    {item.name || `Workflow ${item.id}`}
                  </option>
                ))}
              </Select>
              <Button size="compact" onClick={() => setComparing(false)}>
                Remove compare
              </Button>
            </>
          ) : (
            <Button
              size="compact"
              onClick={() => {
                const alternative = workflows.find(
                  (item) => String(item.id) !== String(selectedWorkflowId),
                );
                setComparisonWorkflowId(
                  String(alternative?.id || selectedWorkflowId),
                );
                setComparing(true);
              }}
            >
              + Compare
            </Button>
          )}
        </div>
      </Panel>
      <WorkflowMetrics series={chartSeries} sampleCount={sampleCount} />
      <CollapsibleSection title="Workflows" count={workflows.length}>
        <Stack gap="compact">
          {workflows.length ? (
            workflows.map((item) => (
              <WorkflowRow
                key={item.id}
                workflow={item}
                onDelete={() =>
                  onDeleteWorkflow?.(
                    Number(item.id),
                    item.name || `Workflow ${item.id}`,
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
