"use client";

import { useMemo, useState } from "react";

import { Icon, Tabs } from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";

const PAGE_SIZE = 8;

function metricValue(value) {
  return value == null || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(3);
}

function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function aggregateSummary(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const percentile = (fraction) => {
    const position = (values.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    return lower === upper ? values[lower] : values[lower] + (values[upper] - values[lower]) * (position - lower);
  };
  return {
    min: values[0],
    median: percentile(0.5),
    max: values[values.length - 1],
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function FilterMenu({ id, label, active, openMenu, setOpenMenu, alignEnd = false, children }) {
  const open = openMenu === id;
  return (
    <div className={`dashboard-column-filter${alignEnd ? " dashboard-column-filter--end" : ""}`}>
      <button type="button" className={open ? "is-open" : ""} aria-expanded={open} onClick={() => setOpenMenu(open ? "" : id)}>
        {active ? <i className="dashboard-filter-dot" aria-label="Filter active" /> : null}
        <span>{label}</span><span className="dashboard-filter-chevron">⌄</span>
      </button>
      {open ? <div className="dashboard-column-menu">{children}</div> : null}
    </div>
  );
}

function Kpi({ label, value, note }) {
  return <article className="dashboard-card dashboard-kpi"><span className="dashboard-kpi-label">{label}</span><strong className="dashboard-kpi-value">{value}</strong><span className="dashboard-kpi-note">{note}</span></article>;
}

export function SampleSetAnalyticsPanel({ sampleSets, selectedSampleSetId, sampleSet, sampleSetAnalytics, onSelectSampleSet, onDeleteWorkflow, onManageSampleSet, onOpenSampleDetail }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cerMin, setCerMin] = useState("");
  const [cerMax, setCerMax] = useState("");
  const [cerSort, setCerSort] = useState("");
  const [openMenu, setOpenMenu] = useState("");
  const [page, setPage] = useState(0);

  const currentSet = sampleSet || sampleSetAnalytics?.sample_set || {};
  const workflows = sampleSetAnalytics?.workflows || [];
  const analyticsByWorkflow = sampleSetAnalytics?.analytics_by_workflow || {};
  const sampleIds = sampleSetAnalytics?.sample_ids || currentSet.sample_ids || [];
  const sampleCount = Number(sampleSetAnalytics?.sample_count ?? currentSet.sample_count ?? sampleIds.length);
  const scopedWorkflows = selectedWorkflowId === "all" ? workflows : workflows.filter((item) => String(item.id) === selectedWorkflowId);
  const scopedRows = scopedWorkflows.flatMap((item) => (analyticsByWorkflow[String(item.id)]?.samples || []).map((row) => ({ ...row, workflow_id: item.id })));
  const cerSummary = selectedWorkflowId === "all" ? aggregateSummary(scopedRows, "cer") : analyticsByWorkflow[selectedWorkflowId]?.metrics?.cer;
  const werSummary = selectedWorkflowId === "all" ? aggregateSummary(scopedRows, "wer") : analyticsByWorkflow[selectedWorkflowId]?.metrics?.wer;
  const completedCount = scopedWorkflows.reduce((sum, item) => sum + Number(analyticsByWorkflow[String(item.id)]?.completed_sample_count || 0), 0);
  const possibleCount = sampleCount * scopedWorkflows.length;
  const processedPercent = possibleCount ? Math.round((completedCount / possibleCount) * 100) : 0;
  const workflowLabel = selectedWorkflowId === "all" ? "All workflows · aggregate" : scopedWorkflows[0]?.name || "Workflow";

  const reviewRows = [...scopedRows].filter((row) => Number.isFinite(Number(row.cer))).sort((a, b) => Number(b.cer) - Number(a.cer)).filter((row, index, rows) => rows.findIndex((candidate) => candidate.sample_id === row.sample_id) === index).slice(0, 5);
  const cerBins = [
    { label: "≤ .025", count: scopedRows.filter((row) => Number(row.cer) <= 0.025).length },
    { label: ".025–.05", count: scopedRows.filter((row) => Number(row.cer) > 0.025 && Number(row.cer) <= 0.05).length },
    { label: ".05–.10", count: scopedRows.filter((row) => Number(row.cer) > 0.05 && Number(row.cer) <= 0.1).length },
    { label: ".10–.20", count: scopedRows.filter((row) => Number(row.cer) > 0.1 && Number(row.cer) <= 0.2).length },
    { label: "> .20", count: scopedRows.filter((row) => Number(row.cer) > 0.2).length },
  ];
  const maxBin = Math.max(...cerBins.map((bin) => bin.count), 1);
  const latestWorkflow = [...scopedWorkflows].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))[0];
  const latestAnalytics = latestWorkflow ? analyticsByWorkflow[String(latestWorkflow.id)] || {} : {};
  const metricBySample = useMemo(() => {
    const values = new Map();
    scopedRows.forEach((row) => {
      const existing = values.get(row.sample_id);
      if (!existing || Number(row.cer) > Number(existing.cer)) values.set(row.sample_id, row);
    });
    return values;
  }, [scopedRows]);
  const sampleRows = sampleIds.map((sampleId) => {
    const metric = metricBySample.get(sampleId);
    return { sample_id: sampleId, type: "image/jpeg", status: metric ? "Processed" : "Pending", cer: metric?.cer };
  });
  const filteredSamples = sampleRows.filter((row) => row.sample_id.toLowerCase().includes(search.trim().toLowerCase())).filter((row) => !typeFilter || row.type === typeFilter).filter((row) => !statusFilter || row.status === statusFilter).filter((row) => cerMin === "" || Number(row.cer) >= Number(cerMin)).filter((row) => cerMax === "" || Number(row.cer) <= Number(cerMax)).sort((a, b) => cerSort ? (Number(a.cer) - Number(b.cer)) * (cerSort === "asc" ? 1 : -1) : 0);
  const pageCount = Math.max(1, Math.ceil(filteredSamples.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleSamples = filteredSamples.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return <>
    <header className="dashboard-context">
      <div>
        <div className="dashboard-title-line"><h1>{currentSet.name || "Sample set"}</h1><button type="button" className="dashboard-title-edit" aria-label="Manage sample set" onClick={onManageSampleSet}><Icon name="pencil" /></button></div>
        <p className="dashboard-subtitle">{currentSet.created_at ? `Created ${shortDate(currentSet.created_at)} · ` : ""}{sampleCount} historical document pages</p>
      </div>
      <div className="dashboard-context-actions">
        <label className="ui-stacked-select"><span>Sample set</span><select value={selectedSampleSetId || ""} onChange={(event) => onSelectSampleSet?.(Number(event.target.value))}>{sampleSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="ui-stacked-select dashboard-workflow-select"><span>Workflow</span><select value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)}><option value="all">All workflows (aggregate)</option>{workflows.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>
      </div>
    </header>

    <Tabs
      items={[
        { id: "overview", label: "Overview" },
        { id: "samples", label: `Samples ${sampleCount}` },
        { id: "workflows", label: `Workflows ${workflows.length}` },
      ]}
      activeId={activeTab}
      onChange={setActiveTab}
      ariaLabel="Sample set views"
      className="dashboard-view-tabs"
    />

    {activeTab === "overview" ? <section className="dashboard-tab-panel">
      <div className="dashboard-kpis">
        <Kpi label="Pages" value={sampleCount} note="in this sample set" />
        <Kpi label="Processed" value={`${processedPercent}%`} note={selectedWorkflowId === "all" ? `${completedCount} pages across ${workflows.length} workflow${workflows.length === 1 ? "" : "s"}` : `${completedCount} of ${sampleCount} pages in workflow`} />
        <Kpi label="Mean CER" value={metricValue(cerSummary?.mean)} note={`median ${metricValue(cerSummary?.median)}`} />
        <Kpi label="Mean WER" value={metricValue(werSummary?.mean)} note={`median ${metricValue(werSummary?.median)}`} />
      </div>
      <div className="dashboard-overview-grid">
        <article className="dashboard-card dashboard-panel dashboard-quality">
          <div className="dashboard-panel-head"><div><h2>Character error distribution</h2><p>Pages grouped by CER; lower is better</p></div><span className="dashboard-workflow-chip">{workflowLabel}</span></div>
          <div className="dashboard-distribution">{cerBins.map((bin) => <div className="dashboard-bin" key={bin.label}><div className="dashboard-bin-bar" style={{ height: `${Math.max(4, (bin.count / maxBin) * 100)}%` }} /><strong>{bin.count}</strong><span>{bin.label}</span></div>)}</div>
          <div className="dashboard-quality-summary">{[["Minimum", cerSummary?.min], ["Median", cerSummary?.median], ["Mean", cerSummary?.mean], ["Maximum", cerSummary?.max]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{metricValue(value)}</strong></div>)}</div>
        </article>
        <article className="dashboard-card dashboard-panel">
          <div className="dashboard-panel-head"><h2>Pages to review</h2><span className="dashboard-badge">{reviewRows.length} shown</span></div>
          <ol className="dashboard-attention-list">{reviewRows.map((row) => <li key={row.sample_id}><button type="button" onClick={() => onOpenSampleDetail?.(row.sample_id)} aria-label={`Open details for ${row.sample_id}`}><span>{row.sample_id}</span><strong>{metricValue(row.cer)}</strong></button></li>)}</ol>
          <p className="dashboard-analysis-instruction">Click a page to open its details.</p>
        </article>
        <article className="dashboard-card dashboard-panel dashboard-latest">
          <div className="dashboard-panel-head"><div><h2>Latest workflow</h2><p>{latestWorkflow ? `Updated ${formatDate(latestWorkflow.updated_at || latestWorkflow.created_at)}` : "No workflow runs yet"}</p></div>{latestWorkflow ? <span className="dashboard-badge is-success">{latestWorkflow.status}</span> : null}</div>
          {latestWorkflow ? <div className="dashboard-run"><div className="dashboard-run-row"><span>{latestWorkflow.name}</span><strong>{Number(latestAnalytics.completed_sample_count || 0)} / {sampleCount}</strong></div><div className="dashboard-run-progress" aria-label={`Workflow completed ${latestAnalytics.completed_sample_count || 0} of ${sampleCount} pages`}><span style={{ width: `${sampleCount ? Math.min(100, (Number(latestAnalytics.completed_sample_count || 0) / sampleCount) * 100) : 0}%` }} /></div><div className="dashboard-run-meta"><span>{(latestAnalytics.samples || []).length} scored outputs</span><span>All outputs scored</span></div></div> : null}
        </article>
      </div>
    </section> : null}

    {activeTab === "samples" ? <section className="dashboard-card dashboard-secondary-view">
      <div className="dashboard-panel-head"><div><h2>Samples</h2><p>Browse every page in this sample set.</p></div><span className="dashboard-badge">{sampleCount} samples</span></div>
      <input className="dashboard-catalog-search" type="search" placeholder="Search sample" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
      <div className="dashboard-table-wrap"><table><thead><tr><th>Sample</th><th><FilterMenu id="type" label="Type" active={Boolean(typeFilter)} openMenu={openMenu} setOpenMenu={setOpenMenu}><button type="button" className={!typeFilter ? "is-selected" : ""} onClick={() => { setTypeFilter(""); setOpenMenu(""); }}>All types</button><button type="button" className={typeFilter === "image/jpeg" ? "is-selected" : ""} onClick={() => { setTypeFilter("image/jpeg"); setOpenMenu(""); }}>image/jpeg</button></FilterMenu></th><th><FilterMenu id="status" label="Status" active={Boolean(statusFilter)} openMenu={openMenu} setOpenMenu={setOpenMenu}>{["", "Processed", "Pending"].map((value) => <button type="button" className={statusFilter === value ? "is-selected" : ""} key={value || "all"} onClick={() => { setStatusFilter(value); setOpenMenu(""); }}>{value || "All statuses"}</button>)}</FilterMenu></th><th><FilterMenu id="cer" label="CER" active={cerMin !== "" || cerMax !== "" || Boolean(cerSort)} openMenu={openMenu} setOpenMenu={setOpenMenu} alignEnd><div className="dashboard-range-fields"><label>Minimum<input type="number" placeholder="0.000" value={cerMin} onChange={(event) => setCerMin(event.target.value)} /></label><span>to</span><label>Maximum<input type="number" placeholder="1.000" value={cerMax} onChange={(event) => setCerMax(event.target.value)} /></label></div><div className="dashboard-column-sort"><button type="button" onClick={() => { setCerSort("asc"); setOpenMenu(""); }}>Lowest first</button><button type="button" onClick={() => { setCerSort("desc"); setOpenMenu(""); }}>Highest first</button></div></FilterMenu></th></tr></thead><tbody>{visibleSamples.map((row) => <tr key={row.sample_id}><td>{row.sample_id}</td><td>{row.type}</td><td>{row.status}</td><td>{metricValue(row.cer)}</td></tr>)}</tbody></table></div>
      <div className="dashboard-catalog-footer"><span>{filteredSamples.length ? `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filteredSamples.length)} of ${filteredSamples.length}` : "No matching samples"}</span><div><button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>Next</button></div></div>
    </section> : null}

    {activeTab === "workflows" ? <section className="dashboard-card dashboard-secondary-view">
      <div className="dashboard-panel-head"><div><h2>Workflows</h2><p>Execution coverage and quality for this sample set.</p></div></div>
      <div className="dashboard-table-wrap"><table><thead><tr><th>Workflow</th><th>Status</th><th>Coverage</th><th>Mean CER</th><th>Mean WER</th><th>Updated</th><th /></tr></thead><tbody>{workflows.map((item) => { const analytics = analyticsByWorkflow[String(item.id)] || {}; return <tr key={item.id}><td>{item.name}</td><td>{item.status}</td><td>{analytics.completed_sample_count || 0} / {sampleCount}</td><td>{metricValue(analytics.metrics?.cer?.mean)}</td><td>{metricValue(analytics.metrics?.wer?.mean)}</td><td>{formatDate(item.updated_at || item.created_at)}</td><td><button className="dashboard-row-action" type="button" onClick={() => onDeleteWorkflow?.(Number(item.id), item.name)} aria-label={`Delete ${item.name}`}><Icon name="delete" /></button></td></tr>; })}</tbody></table></div>
    </section> : null}
  </>;
}
