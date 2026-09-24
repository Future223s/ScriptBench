"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  CollapsibleSection,
  CompactFilterBar,
  DataTable,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  Grid,
  Icon,
  IconButton,
  ImageFrame,
  Inline,
  ListPreview,
  ListRow,
  LoadingPlaceholder,
  LoadingState,
  Notification,
  Panel,
  RadioGroup,
  SectionTitle,
  SegmentedControl,
  Select,
  Stack,
  StepStrip,
  StatusBadge,
  Tabs,
  Textarea,
  TextInput,
} from "../primitives/index.js";

const options = [
  { id: "overview", label: "Overview", count: 18 },
  { id: "activity", label: "Activity", count: 7 },
  { id: "settings", label: "Settings" },
];
const themeNames = {
  atelier: "Scholarly Atelier",
  console: "Research Console",
  night: "Archive Night",
};
const wizardSteps = [
  { id: "details", label: "Details", description: "Name and model" },
  { id: "sample", label: "Sample", description: "Choose source" },
  { id: "review", label: "Review", description: "Confirm setup" },
];
const manuscriptPreview =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='720' height='460' viewBox='0 0 720 460'%3E%3Crect width='720' height='460' fill='%23ede2cc'/%3E%3Cpath d='M90 60h540v340H90z' fill='%23f9f1df' stroke='%239c8869' stroke-width='3'/%3E%3Cg fill='%23826a51' opacity='.72'%3E%3Cpath d='M130 112h390v7H130zm0 27h445v7H130zm0 27h360v7H130zm0 27h410v7H130zm0 27h350v7H130zm0 27h430v7H130zm0 27h375v7H130zm0 27h445v7H130z'/%3E%3C/g%3E%3C/svg%3E";

const catalogRows = [
  { id: "sample", name: "EMMO-La115_1r.png", workflow: "Gemini transcription", status: "Ready", updated: "Sep 17" },
  { id: "artifact", name: "EMMO-La115_1v.png", workflow: "Fable review", status: "Needs review", updated: "Sep 16" },
  { id: "proof", name: "EMMO-La116_2r.png", workflow: "Gemini transcription", status: "Ready", updated: "Sep 14" },
];

function WizardExample() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("details");
  const stepIndex = wizardSteps.findIndex((item) => item.id === step);
  const previous = () => setStep(wizardSteps[Math.max(0, stepIndex - 1)].id);
  const next = () =>
    setStep(wizardSteps[Math.min(wizardSteps.length - 1, stepIndex + 1)].id);

  return (
    <Panel title="Use case: create a workflow">
      <Stack>
        <Notification tone="info">
          A wizard is composed from existing primitives; it adds no new visual
          rules.
        </Notification>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open wizard
        </Button>
      </Stack>
      <Dialog
        open={open}
        size="wide"
        title="Create workflow"
        description="A short, focused setup flow."
        onClose={() => setOpen(false)}
        footer={
          <Inline>
            <Button onClick={previous} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={
                stepIndex === wizardSteps.length - 1
                  ? () => setOpen(false)
                  : next
              }
            >
              {stepIndex === wizardSteps.length - 1
                ? "Create workflow"
                : "Continue"}
            </Button>
          </Inline>
        }
      >
        <Stack>
          <StepStrip steps={wizardSteps} activeId={step} />
          {step === "details" ? (
            <Stack>
              <Field label="Workflow name">
                <TextInput defaultValue="Transcription review" />
              </Field>
              <Field label="Model">
                <Select defaultValue="gemini">
                  <option value="gemini">Gemini</option>
                </Select>
              </Field>
              <Checkbox label="Save as a reusable workflow" defaultChecked />
            </Stack>
          ) : null}
          {step === "sample" ? (
            <Grid>
              <ImageFrame
                variant="zoomable"
                src={manuscriptPreview}
                alt="Selected manuscript sample"
                caption="EMMO-La115_1r.png"
              />
              <Stack>
                <Field label="Sample set">
                  <Select defaultValue="emmo">
                    <option value="emmo">EMMO manuscripts</option>
                  </Select>
                </Field>
                <Notification tone="info">
                  Use the preview to confirm the source material.
                </Notification>
              </Stack>
            </Grid>
          ) : null}
          {step === "review" ? (
            <DescriptionList
              items={[
                ["Workflow", "Transcription review"],
                ["Model", "Gemini"],
                ["Sample set", "EMMO manuscripts"],
                ["Reusable", "Yes"],
              ]}
            />
          ) : null}
        </Stack>
      </Dialog>
    </Panel>
  );
}

