"use client";

import { useEffect, useMemo, useState } from "react";

import { fileManagementApi } from "../../api/endpoints/fileManagement.ts";
import { dashboardApi } from "../../api/endpoints/dashboard.ts";
import { buildCharacterDiff } from "../../utils/textDiff.js";
import {
  Button,
  Catalog,
  CatalogPagination,
  CodeBlock,
  ColumnFilter,
  DataTable,
  DescriptionList,
  Dialog,
  EmptyState,
  ImageFrame,
  Inline,
  ListPreview,
  LoadingPlaceholder,
  LoadingState,
  Panel,
  SectionTitle,
  SegmentedControl,
  Select,
  SplitPane,
  Stack,
  StatusBadge,
  Tabs,
  TextInput,
} from "../../ui/primitives/index.js";

function value(value, fallback = "—") {
  return value == null || value === "" ? fallback : String(value);
}

function editPreview(valueToPreview, fallback = "∅") {
  const normalized = String(valueToPreview || "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  const words = normalized.split(" ");
  const preview = words.slice(0, 8).join(" ");
  const bounded = preview.length > 96 ? `${preview.slice(0, 93)}…` : preview;
  return words.length > 8 && !bounded.endsWith("…") ? `${bounded}…` : bounded;
}

function wordAtEdit(context, start, end, fallback = "∅") {
  if (!context || (start === end && !context.slice(start, end))) return fallback;
  let wordStart = Math.max(0, start);
  let wordEnd = Math.max(wordStart, end);
  while (wordStart > 0 && !/\s/.test(context[wordStart - 1])) wordStart -= 1;
  while (wordEnd < context.length && !/\s/.test(context[wordEnd])) wordEnd += 1;
  return editPreview(context.slice(wordStart, wordEnd), fallback);
}

function disagreementTitle(item) {
  return `${wordAtEdit(item.source_line_context, item.source_span_start, item.source_span_end)} → ${wordAtEdit(item.target_line_context, item.target_span_start, item.target_span_end)}`;
}

function uniqueOptions(items, valueKey, labelKey = valueKey) {
  const values = new Map();
  for (const item of items) {
    const optionValue = item[valueKey];
    if (optionValue == null || optionValue === "") continue;
    values.set(String(optionValue), String(item[labelKey] ?? optionValue));
  }
  return [...values.entries()].sort((left, right) => left[1].localeCompare(right[1]));
}

function includesQuery(values, query) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase();
  return values.some((entry) => String(entry || "").toLocaleLowerCase().includes(normalized));
}

function filterOptions(items, valueKey, labelKey, allLabel) {
  return [
    { value: "", label: allLabel },
    ...uniqueOptions(items, valueKey, labelKey).map(([optionValue, optionLabel]) => ({
      value: optionValue,
      label: optionLabel,
    })),
  ];
}

function HighlightedContext({ text, start, end }) {
  return (
    <p className="analysis-context">
      {text.slice(0, start)}
      <mark>{text.slice(start, end) || "∅"}</mark>
      {text.slice(end)}
    </p>
  );
}

function DiffText({ before, after }) {
  return (
    <div className="analysis-diff-text">
      {buildCharacterDiff(before || "", after || "").map((part, index) => (
        <span key={`${part.type}-${index}`} data-diff={part.type}>
          {part.text}
        </span>
      ))}
    </div>
  );
}

function useSampleImage(sampleId) {
  const [image, setImage] = useState({ loading: false, src: "", error: "" });
  useEffect(() => {
    let active = true;
    if (!sampleId) return undefined;
    setImage({ loading: true, src: "", error: "" });
    fileManagementApi.getSample(sampleId).then((sample) => {
      if (!active) return;
      const src = sample.blob_base64 && sample.mime_type
        ? `data:${sample.mime_type};base64,${sample.blob_base64}`
        : "";
      setImage({ loading: false, src, error: src ? "" : "No manuscript image" });
    }).catch((error) => {
      if (active) setImage({ loading: false, src: "", error: error.message });
    });
    return () => { active = false; };
  }, [sampleId]);
  return image;
}

function Manuscript({ sampleId, sampleName, zoomable = true }) {
  const image = useSampleImage(sampleId);
  if (image.loading) return <LoadingPlaceholder label="Loading manuscript image" />;
  if (!image.src) return <EmptyState title="Image unavailable">{image.error}</EmptyState>;
  return <ImageFrame variant={zoomable ? "zoomable" : "static"} src={image.src} alt={sampleName || sampleId} caption={sampleName || sampleId} />;
}

