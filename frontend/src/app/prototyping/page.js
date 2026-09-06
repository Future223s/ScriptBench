"use client";

// PROTOTYPE — evaluates which complex ScriptBench surfaces can be composed from UI primitives alone.
import { useState } from "react";
import {
  Button,
  CanvasEdge,
  CanvasNode,
  CanvasSurface,
  CodeBlock,
  DescriptionList,
  Dialog,
  Field,
  ImageFrame,
  Inline,
  ListRow,
  Notification,
  Panel,
  Select,
  SplitPane,
  Stack,
  StatusBadge,
  Tabs,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

const prototypes = [
  { id: "files", label: "File panels" },
  { id: "image", label: "Image detail" },
  { id: "artifact", label: "Artifact detail" },
  { id: "canvas", label: "Canvas" },
  { id: "step", label: "Step input" },
];
const manuscriptPreview =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='620' viewBox='0 0 960 620'%3E%3Crect width='960' height='620' fill='%23ede2cc'/%3E%3Cpath d='M125 96h710v424H125z' fill='%23f9f1df' stroke='%239c8869' stroke-width='4'/%3E%3Cg fill='%23826a51' opacity='.72'%3E%3Cpath d='M175 160h505v9H175zm0 35h585v9H175zm0 35h470v9H175zm0 35h535v9H175zm0 35h450v9H175zm0 35h570v9H175zm0 35h510v9H175zm0 35h585v9H175zm0 35h455v9H175z'/%3E%3C/g%3E%3C/svg%3E";

function FilePanelsPrototype() {
  return (
    <Panel eyebrow="Prototype" title="File management panels">
      <SplitPane
        primary={
          <Panel title="Filters">
            <Stack gap="compact">
              <Field label="Search files">
                <TextInput placeholder="Filter by name" />
              </Field>
              <Field label="Collection">
                <Select defaultValue="all">
                  <option value="all">All collections</option>
                  <option value="emmo">EMMO source material</option>
                </Select>
              </Field>
            </Stack>
          </Panel>
        }
        secondary={
          <Panel
            title="Files"
            actions={<Button size="compact">Button / primary</Button>}
          >
            <Stack gap="compact">
              <ListRow
                title="La115_1r_EMMO.png"
                detail="Image · 12.4 MB"
                action={<StatusBadge tone="success">Ready</StatusBadge>}
              />
              <ListRow
                title="La115_1r_EMMO_gt.txt"
                detail="Ground truth · 4 KB"
                action={<Button size="compact">Button / compact</Button>}
              />
            </Stack>
          </Panel>
        }
      />
    </Panel>
  );
}

function ImageDetailPrototype() {
  const [open, setOpen] = useState(false);
  return (
    <Panel eyebrow="Prototype" title="Sample detail dialog">
      <Stack>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open sample detail
        </Button>
        <Notification tone="info">
          The dialog mirrors the current sample view: preview at left, ground
          truth and metadata at right.
        </Notification>
      </Stack>
      <Dialog
        open={open}
        size="wide"
        title="La115_1r_EMMO.png"
        description="image/png"
        onClose={() => setOpen(false)}
        footer={
          <Inline>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Button / danger
            </Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Inline>
        }
      >
        <SplitPane
          primary={
            <ImageFrame
              variant="zoomable"
              src={manuscriptPreview}
              alt="La115 manuscript page"
              caption="La115_1r_EMMO.png · 12.4 MB"
            />
          }
          secondary={
            <Stack>
              <CodeBlock label="Ground truth">
                In principio erat Verbum, et Verbum erat apud Deum.
              </CodeBlock>
              <DescriptionList
                items={[
                  ["Sample ID", "La115_1r_EMMO"],
                  ["MIME type", "image/png"],
                  ["Sample sets", "EMMO manuscripts"],
                  ["Updated", "2026-08-30"],
                ]}
              />
            </Stack>
          }
        />
      </Dialog>
    </Panel>
  );
}

function ArtifactDetailPrototype() {
  const [open, setOpen] = useState(false);
  return (
    <Panel eyebrow="Prototype" title="Artifact detail dialog">
      <Stack>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open artifact detail
        </Button>
        <Notification tone="info">
          The dialog mirrors the current artifact view: preview at left,
          artifact details and metadata at right.
        </Notification>
      </Stack>
      <Dialog
        open={open}
        size="wide"
        title="segmentation_line_crops"
        description="Artifact · image/png"
        onClose={() => setOpen(false)}
        footer={
          <Inline>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Button / danger
            </Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Inline>
        }
      >
        <SplitPane
          primary={
            <ImageFrame
              variant="zoomable"
              src={manuscriptPreview}
              alt="Preview of the source manuscript page"
              caption="Derived from La115_1r_EMMO"
            />
          }
          secondary={
            <Stack>
              <DescriptionList
                items={[
                  ["Artifact group", "Segmentation line crops"],
                  ["Origin sample", "La115_1r_EMMO"],
                  ["Category", "Decomposition"],
                  ["MIME type", "image/png"],
                  ["Updated", "2026-08-30"],
                ]}
              />
              <CodeBlock label="Processing details">
                Generated by Escriptorium segmentation.\n46 line crops emitted.
              </CodeBlock>
            </Stack>
          }
        />
      </Dialog>
    </Panel>
  );
}

function CanvasPrototype() {
  const [selectedNode, setSelectedNode] = useState("segment");
  return (
    <Panel eyebrow="Prototype" title="Workflow canvas">
      <Stack>
        <CanvasSurface>
          <CanvasEdge fromX="30" fromY="42" toX="68" toY="42" />
          <CanvasNode
            x="30"
            y="42"
            title="Segment page"
            detail="Image model"
            selected={selectedNode === "segment"}
            onClick={() => setSelectedNode("segment")}
          />
          <CanvasNode
            x="68"
            y="42"
            title="Transcribe lines"
            detail="Text model"
            selected={selectedNode === "transcribe"}
            onClick={() => setSelectedNode("transcribe")}
          />
        </CanvasSurface>
        <Notification tone="info">
          Issue encountered: canvas layout, selection, and zoom are
          primitive-owned; drag, pan, persistence, and graph validation remain
          domain behavior.
        </Notification>
      </Stack>
    </Panel>
  );
}

function StepInputPrototype() {
  const [open, setOpen] = useState(false);
  return (
    <Panel eyebrow="Prototype" title="Workflow builder input modal">
      <Stack>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Button / primary
        </Button>
        <Notification tone="info">
          Issue encountered: `Dialog` owns the overlay and close behavior. Step
          validation and workflow persistence remain domain behavior.
        </Notification>
      </Stack>
      <Dialog
        open={open}
        title="Add workflow step"
        description="Configure the reusable input."
        onClose={() => setOpen(false)}
        footer={
          <Inline>
            <Button onClick={() => setOpen(false)}>Button / secondary</Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Button / primary
            </Button>
          </Inline>
        }
      >
        <Stack>
          <Field label="Step name">
            <TextInput defaultValue="Transcribe line crops" />
          </Field>
          <Field label="Model">
            <Select defaultValue="gemini">
              <option value="gemini">Gemini</option>
            </Select>
          </Field>
          <Field label="Prompt">
            <Textarea defaultValue="Transcribe each image crop faithfully." />
          </Field>
        </Stack>
      </Dialog>
    </Panel>
  );
}

const prototypeById = {
  files: FilePanelsPrototype,
  image: ImageDetailPrototype,
  artifact: ArtifactDetailPrototype,
  canvas: CanvasPrototype,
  step: StepInputPrototype,
};

export default function PrototypingPage() {
  const [activeId, setActiveId] = useState("files");
  const Prototype = prototypeById[activeId];
  return (
    <main>
      <Stack>
        <Panel
          eyebrow="Throwaway prototype"
          title="Primitive-only complex surfaces"
        >
          <Stack>
            <Notification tone="info">
              This route uses only locked primitives. It answers what the
              expanded library can compose without page-specific styling.
            </Notification>
            <Tabs
              items={prototypes}
              activeId={activeId}
              onChange={setActiveId}
            />
          </Stack>
        </Panel>
        <Prototype />
        <Panel title="Remaining integration boundaries">
          <Stack gap="compact">
            <ListRow
              title="Image detail"
              detail="Zoom/pan and annotation tools require explicit ImageFrame variants."
            />
            <ListRow
              title="Canvas"
              detail="Drag, pan, persistence, and graph validation are domain behavior."
            />
            <ListRow
              title="Dialog"
              detail="Field validation and save behavior are supplied by the consuming flow."
            />
          </Stack>
        </Panel>
      </Stack>
    </main>
  );
}