export function UiLibraryGallery({ theme }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [mode, setMode] = useState("review");
  const [visibility, setVisibility] = useState("team");
  const [selectedFiles, setSelectedFiles] = useState(["sample"]);
  const [selectedRecord, setSelectedRecord] = useState("sample");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogWorkflow, setCatalogWorkflow] = useState("");
  const themeName = themeNames[theme];
  const visibleCatalogRows = catalogRows.filter((row) =>
    (!catalogQuery || row.name.toLowerCase().includes(catalogQuery.toLowerCase())) &&
    (!catalogWorkflow || row.workflow === catalogWorkflow));
  const previewRecord = catalogRows.find((row) => row.id === selectedRecord);

  return (
    <main className="ui-library-page" data-ui-theme={theme}>
      <header className="ui-library-page__header">
        <p className="ui-eyebrow">ScriptBench UI / {themeName}</p>
        <h1 className="ui-library-page__title">{themeName}</h1>
        <p className="ui-library-page__intro">
          A complete, protected primitive library. Every visual difference is
          supplied by theme tokens; component APIs and variants remain
          identical.
        </p>
        <nav className="ui-library-theme-nav" aria-label="UI libraries">
          <a href="/ui-library/atelier">Atelier</a>
          <a href="/ui-library/console">Console</a>
          <a href="/ui-library/night">Night</a>
        </nav>
      </header>
      <section className="ui-library-section">
        <h2>Actions</h2>
        <Panel title="Button">
          <div className="ui-library-actions">
            <Button variant="primary">Button / primary</Button>
            <Button>Button / secondary</Button>
            <Button variant="danger">Button / danger</Button>
            <Button size="compact">Button / compact</Button>
            <Button disabled>Button / disabled</Button>
          </div>
        </Panel>
      </section>
      <section className="ui-library-section">
        <h2>Icon-only action button</h2>
        <div className="ui-library-grid">
          <Panel title="Primitive">
            <div className="ui-library-actions">
              <IconButton label="Zoom in">
                <Icon name="zoomIn" />
              </IconButton>
              <IconButton label="Zoom out">
                <Icon name="zoomOut" />
              </IconButton>
              <IconButton label="Delete record" variant="danger">
                <Icon name="delete" />
              </IconButton>
              <IconButton label="Add workflow step" variant="primary">
                <Icon name="add" />
              </IconButton>
            </div>
          </Panel>
          <Panel title="Use case: compact image toolbar">
            <div className="ui-library-actions">
              <span>Image tools</span>
              <IconButton label="Zoom out">
                <Icon name="zoomOut" />
              </IconButton>
              <IconButton label="Zoom in">
                <Icon name="zoomIn" />
              </IconButton>
              <IconButton label="Fit image">
                <Icon name="fit" />
              </IconButton>
            </div>
          </Panel>
        </div>
      </section>
      <section className="ui-library-section">
        <h2>Inputs</h2>
        <div className="ui-library-grid">
          <Panel title="Text fields">
            <div className="ui-library-stack">
              <Field label="Workflow name" hint="Visible to collaborators.">
                <TextInput defaultValue="Transcription review" />
              </Field>
              <Field label="Model" error="Choose a supported model.">
                <Select defaultValue="">
                  <option value="">Select a model</option>
                  <option>Gemini</option>
                </Select>
              </Field>
              <Field label="Description">
                <Textarea defaultValue="A short, reusable workflow." />
              </Field>
            </div>
          </Panel>
          <Panel title="Choices">
            <div className="ui-library-stack">
              <Checkbox label="Include source images" defaultChecked />
              <Checkbox label="Disabled choice" disabled />
              <RadioGroup
                label="Visibility"
                name={`visibility-${theme}`}
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: "team", label: "Team" },
                  { value: "private", label: "Private" },
                  { value: "public", label: "Public", disabled: true },
                ]}
              />
            </div>
          </Panel>
        </div>
        <Panel title="Navigation">
          <div className="ui-library-stack">
            <Tabs
              items={options}
              activeId={activeTab}
              onChange={setActiveTab}
            />
            <SegmentedControl
              items={[
                { id: "review", label: "Review" },
                { id: "jobs", label: "Jobs" },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </Panel>
      </section>
      <section className="ui-library-section">
        <h2>Progress and disclosure</h2>
        <div className="ui-library-grid">
          <Panel title="Numbered step strip">
            <StepStrip steps={wizardSteps} activeId="sample" />
          </Panel>
          <Panel title="Collapsible section">
            <Stack>
              <CollapsibleSection
                title="Metrics"
                summary="CER, WER, Hallucinations"
                count="3"
                defaultOpen
              >
                <DescriptionList
                  items={[
                    ["CER", "0.032"],
                    ["WER", "0.071"],
                    ["Hallucinations", "2"],
                  ]}
                />
              </CollapsibleSection>
              <CollapsibleSection
                title="Workflows"
                summary="Attached to this sample set"
                count="4"
              >
                <ListRow title="Transcription review" detail="Gemini" />
              </CollapsibleSection>
            </Stack>
          </Panel>
        </div>
      </section>
      <section className="ui-library-section">
        <h2>Wizard</h2>
        <WizardExample />
      </section>
      <section className="ui-library-section">
        <h2>Structured browsing</h2>
        <CompactFilterBar
          filters={[
            { id: "catalog-search", label: "Search samples", value: catalogQuery, onChange: setCatalogQuery },
            {
              id: "catalog-workflow",
              label: "Workflow",
              kind: "select",
              value: catalogWorkflow,
              onChange: setCatalogWorkflow,
              options: [
                { value: "", label: "All workflows" },
                { value: "Gemini transcription", label: "Gemini transcription" },
                { value: "Fable review", label: "Fable review" },
              ],
            },
            {
              id: "catalog-status",
              label: "Status",
              kind: "select",
              value: "",
              onChange: () => {},
              overflow: true,
              options: [{ value: "", label: "All statuses" }, { value: "ready", label: "Ready" }],
            },
          ]}
          activeFilters={[
            ...(catalogQuery ? [{ id: "query", label: `Search: ${catalogQuery}`, onRemove: () => setCatalogQuery("") }] : []),
            ...(catalogWorkflow ? [{ id: "workflow", label: `Workflow: ${catalogWorkflow}`, onRemove: () => setCatalogWorkflow("") }] : []),
          ]}
          onClearAll={() => { setCatalogQuery(""); setCatalogWorkflow(""); }}
        />
        <ListPreview
          list={
            <DataTable
              ariaLabel="Sample records"
              columns={[
                { id: "name", label: "Sample", width: "34%", className: "ui-data-table__primary" },
                { id: "workflow", label: "Workflow", width: "30%" },
                { id: "status", label: "Status", render: (row) => <StatusBadge tone={row.status === "Ready" ? "success" : "warning"}>{row.status}</StatusBadge> },
                { id: "updated", label: "Updated" },
                { id: "actions", label: "", width: "48px", className: "ui-data-table__actions", render: (row) => <IconButton label={`Delete ${row.name}`} variant="danger"><Icon name="delete" /></IconButton> },
              ]}
              rows={visibleCatalogRows}
              selectedRowId={selectedRecord}
              onRowActivate={(row) => setSelectedRecord(row.id)}
              selectedRowIds={selectedFiles}
              onRowSelectedChange={(row, checked) => setSelectedFiles((items) => checked ? [...items, row.id] : items.filter((item) => item !== row.id))}
            />
          }
          preview={previewRecord ? (
            <Stack gap="compact">
              <SectionTitle>{previewRecord.name}</SectionTitle>
              <DescriptionList items={[["Workflow", previewRecord.workflow], ["Status", previewRecord.status], ["Updated", previewRecord.updated]]} />
              <Button size="compact">Open full detail</Button>
            </Stack>
          ) : <EmptyState title="Select a sample" />}
        />
      </section>
      <section className="ui-library-section">
        <h2>Simple list row</h2>
        <Panel title="Use only when columns are unnecessary">
          <ListRow title="Transcription review" detail="A short, single-detail record" />
        </Panel>
      </section>
      <section className="ui-library-section">
        <h2>Feedback</h2>
        <div className="ui-library-grid">
          <Panel title="Status badges">
            <div className="ui-library-actions">
              <StatusBadge>Neutral</StatusBadge>
              <StatusBadge tone="success">Ready</StatusBadge>
              <StatusBadge tone="info">Running</StatusBadge>
              <StatusBadge tone="warning">Needs review</StatusBadge>
              <StatusBadge tone="danger">Failed</StatusBadge>
            </div>
          </Panel>
          <Panel title="Notifications">
            <div className="ui-library-stack">
              <Notification tone="info">
                Your workflow has been saved.
              </Notification>
              <Notification tone="success">
                Execution completed successfully.
              </Notification>
              <Notification tone="warning">
                Three samples need attention.
              </Notification>
              <Notification tone="danger">
                The upload could not be completed.
              </Notification>
            </div>
          </Panel>
        </div>
      </section>
      <section className="ui-library-section">
        <h2>States</h2>
        <div className="ui-library-grid">
          <Panel title="Empty state">
            <EmptyState
              title="No sample sets yet"
              action={<Button variant="primary">Button / primary</Button>}
            >
              Create a sample set to begin organizing source material.
            </EmptyState>
          </Panel>
          <Panel title="Loading state">
            <LoadingState label="Loading workflow resources" />
          </Panel>
          <Panel title="Loading placeholder">
            <LoadingPlaceholder />
          </Panel>
          <Panel title="Use case: fill a loading panel">
            <LoadingPlaceholder
              variant="fill"
              label="Loading artifact details"
            />
          </Panel>
        </div>
      </section>
    </main>
  );
}
