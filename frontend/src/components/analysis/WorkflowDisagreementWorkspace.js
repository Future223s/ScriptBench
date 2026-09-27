"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { dashboardApi } from "../../api/endpoints/dashboard.ts";
import {
  Button,
  CollapsibleSection,
  DescriptionList,
  EmptyState,
  Field,
  Inline,
  LoadingPlaceholder,
  Panel,
  Select,
  SplitPane,
  Stack,
  StatusBadge,
  TextInput,
} from "../../ui/primitives/index.js";

function HighlightedOutput({ text, regions, side, activeSequence }) {
  const startKey = `${side}_start`;
  const endKey = `${side}_end`;
  const content = [];
  let cursor = 0;
  for (const region of regions) {
    const start = Math.max(cursor, region[startKey]);
    const end = Math.max(start, region[endKey]);
    content.push(text.slice(cursor, start));
    content.push(
      <mark
        key={`${side}-${region.sequence}`}
        data-active={region.sequence === activeSequence ? "true" : undefined}
        title={`Disagreement ${region.sequence + 1}`}
      >
        {text.slice(start, end) || "∅"}
      </mark>,
    );
    cursor = end;
  }
  content.push(text.slice(cursor));
  return <pre className="analysis-comparison-output">{content}</pre>;
}

function WorkflowOutput({ title, detail, text, regions, side, activeSequence }) {
  return (
    <Panel title={title} description={detail} fill>
      <HighlightedOutput
        text={text}
        regions={regions}
        side={side}
        activeSequence={activeSequence}
      />
    </Panel>
  );
}

