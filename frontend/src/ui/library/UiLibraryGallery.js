"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  CollapsibleSection,
  DescriptionList,
  Dialog,
  EmptyState,
  Field,
  Grid,
  Icon,
  IconButton,
  ImageFrame,
  Inline,
  ListRow,
  LoadingPlaceholder,
  LoadingState,
  Notification,
  Panel,
  RadioGroup,
  SelectableRow,
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
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
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
                caption="La115_1r_EMMO.png"
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
  const [selectedResource, setSelectedResource] = useState("payload");
  const themeName = themeNames[theme];

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
        <h2>Containers and rows</h2>
        <div className="ui-library-grid">
          <Panel
            eyebrow="Sample set"
            title="Standard panel"
            actions={<Button size="compact">Button / compact</Button>}
          >
            <div className="ui-library-stack">
              <ListRow
                title="EMMO manuscript pages"
                detail="48 samples"
                action={<StatusBadge tone="success">Ready</StatusBadge>}
              />
              <ListRow
                title="Pending import"
                detail="6 samples"
                selected
                action={<Button size="compact">Button / compact</Button>}
              />
            </div>
          </Panel>
          <Panel variant="inset" title="Inset panel">
            Supporting content uses the same locked spacing, border, and type
            scale.
          </Panel>
        </div>
      </section>
      <section className="ui-library-section">
        <h2>Selectable row</h2>
        <div className="ui-library-grid">
          <Panel title="Primitive">
            <div className="ui-library-stack">
              <SelectableRow
                title="La115_1r_EMMO.png"
                detail="Sample · 12.4 MB"
                selected={selectedFiles.includes("sample")}
                onSelectedChange={(checked) =>
                  setSelectedFiles((items) =>
                    checked
                      ? [...items, "sample"]
                      : items.filter((item) => item !== "sample"),
                  )
                }
              />
              <SelectableRow
                title="segmentation_line_crops"
                detail="Artifact · 46 files"
                selected={selectedFiles.includes("artifact")}
                onSelectedChange={(checked) =>
                  setSelectedFiles((items) =>
                    checked
                      ? [...items, "artifact"]
                      : items.filter((item) => item !== "artifact"),
                  )
                }
              />
            </div>
          </Panel>
          <Panel title="Use case: active resource">
            <div className="ui-library-stack">
              <SelectableRow
                selectionMode="single"
                title="Payload template"
                detail="Reusable request definition"
                selected={selectedResource === "payload"}
                onSelectedChange={() => setSelectedResource("payload")}
              />
              <SelectableRow
                selectionMode="single"
                title="Output specification"
                detail="Reusable output definition"
                selected={selectedResource === "output"}
                onSelectedChange={() => setSelectedResource("output")}
              />
            </div>
          </Panel>
        </div>
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