function TranscriptionDetail({ item, transcriptions }) {
  const [relationshipId, setRelationshipId] = useState(item.relationships[0]?.id || "");
  const [mode, setMode] = useState(item.relationships.length ? "relationship" : "gt");
  const [payload, setPayload] = useState(null);
  useEffect(() => {
    setRelationshipId(item.relationships[0]?.id || "");
    setMode(item.relationships.length ? "relationship" : "gt");
  }, [item.id]);
  useEffect(() => {
    let active = true;
    setPayload(null);
    dashboardApi.getTranscriptionPayload(item.id).then((result) => {
      if (active) setPayload(result);
    }).catch(() => {
      if (active) setPayload({ error: "Payload unavailable" });
    });
    return () => { active = false; };
  }, [item.id]);
  const relationship = item.relationships.find((entry) => entry.id === relationshipId);
  const relationshipOutputIds = relationshipId.split(":");
  const relatedOutputId = relationship
    ? Number(relationshipOutputIds[relationship.direction === "upstream" ? 0 : 1])
    : null;
  const related = transcriptions.find((entry) => entry.id === relatedOutputId);
  const comparisonText = mode === "gt" ? item.ground_truth : related?.text;

  return (
    <Stack>
      <Panel
        eyebrow={`${item.sample_set_name} · ${item.workflow_name} · ${item.sample_name}`}
        title={item.workflow_step_name}
        actions={<StatusBadge>CER {item.cer == null ? "N/A" : Number(item.cer).toFixed(3)}</StatusBadge>}
      >
        <Stack gap="compact">
          <SegmentedControl
            items={[
              { id: "relationship", label: "Disagreement diff" },
              { id: "gt", label: "GT diff" },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === "relationship" && item.relationships.length > 1 ? (
            <Select value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)}>
              {item.relationships.map((entry) => <option key={entry.id} value={entry.id}>{entry.direction}: {entry.step_name} ({entry.count})</option>)}
            </Select>
          ) : null}
          <SplitPane
            primary={comparisonText != null ? <DiffText before={comparisonText} after={item.text} /> : <EmptyState title={mode === "gt" ? "No ground truth" : "No adjacent output"} />}
            secondary={<Manuscript sampleId={item.sample_id} sampleName={item.sample_name} />}
          />
        </Stack>
      </Panel>
      <CodeBlock label="Assembled model payload">{payload == null ? "Loading payload…" : JSON.stringify(payload, null, 2)}</CodeBlock>
      <Panel title="Execution and sample metadata">
        <DescriptionList items={[
          ["Sample", item.sample_name],
          ["Sample set", item.sample_set_name],
          ["Workflow", item.workflow_name],
          ["Workflow step", item.workflow_step_name],
          ["Relationship", relationship ? `${relationship.direction}: ${relationship.step_name}` : "N/A"],
          ...Object.entries(item.metadata).map(([key, entry]) => [key.replaceAll("_", " "), value(entry)]),
        ]} />
      </Panel>
    </Stack>
  );
}

function DisagreementDetail({ item }) {
  return (
    <Stack>
      <Panel eyebrow={`${item.sample_set_name} · ${item.workflow_name} · ${item.sample_name}`} title={disagreementTitle(item)}>
        <SplitPane
          primary={<Stack gap="compact"><strong>Source</strong><HighlightedContext text={item.source_line_context} start={item.source_span_start} end={item.source_span_end} /><strong>Target</strong><HighlightedContext text={item.target_line_context} start={item.target_span_start} end={item.target_span_end} /></Stack>}
          secondary={<Manuscript sampleId={item.sample_id} sampleName={item.sample_name} />}
        />
      </Panel>
      <Panel title="Disagreement metadata">
        <DescriptionList items={[
          ["Source workflow step", item.source_step_name],
          ["Target workflow step", item.target_step_name],
          ["Target model", item.target_model || "N/A"],
          ["Sample", item.sample_name],
          ["Sample set", item.sample_set_name],
          ["Operation type", item.operation_type],
          ["Correctness outcome", item.ground_truth == null ? "N/A" : item.correctness_outcome],
          ...(item.ground_truth == null ? [] : [["Ground truth", item.ground_truth]]),
        ]} />
      </Panel>
    </Stack>
  );
}