export function WorkflowDisagreementWorkspace() {
  const [sampleSets, setSampleSets] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [sampleSetId, setSampleSetId] = useState("");
  const [sourceWorkflowId, setSourceWorkflowId] = useState("");
  const [targetWorkflowId, setTargetWorkflowId] = useState("");
  const [anchorLength, setAnchorLength] = useState("4");
  const [severityThreshold, setSeverityThreshold] = useState("0.2");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [sampleId, setSampleId] = useState("");
  const [activeRegion, setActiveRegion] = useState(0);

  useEffect(() => {
    let active = true;
    dashboardApi.getSampleSets().then((response) => {
      if (!active) return;
      const nextSets = response.sample_sets || [];
      setSampleSets(nextSets);
      setSampleSetId(nextSets[0] ? String(nextSets[0].id) : "");
      setLoadingOptions(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoadingOptions(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setWorkflows([]);
    setSourceWorkflowId("");
    setTargetWorkflowId("");
    setResult(null);
    if (!sampleSetId) return undefined;
    setLoadingOptions(true);
    dashboardApi.getSampleSetAnalytics(sampleSetId).then((response) => {
      if (!active) return;
      const nextWorkflows = response.workflows || [];
      setWorkflows(nextWorkflows);
      setSourceWorkflowId(nextWorkflows[0] ? String(nextWorkflows[0].id) : "");
      setTargetWorkflowId(nextWorkflows[1] ? String(nextWorkflows[1].id) : "");
      setLoadingOptions(false);
    }).catch((loadError) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setLoadingOptions(false);
    });
    return () => { active = false; };
  }, [sampleSetId]);

  const selectedSample = useMemo(
    () => result?.samples.find((sample) => sample.sample_id === sampleId) || null,
    [result, sampleId],
  );
  const regions = selectedSample?.regions || [];
  const selectedRegion = regions[activeRegion] || null;
  const canRun = sampleSetId && sourceWorkflowId && targetWorkflowId
    && sourceWorkflowId !== targetWorkflowId && !running;

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      const computation = await dashboardApi.findDisagreements({
        sample_set_id: Number(sampleSetId),
        source_workflow_id: Number(sourceWorkflowId),
        target_workflow_id: Number(targetWorkflowId),
        agreement_anchor_length: Number(anchorLength),
        severity_threshold: Number(severityThreshold),
        minimum_raw_edits: 1,
      });
      setResult(computation);
      setSampleId(computation.samples[0]?.sample_id || "");
      setActiveRegion(0);
    } catch (runError) {
      setResult(null);
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setRunning(false);
    }
  };

  if (loadingOptions && !sampleSets.length) {
    return <LoadingPlaceholder label="Loading analysis options" />;
  }

  return (
    <section className="analysis-tool" aria-labelledby="quick-analysis-title">
      <header className="analysis-tool__header">
        <h2 id="quick-analysis-title">Compare model outputs</h2>
      </header>
      <div className="analysis-tool__surface">
        <Stack>
          <div className="analysis-computation-controls">
            <Field label="Sample set" density="compact">
              <Select value={sampleSetId} onChange={(event) => setSampleSetId(event.target.value)}>
                {sampleSets.map((sampleSet) => <option key={sampleSet.id} value={sampleSet.id}>{sampleSet.name}</option>)}
              </Select>
            </Field>
            <Field label="Source" density="compact">
              <Select value={sourceWorkflowId} onChange={(event) => setSourceWorkflowId(event.target.value)}>
                <option value="">Select workflow</option>
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
              </Select>
            </Field>
            <Field label="Target" density="compact">
              <Select value={targetWorkflowId} onChange={(event) => setTargetWorkflowId(event.target.value)}>
                <option value="">Select workflow</option>
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
              </Select>
            </Field>
            <Field label="Anchor" density="compact">
              <TextInput aria-label="Agreement anchor length in characters" title="Matches needed to close a region" type="number" min="1" max="50" value={anchorLength} onChange={(event) => setAnchorLength(event.target.value)} />
            </Field>
            <Field label="Severity" density="compact">
              <TextInput aria-label="Severity threshold" title="Normalized distance from 0 to 1" type="number" min="0" max="1" step="0.05" value={severityThreshold} onChange={(event) => setSeverityThreshold(event.target.value)} />
            </Field>
            <div className="analysis-computation-actions">
              <Button size="compact" variant="primary" disabled={!canRun} onClick={run}>
                {running ? "Analyzing…" : "Run analysis"}
              </Button>
            </div>
          </div>
          {workflows.length < 2 ? <StatusBadge tone="warning">Two workflows required</StatusBadge> : null}
          {sourceWorkflowId && sourceWorkflowId === targetWorkflowId ? <StatusBadge tone="warning">Choose different workflows</StatusBadge> : null}
          {error ? <EmptyState title="Analysis unavailable">{error}</EmptyState> : null}

        {result ? (
          <Stack>
            <Inline justify="between">
              <Field label="Sample" density="compact">
                <Select value={sampleId} onChange={(event) => { setSampleId(event.target.value); setActiveRegion(0); }}>
                  {result.samples.map((sample) => (
                    <option key={sample.sample_id} value={sample.sample_id}>
                      {sample.sample_name} ({sample.regions.length})
                    </option>
                  ))}
                </Select>
              </Field>
              <Inline gap="compact">
                <StatusBadge>{regions.length} regions</StatusBadge>
                <Button size="compact" disabled={!regions.length || activeRegion === 0} onClick={() => setActiveRegion((value) => value - 1)}>Previous</Button>
                <Button size="compact" disabled={!regions.length || activeRegion >= regions.length - 1} onClick={() => setActiveRegion((value) => value + 1)}>Next</Button>
              </Inline>
            </Inline>

            {selectedSample ? (
              <>
                <div className="analysis-comparison-panes">
                  <SplitPane
                    primary={<WorkflowOutput title={result.source_workflow_name} detail="Source terminal output" text={selectedSample.source_text} regions={regions} side="source" activeSequence={selectedRegion?.sequence} />}
                    secondary={<WorkflowOutput title={result.target_workflow_name} detail={result.target_model ? `Target terminal output · ${result.target_model}` : "Target terminal output"} text={selectedSample.target_text} regions={regions} side="target" activeSequence={selectedRegion?.sequence} />}
                  />
                </div>
                {selectedRegion ? (
                  <Panel title={`Region ${activeRegion + 1} of ${regions.length}`} density="compact">
                    <DescriptionList items={[
                      ["Source", selectedRegion.source_text || "∅"],
                      ["Target", selectedRegion.target_text || "∅"],
                      ["Normalized distance", selectedRegion.normalized_distance.toFixed(3)],
                      ["Raw edits", selectedRegion.raw_edit_count],
                    ]} />
                  </Panel>
                ) : <EmptyState title="No disagreements">The terminal outputs agree under these thresholds.</EmptyState>}
              </>
            ) : <EmptyState title="No comparable samples">No sample has both terminal outputs.</EmptyState>}

            {result.skipped_samples.length ? (
              <CollapsibleSection title="Skipped samples" summary="Missing one or both terminal outputs" count={result.skipped_samples.length}>
                <Stack gap="compact">
                  {result.skipped_samples.map((sample) => (
                    <Fragment key={sample.sample_id}>
                      <DescriptionList items={[[sample.sample_name, sample.reason]]} />
                    </Fragment>
                  ))}
                </Stack>
              </CollapsibleSection>
            ) : null}
          </Stack>
        ) : null}
        </Stack>
      </div>
    </section>
  );
}