function relationshipNames(item, direction) {
  const names = (item.relationships || [])
    .filter((entry) => entry.direction === direction)
    .map((entry) => entry.step_name)
    .filter(Boolean);
  return names.join(", ") || "—";
}

function DisagreementChange({ item }) {
  const source = wordAtEdit(
    item.source_line_context,
    item.source_span_start,
    item.source_span_end,
  );
  const target = wordAtEdit(
    item.target_line_context,
    item.target_span_start,
    item.target_span_end,
  );
  return (
    <span className="analysis-change">
      <del className={source === "∅" ? "is-empty" : undefined}>{source}</del>
      <span aria-hidden="true">→</span>
      <ins className={target === "∅" ? "is-empty" : undefined}>{target}</ins>
    </span>
  );
}

function operationTone(operationType) {
  if (operationType === "insertion") return "success";
  if (operationType === "deletion") return "danger";
  return "warning";
}

function TranscriptionPreview({ item, onOpen }) {
  return (
    <Stack gap="compact">
      <SectionTitle>{item.workflow_step_name}</SectionTitle>
      <p className="analysis-preview__context">{item.sample_name} · {item.workflow_name}</p>
      <p className="analysis-preview__text">{item.text || "No transcription text."}</p>
      <Manuscript sampleId={item.sample_id} sampleName={item.sample_name} zoomable={false} />
      <DescriptionList items={[
        ["CER", item.cer == null ? "N/A" : Number(item.cer).toFixed(3)],
        ["Disagreements", item.disagreement_count == null ? "N/A" : Number(item.disagreement_count).toFixed(1)],
        ["Preceded by", relationshipNames(item, "upstream")],
        ["Followed by", relationshipNames(item, "downstream")],
        ["Sample set", item.sample_set_name],
      ]} />
      <Button onClick={onOpen}>Open full detail</Button>
    </Stack>
  );
}

function DisagreementPreview({ item, onOpen }) {
  return (
    <Stack gap="compact">
      <SectionTitle><DisagreementChange item={item} /></SectionTitle>
      <p className="analysis-preview__context">{item.sample_name} · {item.workflow_name}</p>
      <Stack gap="compact">
        <span className="analysis-preview__label">Source</span>
        <HighlightedContext text={item.source_line_context} start={item.source_span_start} end={item.source_span_end} />
        <span className="analysis-preview__label">Target</span>
        <HighlightedContext text={item.target_line_context} start={item.target_span_start} end={item.target_span_end} />
      </Stack>
      <Manuscript sampleId={item.sample_id} sampleName={item.sample_name} zoomable={false} />
      <DescriptionList items={[
        ["Source → target", `${item.source_step_name} → ${item.target_step_name}`],
        ["Model", item.target_model || "N/A"],
        ["Sample set", item.sample_set_name],
      ]} />
      <Button onClick={onOpen}>Open full detail</Button>
    </Stack>
  );
}

const emptyTranscriptionFilters = {
  query: "", sampleSet: "", workflow: "", sample: "", step: "",
  sort: "sample",
};

const emptyDisagreementFilters = {
  query: "", workflow: "", sample: "", sourceStep: "",
  targetStep: "", targetModel: "",
  sort: "workflow",
};

function filterAnalysisItems(mode, sourceItems, filters) {
  const filtered = sourceItems.filter((item) => {
    if (mode === "transcriptions" && filters.sampleSet && String(item.sample_set_id) !== filters.sampleSet) return false;
    if (filters.workflow && String(item.workflow_id) !== filters.workflow) return false;
    if (filters.sample && String(item.sample_id) !== filters.sample) return false;
    if (mode === "transcriptions") {
      if (!includesQuery([item.text, item.sample_name, item.workflow_step_name], filters.query)) return false;
      if (filters.step && String(item.workflow_step_id) !== filters.step) return false;
    } else {
      if (!includesQuery([item.source_text, item.target_text, item.source_line_context, item.target_line_context], filters.query)) return false;
      if (filters.sourceStep && String(item.source_step_id) !== filters.sourceStep) return false;
      if (filters.targetStep && String(item.target_step_id) !== filters.targetStep) return false;
      if (filters.targetModel && String(item.target_model) !== filters.targetModel) return false;
    }
    return true;
  });
  const sorted = [...filtered];
  if (filters.sort === "cer-desc") sorted.sort((a, b) => Number(b.cer ?? -1) - Number(a.cer ?? -1));
  else if (filters.sort === "disagreements-desc") sorted.sort((a, b) => Number(b.disagreement_count ?? -1) - Number(a.disagreement_count ?? -1));
  else if (filters.sort === "newest") sorted.sort((a, b) => String(b.metadata?.completed_at || "").localeCompare(String(a.metadata?.completed_at || "")));
  else if (filters.sort === "corrections") sorted.sort((a, b) => Number(b.correctness_outcome === "correction") - Number(a.correctness_outcome === "correction"));
  else if (filters.sort === "regressions") sorted.sort((a, b) => Number(b.correctness_outcome === "regression") - Number(a.correctness_outcome === "regression"));
  else if (filters.sort === "workflow") sorted.sort((a, b) => `${a.workflow_name}\0${a.sample_name}\0${a.workflow_step_name || a.source_step_name}\0${a.target_step_name || ""}`.localeCompare(`${b.workflow_name}\0${b.sample_name}\0${b.workflow_step_name || b.source_step_name}\0${b.target_step_name || ""}`));
  else sorted.sort((a, b) => `${a.sample_name}\0${a.workflow_name}`.localeCompare(`${b.sample_name}\0${b.workflow_name}`));
  return sorted;
}

function AnalysisCatalog({ mode, sourceItems, items, filters, onFiltersChange, onClear, selected, onSelect, onOpen }) {
  const isTranscriptions = mode === "transcriptions";
  const [openFilterId, setOpenFilterId] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  useEffect(() => {
    setOpenFilterId("");
    setPage(0);
  }, [mode]);
  const defaults = isTranscriptions ? emptyTranscriptionFilters : emptyDisagreementFilters;
  const sortOptions = isTranscriptions ? [
    ["sample", "Sort: Sample"],
    ["workflow", "Sort: Workflow → sample → step"],
    ["cer-desc", "Sort: Highest CER"],
    ["disagreements-desc", "Sort: Most disagreements"],
    ["newest", "Sort: Newest execution"],
  ] : [
    ["workflow", "Sort: Workflow → sample → steps"],
    ["sample", "Sort: Sample"],
    ["corrections", "Sort: Corrections first"],
    ["regressions", "Sort: Regressions first"],
  ];
  const filterDefinitions = isTranscriptions ? {
    sample: { id: "sample", options: filterOptions(sourceItems, "sample_id", "sample_name", "All samples") },
    sampleSet: { id: "sampleSet", options: filterOptions(sourceItems, "sample_set_id", "sample_set_name", "All sample sets") },
    step: { id: "step", options: filterOptions(sourceItems, "workflow_step_id", "workflow_step_name", "All steps") },
    workflow: { id: "workflow", options: filterOptions(sourceItems, "workflow_id", "workflow_name", "All workflows") },
  } : {
    sourceStep: { id: "sourceStep", options: filterOptions(sourceItems, "source_step_id", "source_step_name", "All source steps") },
    targetStep: { id: "targetStep", options: filterOptions(sourceItems, "target_step_id", "target_step_name", "All target steps") },
    sample: { id: "sample", options: filterOptions(sourceItems, "sample_id", "sample_name", "All samples") },
    targetModel: { id: "targetModel", options: filterOptions(sourceItems, "target_model", "target_model", "All models") },
    workflow: { id: "workflow", options: filterOptions(sourceItems, "workflow_id", "workflow_name", "All workflows") },
  };
  const columns = isTranscriptions ? [
    { id: "sample", label: "Sample", filterId: "sample", width: "14%", className: "ui-data-table__primary", render: (item) => item.sample_name },
    { id: "sampleSet", label: "Sample set", filterId: "sampleSet", width: "12%", render: (item) => item.sample_set_name },
    { id: "step", label: "Workflow step", filterId: "step", width: "15%", render: (item) => item.workflow_step_name },
    { id: "cer", label: "CER", width: "7%", className: "ui-data-table__numeric", render: (item) => item.cer == null ? "N/A" : Number(item.cer).toFixed(3) },
    { id: "disagreements", label: "Disagreements", width: "9%", className: "ui-data-table__numeric", render: (item) => item.disagreement_count == null ? "N/A" : Number(item.disagreement_count).toFixed(1) },
    { id: "preceded", label: "Preceded by", width: "12%", render: (item) => relationshipNames(item, "upstream") },
    { id: "followed", label: "Followed by", width: "12%", render: (item) => relationshipNames(item, "downstream") },
    { id: "workflow", label: "Workflow", filterId: "workflow", width: "19%", render: (item) => item.workflow_name },
  ] : [
    { id: "change", label: "Change", width: "23%", className: "ui-data-table__primary", render: (item) => <DisagreementChange item={item} /> },
    { id: "sourceStep", label: "Source step", filterId: "sourceStep", width: "14%", render: (item) => item.source_step_name },
    { id: "targetStep", label: "Target step", filterId: "targetStep", width: "14%", render: (item) => item.target_step_name },
    { id: "sample", label: "Sample", filterId: "sample", width: "14%", render: (item) => item.sample_name },
    { id: "type", label: "Type", width: "10%", render: (item) => <StatusBadge tone={operationTone(item.operation_type)} size="compact">{String(item.operation_type || "change").toUpperCase()}</StatusBadge> },
    { id: "model", label: "Model", filterId: "targetModel", width: "10%", render: (item) => item.target_model || "—" },
    { id: "workflow", label: "Workflow", filterId: "workflow", width: "15%", render: (item) => item.workflow_name },
  ];
  const setFilter = (key, nextValue) => {
    setPage(0);
    setOpenFilterId("");
    onFiltersChange({ ...filters, [key]: nextValue });
  };
  const tableColumns = columns.map((column, index) => {
    const definition = filterDefinitions[column.filterId];
    if (!definition) return column;
    return {
      ...column,
      header: (
        <ColumnFilter
          label={column.label}
          active={Boolean(filters[definition.id])}
          open={openFilterId === definition.id}
          align={index === columns.length - 1 ? "end" : "start"}
          onToggle={() => setOpenFilterId((current) => current === definition.id ? "" : definition.id)}
        >
          {definition.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={String(filters[definition.id] || "") === String(option.value) ? "is-selected" : undefined}
              onClick={() => setFilter(definition.id, option.value)}
            >
              {option.label}
            </button>
          ))}
        </ColumnFilter>
      ),
    };
  });
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visibleItems = items.slice(pageStart, pageStart + pageSize);
  const hasActiveFilters = Object.entries(filters).some(([key, currentValue]) => String(currentValue ?? "") !== String(defaults[key] ?? ""));
  return (
    <Catalog
      title={isTranscriptions ? "Transcriptions" : "Disagreements"}
      description={isTranscriptions ? "Inspect model outputs and their evaluation metrics." : "Inspect changes between connected workflow steps."}
      meta={<StatusBadge>{items.length} results</StatusBadge>}
      actions={hasActiveFilters ? <Button size="compact" onClick={() => { setPage(0); setOpenFilterId(""); onClear(); }}>Clear filters</Button> : null}
      search={(
        <TextInput
          type="search"
          value={filters.query}
          placeholder={isTranscriptions ? "Search transcription text" : "Search changed text"}
          aria-label={isTranscriptions ? "Search transcription text" : "Search changed text"}
          onChange={(event) => setFilter("query", event.target.value)}
        />
      )}
      controls={(
        <Select aria-label={`Sort ${mode}`} value={filters.sort} onChange={(event) => setFilter("sort", event.target.value)}>
          {sortOptions.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </Select>
      )}
      footer={(
        <CatalogPagination
          start={items.length ? pageStart + 1 : 0}
          end={Math.min(pageStart + pageSize, items.length)}
          total={items.length}
          previousDisabled={safePage === 0}
          nextDisabled={safePage >= pageCount - 1}
          onPrevious={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
        />
      )}
      ariaLabel={`${isTranscriptions ? "Transcriptions" : "Disagreements"} catalog`}
    >
      <ListPreview
        previewLabel={`${isTranscriptions ? "Transcription" : "Disagreement"} preview`}
        list={
          <div className="analysis-catalog-table">
            <DataTable
              ariaLabel={isTranscriptions ? "Transcriptions" : "Disagreements"}
              columns={tableColumns}
              rows={visibleItems}
              selectedRowId={selected?.id}
              onRowActivate={onSelect}
              onRowDoubleClick={onOpen}
              emptyState={`No ${mode} match the current filters.`}
            />
          </div>
        }
        preview={selected ? (isTranscriptions
          ? <TranscriptionPreview item={selected} onOpen={() => onOpen(selected)} />
          : <DisagreementPreview item={selected} onOpen={() => onOpen(selected)} />
        ) : <EmptyState title={`Select a ${isTranscriptions ? "transcription" : "disagreement"}`}>Choose a row to inspect it here. Double-click a row to open full detail.</EmptyState>}
      />
    </Catalog>
  );
}

export function AnalysisBrowser({ analysis, loading, loadingMore, error }) {
  const transcriptions = analysis?.transcriptions || [];
  const disagreements = analysis?.disagreements || [];
  const [transcriptionFilters, setTranscriptionFilters] = useState(emptyTranscriptionFilters);
  const [disagreementFilters, setDisagreementFilters] = useState(emptyDisagreementFilters);
  const transcriptionItems = useMemo(
    () => filterAnalysisItems("transcriptions", transcriptions, transcriptionFilters),
    [transcriptionFilters, transcriptions],
  );
  const disagreementItems = useMemo(
    () => filterAnalysisItems("disagreements", disagreements, disagreementFilters),
    [disagreementFilters, disagreements],
  );
  const [activeMode, setActiveMode] = useState("transcriptions");
  const [selection, setSelection] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const selected = useMemo(() => {
    if (!selection) return null;
    const source = selection.type === "transcriptions" ? transcriptions : disagreements;
    return source.find((item) => String(item.id) === String(selection.id)) || null;
  }, [disagreements, selection, transcriptions]);
  useEffect(() => {
    if (!selection || selected) return;
    setSelection(null);
    setDetailOpen(false);
  }, [selected, selection]);
  if (loading && !analysis) return <LoadingPlaceholder label="Loading analysis" />;
  if (error && !analysis) return <EmptyState title="Analysis unavailable">{error}</EmptyState>;
  const activeItems = activeMode === "transcriptions" ? transcriptionItems : disagreementItems;
  const activeSourceItems = activeMode === "transcriptions" ? transcriptions : disagreements;
  const activeFilters = activeMode === "transcriptions" ? transcriptionFilters : disagreementFilters;
  const setActiveFilters = activeMode === "transcriptions" ? setTranscriptionFilters : setDisagreementFilters;
  const emptyFilters = activeMode === "transcriptions" ? emptyTranscriptionFilters : emptyDisagreementFilters;
  const selectItem = (item) => setSelection({ type: activeMode, id: item.id });
  const openItem = (item) => {
    setSelection({ type: activeMode, id: item.id });
    setDetailOpen(true);
  };
  return (
    <div className="analysis-browser">
      <Stack>
        <Tabs
          items={[
            { id: "transcriptions", label: "Transcriptions", count: transcriptions.length },
            { id: "disagreements", label: "Disagreements", count: disagreements.length },
          ]}
          activeId={activeMode}
          onChange={(nextMode) => {
            setActiveMode(nextMode);
            setSelection(null);
            setDetailOpen(false);
          }}
        />
        {loadingMore ? (
          <div className="analysis-loading-more">
            <LoadingState
              label={`Loading more analysis… ${transcriptions.length} transcriptions and ${disagreements.length} disagreements loaded`}
            />
          </div>
        ) : null}
        <AnalysisCatalog
          mode={activeMode}
          sourceItems={activeSourceItems}
          items={activeItems}
          filters={activeFilters}
          onFiltersChange={setActiveFilters}
          onClear={() => setActiveFilters(emptyFilters)}
          selected={selection?.type === activeMode ? selected : null}
          onSelect={selectItem}
          onOpen={openItem}
        />
        <Dialog
          open={detailOpen && Boolean(selected)}
          title={selection?.type === "transcriptions" ? "Transcription detail" : "Disagreement detail"}
          description={selected ? `${selected.sample_name} · ${selected.workflow_name}` : undefined}
          onClose={() => setDetailOpen(false)}
          size="wide"
        >
          {selected ? (selection.type === "transcriptions"
            ? <TranscriptionDetail item={selected} transcriptions={transcriptions} />
            : <DisagreementDetail item={selected} />) : null}
        </Dialog>
      </Stack>
    </div>
  );
}
