"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Modal } from "../common/Modal.js";
import { SampleSetCreateModal } from "./SampleSetCreateModal.js";
import {
  Button,
  CollapsibleSection,
  CodeBlock,
  Dialog,
  Field,
  Grid,
  Icon,
  IconButton,
  Inline,
  Instruction,
  Notification,
  Panel,
  Select,
  SectionTitle,
  Stack,
  StepStrip,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

const TABLE_SOURCE_FIELDS = {
  artifacts: [
    "artifact_id",
    "artifact_name",
    "originating_sample_id",
    "artifact_group_id",
    "artifact_category",
    "artifact_blob",
    "artifact_mime_type",
  ],
  samples: [
    "sample_id",
    "sample_name",
    "sample_blob",
    "sample_mime_type",
    "ground_truth_text",
  ],
  model_outputs: [
    "model_output_id",
    "workflow_step_id",
    "sample_id",
    "parsed_output",
    "raw_model_response",
    "parse_status",
    "time_elapsed",
    "completed_at",
  ],
};

const TABLE_SOURCE_MATCH_FIELDS = {
  artifacts: ["originating_sample_id"],
  samples: ["sample_id"],
  model_outputs: ["sample_id"],
};

const COMMON_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "application/octet-stream",
];

function ResourceDetailModal({ open, record, actions }) {
  return (
    <Modal
      open={open}
      panelClassName="resource-detail-modal"
      data-modal="resource-detail"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeResourceDetail();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>{record?.title || "Resource"}</h2>
          <span>{record?.typeLabel || "Detail"}</span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeResourceDetail}
        >
          Close
        </button>
      </div>
      <div className="modal-body">
        {record ? (
          <div className="resource-detail-grid">
            <div className="ground-truth-box">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                {(record.metadata || []).map(([label, value]) => (
                  <div className="metadata-row" key={label}>
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="ground-truth-box">
              {(record.sections || []).map((section) => (
                <div key={section.title} className="resource-detail-section">
                  <h3>{section.title}</h3>
                  <pre>{section.content || ""}</pre>
                </div>
              ))}
              <div className="resource-detail-section">
                <h3>Raw record</h3>
                <pre>{JSON.stringify(record.raw || {}, null, 2)}</pre>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState>No resource selected.</EmptyState>
        )}
      </div>
    </Modal>
  );
}

function ArtifactGroupCreateModal({ open, state, actions }) {
  const draft = state.createArtifactGroupDraft;
  const step = state.createArtifactGroupStep;
  const stepTitle =
    step === 1
      ? "Group Details"
      : step === 2
        ? "Group Membership"
        : step === 3
          ? "Sample Mapping"
          : "Review and Create";

  return (
    <Modal
      open={open}
      panelClassName="artifact-group-create-modal"
      data-modal="artifact-group-create"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeCreateArtifactGroup();
        }
      }}
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Artifact Group</h2>
          <span>
            Step {step} of 4: {stepTitle}
          </span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateArtifactGroup}
        >
          Close
        </button>
      </div>
      <div className="modal-body artifact-group-create-body">
        {step === 1 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="artifact-group-name">Group name</label>
              <input
                id="artifact-group-name"
                value={draft.groupName}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "groupName",
                    event.target.value,
                  )
                }
                placeholder="Line Artifacts"
              />
            </div>
            <div className="field wide">
              <label htmlFor="artifact-group-description">Description</label>
              <textarea
                id="artifact-group-description"
                rows="4"
                value={draft.description}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "description",
                    event.target.value,
                  )
                }
                placeholder="Artifacts representing extracted text lines"
              />
            </div>
            <div className="field wide">
              <label>Mapping type</label>
              <div className="artifact-group-radio-grid">
                <label className="artifact-group-radio-option">
                  <input
                    type="radio"
                    checked={draft.mappingType === "one-to-one"}
                    onChange={() =>
                      actions.setCreateArtifactGroupField(
                        "mappingType",
                        "one-to-one",
                      )
                    }
                  />
                  <span>One-to-one</span>
                </label>
                <label className="artifact-group-radio-option">
                  <input
                    type="radio"
                    checked={draft.mappingType === "one-to-many"}
                    onChange={() =>
                      actions.setCreateArtifactGroupField(
                        "mappingType",
                        "one-to-many",
                      )
                    }
                  />
                  <span>One-to-many</span>
                </label>
              </div>
            </div>
            <div className="field wide">
              <label htmlFor="artifact-group-ordering">Ordering</label>
              <select
                id="artifact-group-ordering"
                value={draft.ordering}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "ordering",
                    event.target.value,
                  )
                }
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="artifact-id">Artifact ID</option>
              </select>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="membership-artifact-field">Artifact field</label>
              <select
                id="membership-artifact-field"
                value={draft.membershipArtifactField}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "membershipArtifactField",
                    event.target.value,
                  )
                }
              >
                <option value="artifact_name">Artifact name</option>
                <option value="originating_sample_id">
                  Originating sample ID
                </option>
                <option value="artifact_group_name">Artifact group name</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="membership-operator">Operator</label>
              <select
                id="membership-operator"
                value={draft.membershipOperator}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "membershipOperator",
                    event.target.value,
                  )
                }
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="membership-pattern">Pattern</label>
              <input
                id="membership-pattern"
                value={draft.membershipPattern}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "membershipPattern",
                    event.target.value,
                  )
                }
                placeholder="_line_"
              />
            </div>
            <div className="field wide">
              <label className="artifact-group-checkbox-option">
                <input
                  type="checkbox"
                  checked={draft.membershipCaseSensitive}
                  onChange={(event) =>
                    actions.setCreateArtifactGroupField(
                      "membershipCaseSensitive",
                      event.target.checked,
                    )
                  }
                />
                <span>Case sensitive</span>
              </label>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="sample-mapping-artifact-field">
                Artifact field
              </label>
              <select
                id="sample-mapping-artifact-field"
                value={draft.sampleMappingArtifactField}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "sampleMappingArtifactField",
                    event.target.value,
                  )
                }
              >
                <option value="artifact_name">Artifact name</option>
                <option value="originating_sample_id">
                  Originating sample ID
                </option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sample-mapping-sample-field">Sample field</label>
              <select
                id="sample-mapping-sample-field"
                value={draft.sampleMappingSampleField}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "sampleMappingSampleField",
                    event.target.value,
                  )
                }
              >
                <option value="sample_name">Sample name</option>
                <option value="sample_id">Sample ID</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="sample-mapping-operator">Operator</label>
              <select
                id="sample-mapping-operator"
                value={draft.sampleMappingOperator}
                onChange={(event) =>
                  actions.setCreateArtifactGroupField(
                    "sampleMappingOperator",
                    event.target.value,
                  )
                }
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
              </select>
            </div>
            <div className="field wide">
              <label className="artifact-group-checkbox-option">
                <input
                  type="checkbox"
                  checked={draft.sampleMappingCaseSensitive}
                  onChange={(event) =>
                    actions.setCreateArtifactGroupField(
                      "sampleMappingCaseSensitive",
                      event.target.checked,
                    )
                  }
                />
                <span>Case sensitive</span>
              </label>
            </div>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="artifact-group-review-grid">
            <div className="ground-truth-box">
              <h3>Group</h3>
              <div className="metadata-grid">
                <div className="metadata-row">
                  <span>Name</span>
                  <strong>{draft.groupName || "Not set"}</strong>
                </div>
                <div className="metadata-row">
                  <span>Mapping type</span>
                  <strong>{draft.mappingType}</strong>
                </div>
                <div className="metadata-row">
                  <span>Ordering</span>
                  <strong>{draft.ordering}</strong>
                </div>
              </div>
            </div>
            <div className="ground-truth-box">
              <h3>Membership rule</h3>
              <pre>{`${draft.membershipArtifactField} ${draft.membershipOperator} "${draft.membershipPattern || ""}"`}</pre>
              <h3>Sample mapping</h3>
              <pre>{`${draft.sampleMappingArtifactField} ${draft.sampleMappingOperator} ${draft.sampleMappingSampleField}`}</pre>
              <h3>Description</h3>
              <pre>{draft.description || "No description provided."}</pre>
            </div>
          </div>
        ) : null}
      </div>
      <div className="modal-footer">
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateArtifactGroup}
          disabled={state.createArtifactGroupLoading}
        >
          Cancel
        </button>
        <div className="inline-actions">
          {step > 1 ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={actions.previousCreateArtifactGroupStep}
              disabled={state.createArtifactGroupLoading}
            >
              Back
            </button>
          ) : null}
          {step < 4 ? (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.nextCreateArtifactGroupStep}
              disabled={state.createArtifactGroupLoading}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.submitCreateArtifactGroup}
              disabled={state.createArtifactGroupLoading}
            >
              {state.createArtifactGroupLoading
                ? "Creating..."
                : "Create Artifact Group"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ResourceCatalogOverlays({ state, actions }) {
  return (
    <>
      <SampleSetCreateModal
        open={state.createSampleSetOpen}
        draft={state.createSampleSetDraft}
        filters={state.sampleFilters}
        filterActions={
          <>
            <button
              className="btn-secondary"
              type="button"
              onClick={actions.applySampleFilters}
            >
              Apply filter
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={actions.clearSampleFilters}
            >
              Clear
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={actions.toggleAllVisibleSampleSetSamples}
            >
              {state.visibleSamples.length > 0 &&
              state.visibleSamples.every((sample) =>
                state.createSampleSetDraft.sampleIds.includes(
                  String(sample.sample_id),
                ),
              )
                ? "Unselect all"
                : "Select all"}
            </button>
          </>
        }
        samples={state.visibleSamples || []}
        loading={state.createSampleSetLoading}
        actions={actions}
      />
      <ResourceDetailModal
        open={state.detailOpen}
        record={state.selectedResource}
        actions={actions}
      />
      <ArtifactGroupCreateModal
        open={state.createArtifactGroupOpen}
        state={state}
        actions={actions}
      />
      <WorkflowStepCreateModal state={state} actions={actions} />
      <PayloadTemplateCreateModal state={state} actions={actions} />
      <OutputSpecCreateModal state={state} actions={actions} />
    </>
  );
}

const promptResourceTables = {
  artifacts: [
    "artifact_id",
    "artifact_name",
    "originating_sample_id",
    "artifact_group_id",
    "artifact_category",
    "artifact_mime_type",
  ],
  samples: [
    "sample_id",
    "sample_name",
    "sample_mime_type",
    "ground_truth_text",
  ],
};

function PromptResourceCard({ resource, index, actions }) {
  const fields = promptResourceTables[resource.table] || [];
  const hasName = resource.name.trim().length > 0;
  const hasTable = Boolean(resource.table);
  return (
    <Panel
      title={resource.name || "Prompt data"}
      actions={
        <IconButton
          label="Remove prompt data"
          variant="danger"
          onClick={() => actions.removePayloadResource(index)}
        >
          <Icon name="delete" />
        </IconButton>
      }
    >
      <Stack gap="compact">
        <SectionTitle>Name</SectionTitle>
        <TextInput
          aria-label="Name for this data"
          value={resource.name}
          onChange={(event) =>
            actions.updatePayloadResource(index, "name", event.target.value)
          }
          placeholder="line_crops"
        />
        {hasName ? (
          <>
            <SectionTitle>Get data from</SectionTitle>
            <Select
              aria-label="Get data from"
              value={resource.table}
              onChange={(event) =>
                actions.updatePayloadResource(
                  index,
                  "table",
                  event.target.value,
                )
              }
            >
              <option value="">Choose a table</option>
              <option value="artifacts">Artifacts</option>
              <option value="samples">Samples</option>
            </Select>
          </>
        ) : null}
        {hasTable ? (
          <>
            <SectionTitle>Where</SectionTitle>
            <Stack gap="compact">
              {resource.conditions.map((condition, conditionIndex) => (
                <Grid columns={4} key={conditionIndex}>
                  <Field density="compact" label="Field">
                    <Select
                      value={condition.field}
                      onChange={(event) =>
                        actions.updatePayloadResourceCondition(
                          index,
                          conditionIndex,
                          "field",
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Choose a field</option>
                      {fields.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {condition.field ? (
                    <Field density="compact" label="Operator">
                      <Select
                        value={condition.operator}
                        onChange={(event) =>
                          actions.updatePayloadResourceCondition(
                            index,
                            conditionIndex,
                            "operator",
                            event.target.value,
                          )
                        }
                      >
                        <option value="equals">is</option>
                        <option value="not_equals">is not</option>
                        <option value="greater_than">is greater than</option>
                        <option value="less_than">is less than</option>
                        <option value="contains">contains</option>
                      </Select>
                    </Field>
                  ) : null}
                  {condition.operator ? (
                    <Field density="compact" label="Value type">
                      <Select
                        value={condition.valueType}
                        onChange={(event) =>
                          actions.updatePayloadResourceCondition(
                            index,
                            conditionIndex,
                            "valueType",
                            event.target.value,
                          )
                        }
                      >
                        <option value="sample-field">Sample field</option>
                        <option value="manual">Manual value</option>
                      </Select>
                    </Field>
                  ) : null}
                  {condition.valueType ? (
                    <Field
                      density="compact"
                      label="Value"
                      action={
                        <IconButton
                          label="Remove condition"
                          variant="danger"
                          onClick={() =>
                            actions.removePayloadResourceCondition(
                              index,
                              conditionIndex,
                            )
                          }
                        >
                          <Icon name="delete" />
                        </IconButton>
                      }
                    >
                      {condition.valueType === "sample-field" ? (
                        <Select
                          value={condition.value}
                          onChange={(event) =>
                            actions.updatePayloadResourceCondition(
                              index,
                              conditionIndex,
                              "value",
                              event.target.value,
                            )
                          }
                        >
                          <option value="sample_id">sample_id</option>
                          <option value="sample_name">sample_name</option>
                          <option value="sample_mime_type">
                            sample_mime_type
                          </option>
                          <option value="ground_truth_text">
                            ground_truth_text
                          </option>
                        </Select>
                      ) : (
                        <TextInput
                          value={condition.value}
                          onChange={(event) =>
                            actions.updatePayloadResourceCondition(
                              index,
                              conditionIndex,
                              "value",
                              event.target.value,
                            )
                          }
                          placeholder="Value"
                        />
                      )}
                    </Field>
                  ) : null}
                </Grid>
              ))}
              <Button
                size="compact"
                onClick={() => actions.addPayloadResourceCondition(index)}
              >
                Add condition
              </Button>
            </Stack>
          </>
        ) : null}
        {hasTable ? (
          <>
            <SectionTitle>Batch</SectionTitle>
            <Field
              density="compact"
              label="Batch limit"
              hint="Maximum matching rows included in one prompt run."
            >
              <TextInput
                type="number"
                min="1"
                value={resource.batchLimit}
                onChange={(event) =>
                  actions.updatePayloadResource(
                    index,
                    "batchLimit",
                    event.target.value,
                  )
                }
              />
            </Field>
          </>
        ) : null}
      </Stack>
    </Panel>
  );
}

function PayloadTemplateCreateModal({ state, actions }) {
  const draft = state.createPayloadTemplateDraft;
  const step = state.createPayloadTemplateStep;
  const next =
    step === 1
      ? actions.nextCreatePayloadTemplateStep
      : () => actions.nextCreatePayloadTemplateStep();
  const example = `{
  "role": "user",
  "content": [{ "type": "input_text", "text": "{{instructions.text}}" }],
  "$each": {
    "resource": "line_crops",
    "into": "content",
    "template": { "type": "input_text", "text": "{{line_crops.artifact_name}}" }
  }
}`;
  return (
    <Dialog
      open={state.createPayloadTemplateOpen}
      title="Create payload template"
      description={`Step ${step} of 3`}
      size="wide"
      onClose={actions.closeCreatePayloadTemplate}
      footer={
        <Inline gap="compact" justify="end">
          <Button
            onClick={
              step === 1
                ? actions.closeCreatePayloadTemplate
                : actions.previousCreatePayloadTemplateStep
            }
          >
            {" "}
            {step === 1 ? "Cancel" : "Back"}{" "}
          </Button>
          <Button
            variant="primary"
            onClick={step < 3 ? next : actions.submitCreatePayloadTemplate}
            disabled={state.createPayloadTemplateLoading}
          >
            {step < 3
              ? "Next"
              : state.createPayloadTemplateLoading
                ? "Creating..."
                : "Create payload template"}
          </Button>
        </Inline>
      }
    >
      <Stack>
        <StepStrip
          activeId={`step-${step}`}
          steps={[
            { id: "step-1", label: "Metadata" },
            { id: "step-2", label: "Prompt data" },
            { id: "step-3", label: "Prompt JSON" },
          ]}
        />
        {step === 1 ? (
          <Stack>
            <Field label="Template name">
              <TextInput
                value={draft.name}
                onChange={(event) =>
                  actions.updatePayloadDraft("name", event.target.value)
                }
                placeholder="Document transcription"
              />
            </Field>
            <Field label="Model family">
              <TextInput
                value={draft.modelFamily}
                onChange={(event) =>
                  actions.updatePayloadDraft("modelFamily", event.target.value)
                }
                placeholder="openai"
              />
            </Field>
            <Field label="Description" hint="Optional">
              <Textarea
                rows="3"
                value={draft.description}
                onChange={(event) =>
                  actions.updatePayloadDraft("description", event.target.value)
                }
              />
            </Field>
          </Stack>
        ) : null}
        {step === 2 ? (
          <Stack>
            <Notification tone="info">
              Choose project data that this prompt can use. Each source resolves
              matching database records for the current sample.
            </Notification>
            {draft.resources.map((resource, index) => (
              <PromptResourceCard
                key={index}
                resource={resource}
                index={index}
                actions={actions}
              />
            ))}
            <Button onClick={actions.addPayloadResource}>
              Add prompt data
            </Button>
          </Stack>
        ) : null}
        {step === 3 ? (
          <Stack>
            <SectionTitle>Instructions</SectionTitle>
            <Instruction>
              Use {"{{resource.attribute}}"} for a row value. Use $each when a
              data source returns multiple matching rows.
            </Instruction>
            <CollapsibleSection
              title="Example"
              summary="Open for interpolation and $each syntax"
            >
              <CodeBlock>{example}</CodeBlock>
            </CollapsibleSection>
            <SectionTitle>Available prompt data</SectionTitle>
            <Instruction>
              Click a prompt-data item to show the fields you can reference.
            </Instruction>
            <Stack gap="compact">
              {draft.resources.length ? (
                draft.resources.map((resource, index) => (
                  <CollapsibleSection
                    key={index}
                    title={resource.name || "Unnamed data"}
                  >
                    <Stack gap="compact">
                      {(promptResourceTables[resource.table] || []).map(
                        (field) => (
                          <Instruction
                            key={field}
                          >{`{{${resource.name || "resource"}.${field}}}`}</Instruction>
                        ),
                      )}
                    </Stack>
                  </CollapsibleSection>
                ))
              ) : (
                <Instruction>
                  Add prompt data on the previous step to reference it here.
                </Instruction>
              )}
            </Stack>
            <Field label="Prompt JSON">
              <Textarea
                indentOnTab
                rows="18"
                value={draft.promptJson}
                onChange={(event) =>
                  actions.updatePayloadDraft("promptJson", event.target.value)
                }
              />
            </Field>
          </Stack>
        ) : null}
      </Stack>
    </Dialog>
  );
}

function OutputSpecCreateModal({ state, actions }) {
  const draft = state.createOutputSpecDraft;
  return (
    <Modal
      open={state.createOutputSpecOpen}
      panelClassName="output-spec-create-modal"
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Output Specification</h2>
          <span>Define the shape returned by the model</span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateOutputSpec}
        >
          Close
        </button>
      </div>
      <div className="modal-body output-spec-create-body">
        <div className="form-grid">
          <div className="field wide">
            <label htmlFor="output-spec-name">Name</label>
            <input
              id="output-spec-name"
              value={draft.name}
              onChange={(event) =>
                actions.updateCreateOutputSpecField("name", event.target.value)
              }
              placeholder="Document analysis result"
            />
          </div>
          <div className="field">
            <label htmlFor="output-spec-type">Type</label>
            <select
              id="output-spec-type"
              value={draft.type}
              onChange={(event) =>
                actions.updateCreateOutputSpecField("type", event.target.value)
              }
            >
              <option value="json">JSON</option>
              <option value="plain-text">Plain text</option>
            </select>
          </div>
          <div className="field wide">
            <label htmlFor="output-spec-instructions">
              Instructions <span>Optional</span>
            </label>
            <textarea
              id="output-spec-instructions"
              rows="4"
              value={draft.instructions}
              onChange={(event) =>
                actions.updateCreateOutputSpecField(
                  "instructions",
                  event.target.value,
                )
              }
              placeholder="Describe the expected model output."
            />
          </div>
          <div className="field wide">
            <div className="output-spec-schema-heading">
              <label>Item schema</label>
              <div
                className="output-spec-mode-toggle"
                role="tablist"
                aria-label="Item schema mode"
              >
                <button
                  className={draft.schemaMode === "fields" ? "is-active" : ""}
                  type="button"
                  onClick={() =>
                    actions.updateCreateOutputSpecField("schemaMode", "fields")
                  }
                >
                  Fields
                </button>
                <button
                  className={draft.schemaMode === "json" ? "is-active" : ""}
                  type="button"
                  onClick={() =>
                    actions.updateCreateOutputSpecField("schemaMode", "json")
                  }
                >
                  JSON
                </button>
              </div>
            </div>
            {draft.schemaMode === "fields" ? (
              <div className="output-spec-fields-editor">
                {draft.fields.map((field, index) => (
                  <div className="output-spec-field-row" key={index}>
                    <input
                      placeholder="Field name"
                      value={field.name}
                      onChange={(event) =>
                        actions.updateOutputSpecField(
                          index,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      placeholder="Description"
                      value={field.description}
                      onChange={(event) =>
                        actions.updateOutputSpecField(
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                    />
                    <button
                      className="payload-remove-button"
                      type="button"
                      aria-label="Remove field"
                      onClick={() => actions.removeOutputSpecField(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  className="btn-secondary btn-tight"
                  type="button"
                  onClick={actions.addOutputSpecField}
                >
                  ＋ Add field
                </button>
              </div>
            ) : (
              <textarea
                id="output-spec-schema"
                className="payload-json-editor"
                rows="8"
                value={draft.itemSchema}
                onChange={(event) =>
                  actions.updateCreateOutputSpecField(
                    "itemSchema",
                    event.target.value,
                  )
                }
              />
            )}
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateOutputSpec}
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          type="button"
          onClick={actions.submitCreateOutputSpec}
          disabled={state.createOutputSpecLoading}
        >
          {state.createOutputSpecLoading
            ? "Creating..."
            : "Create output specification"}
        </button>
      </div>
    </Modal>
  );
}

function WorkflowStepCreateModal({ state, actions }) {
  const draft = state.createWorkflowStepDraft;
  const step = state.createWorkflowStepStep;
  const templates = (state.payloadTemplates || []).filter(
    (item) => !draft.modelFamily || item.model_family === draft.modelFamily,
  );
  return (
    <Modal
      open={state.createWorkflowStepOpen}
      panelClassName="workflow-step-create-modal"
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Workflow Step</h2>
          <span>Step {step} of 3</span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateWorkflowStep}
        >
          Close
        </button>
      </div>
      <div className="modal-body workflow-step-create-body">
        <div className="payload-stepper">
          <span className={step === 1 ? "is-active" : "is-complete"}>
            01 <b>Metadata</b>
          </span>
          <i />
          <span
            className={step === 2 ? "is-active" : step > 2 ? "is-complete" : ""}
          >
            02 <b>Payload template</b>
          </span>
          <i />
          <span className={step === 3 ? "is-active" : ""}>
            03 <b>Output spec</b>
          </span>
        </div>
        {step === 1 ? (
          <div className="form-grid">
            <div className="field wide">
              <label>Step name</label>
              <input
                value={draft.stepName}
                onChange={(event) =>
                  actions.updateCreateWorkflowStepField(
                    "stepName",
                    event.target.value,
                  )
                }
                placeholder="Analyze document"
              />
            </div>
            <div className="field">
              <label>Model family</label>
              <input
                value={draft.modelFamily}
                onChange={(event) =>
                  actions.updateCreateWorkflowStepField(
                    "modelFamily",
                    event.target.value,
                  )
                }
                placeholder="openai"
              />
            </div>
            <div className="field">
              <label>Model</label>
              <input
                value={draft.model}
                onChange={(event) =>
                  actions.updateCreateWorkflowStepField(
                    "model",
                    event.target.value,
                  )
                }
                placeholder="gpt-4.1"
              />
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="resource-choice-list">
            {templates.length ? (
              templates.map((template) => (
                <button
                  className={
                    String(draft.payloadTemplateId) ===
                    String(template.payload_template_id)
                      ? "resource-choice is-selected"
                      : "resource-choice"
                  }
                  type="button"
                  key={template.payload_template_id}
                  onClick={() =>
                    actions.updateCreateWorkflowStepField(
                      "payloadTemplateId",
                      template.payload_template_id,
                    )
                  }
                >
                  <strong>{template.payload_template_name}</strong>
                  <span>{template.model_family || "Unknown family"}</span>
                </button>
              ))
            ) : (
              <div className="payload-empty-state">
                <strong>No compatible payload templates</strong>
                <Button
                  size="compact"
                  variant="primary"
                  onClick={actions.openCreatePayloadTemplate}
                >
                  Create +
                </Button>
              </div>
            )}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="resource-choice-list">
            {(state.outputSpecs || []).length ? (
              state.outputSpecs.map((spec) => (
                <button
                  className={
                    String(draft.outputSpecId) === String(spec.output_spec_id)
                      ? "resource-choice is-selected"
                      : "resource-choice"
                  }
                  type="button"
                  key={spec.output_spec_id}
                  onClick={() =>
                    actions.updateCreateWorkflowStepField(
                      "outputSpecId",
                      spec.output_spec_id,
                    )
                  }
                >
                  <strong>{spec.output_spec_name}</strong>
                  <span>{spec.type || "Output specification"}</span>
                </button>
              ))
            ) : (
              <div className="payload-empty-state">
                <strong>No output specifications</strong>
                <Button
                  size="compact"
                  variant="primary"
                  onClick={actions.openCreateOutputSpec}
                >
                  Create +
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="modal-footer">
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreateWorkflowStep}
        >
          Cancel
        </button>
        <div className="inline-actions">
          {step > 1 ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={actions.previousCreateWorkflowStep}
            >
              Back
            </button>
          ) : null}
          {step < 3 ? (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.nextCreateWorkflowStep}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.submitCreateWorkflowStep}
              disabled={state.createWorkflowStepLoading}
            >
              {state.createWorkflowStepLoading
                ? "Creating..."
                : "Create workflow step"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function LegacyPayloadTemplateCreateModal({ state, actions }) {
  const draft = state.createPayloadTemplateDraft;
  const step = state.createPayloadTemplateStep;
  const selectedMessage =
    draft.selectedMessageIndex == null
      ? null
      : draft.messages[draft.selectedMessageIndex];
  const visibleInputs = draft.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.messageIndex === draft.selectedMessageIndex);
  const sourceRecords = {
    asset: state.assets || [],
    textAsset: (state.assets || []).filter((record) => {
      const mimeType = String(record.asset_mime_type || "").toLowerCase();
      return mimeType === "text" || mimeType.startsWith("text/");
    }),
  };
  const workflowSteps = state.workflowSteps || [];
  return (
    <Modal
      open={state.createPayloadTemplateOpen}
      panelClassName="payload-template-create-modal"
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Payload Template</h2>
          <span>
            Step {step} of 2 ·{" "}
            {step === 1 ? "Template metadata" : "Messages and inputs"}
          </span>
        </div>
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreatePayloadTemplate}
        >
          Close
        </button>
      </div>
      <div className="payload-stepper">
        <span className={step === 1 ? "is-active" : "is-complete"}>
          01 <b>Metadata</b>
        </span>
        <i />
        <span className={step === 2 ? "is-active" : ""}>
          02 <b>Prompt structure</b>
        </span>
      </div>
      <div className="modal-body payload-template-builder">
        {step === 1 ? (
          <div className="payload-metadata-stage">
            <div className="payload-stage-intro">
              <span className="payload-eyebrow">Template identity</span>
              <h3>Give your prompt a clear home.</h3>
              <p>
                Define the reusable payload shell and the model family that will
                interpret it.
              </p>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Template name</label>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    actions.updatePayloadDraft("name", e.target.value)
                  }
                  placeholder="document-analysis"
                />
              </div>
              <div className="field">
                <label>Model family</label>
                <input
                  value={draft.modelFamily}
                  onChange={(e) =>
                    actions.updatePayloadDraft("modelFamily", e.target.value)
                  }
                  placeholder="openai"
                />
              </div>
              <div className="field wide">
                <label>
                  Description <span>Optional</span>
                </label>
                <textarea
                  rows="3"
                  value={draft.description}
                  onChange={(e) =>
                    actions.updatePayloadDraft("description", e.target.value)
                  }
                  placeholder="Analyze a source document with supporting artifacts."
                />
              </div>
              <div className="field wide">
                <label>
                  Root payload template <span>JSON</span>
                </label>
                <textarea
                  className="payload-json-editor"
                  rows="7"
                  value={draft.rootTemplate}
                  onChange={(e) =>
                    actions.updatePayloadDraft("rootTemplate", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="payload-structure-stage">
            <div className="payload-stage-intro compact">
              <div>
                <span className="payload-eyebrow">Prompt structure</span>
                <h3>Assemble the message sequence.</h3>
                <p>
                  Right-click a message to select it and reveal only its inputs.
                </p>
              </div>
              <button
                className="btn-secondary"
                type="button"
                onClick={actions.addPayloadMessage}
              >
                ＋ Add message
              </button>
            </div>
            <div className="payload-template-columns">
              <section className="payload-builder-panel">
                <div className="payload-panel-heading">
                  <div>
                    <h3>Messages</h3>
                    <p>
                      {draft.messages.length} ordered message
                      {draft.messages.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="payload-message-list">
                  {draft.messages.length ? (
                    draft.messages.map((message, index) => (
                      <div
                        className={[
                          "payload-message-card",
                          draft.selectedMessageIndex === index
                            ? "is-selected"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={message.client_id}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          actions.togglePayloadMessageSelection(index);
                        }}
                      >
                        <div className="payload-message-index">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="payload-message-main">
                          <div className="payload-message-topline">
                            <select
                              value={message.role}
                              onChange={(e) =>
                                actions.updatePayloadMessage(
                                  index,
                                  "role",
                                  e.target.value,
                                )
                              }
                            >
                              <option>system</option>
                              <option>developer</option>
                              <option>user</option>
                              <option>assistant</option>
                            </select>
                            <input
                              placeholder="Message label"
                              value={message.label}
                              onChange={(e) =>
                                actions.updatePayloadMessage(
                                  index,
                                  "label",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <textarea
                            rows="4"
                            value={message.message_template}
                            onChange={(e) =>
                              actions.updatePayloadMessage(
                                index,
                                "message_template",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <button
                          className="payload-remove-button"
                          type="button"
                          aria-label="Remove message"
                          onClick={() => actions.removePayloadMessage(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="payload-empty-state">
                      <strong>No messages yet</strong>
                      <span>Add a message to begin building the prompt.</span>
                    </div>
                  )}
                </div>
              </section>
              <section className="payload-builder-panel">
                <div className="payload-panel-heading">
                  <div>
                    <h3>
                      {selectedMessage
                        ? `${selectedMessage.role} inputs`
                        : "Inputs"}
                    </h3>
                    <p>
                      {selectedMessage
                        ? `Bound to message ${draft.selectedMessageIndex + 1}${selectedMessage.label ? ` · ${selectedMessage.label}` : ""}`
                        : "Right-click a message to inspect its inputs."}
                    </p>
                  </div>
                  <button
                    className="btn-secondary btn-tight"
                    type="button"
                    onClick={actions.addPayloadInput}
                    disabled={!selectedMessage}
                  >
                    ＋ Add input
                  </button>
                </div>
                {selectedMessage ? (
                  <div className="payload-input-list">
                    {visibleInputs.length ? (
                      visibleInputs.map(({ input, index }) => (
                        <div className="payload-input-card" key={index}>
                          <div className="payload-input-card-header">
                            <div>
                              <span className="payload-input-eyebrow">
                                Payload input {index + 1}
                              </span>
                              <strong>
                                {input.sourceType === "table_rows"
                                  ? "Matched table rows"
                                  : input.sourceType === "model_output"
                                    ? "Previous step structured output"
                                    : input.sourceType || "Pasted text"}
                              </strong>
                            </div>
                            <button
                              className="payload-remove-button"
                              type="button"
                              aria-label="Remove input"
                              onClick={() => actions.removePayloadInput(index)}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="payload-input-grid">
                            {input.bindingMode === "fixed" && (
                              <select
                                className="payload-input-type-control"
                                value={input.inputType}
                                aria-label="Input type"
                                onChange={(e) => {
                                  const inputType = e.target.value;
                                  actions.updatePayloadInput(
                                    index,
                                    "inputType",
                                    inputType,
                                  );
                                  actions.updatePayloadInput(
                                    index,
                                    "sourceType",
                                    null,
                                  );
                                }}
                              >
                                <option value="text">text</option>
                                <option value="file">file</option>
                              </select>
                            )}
                            <select
                              className="payload-binding-control"
                              value={input.bindingMode}
                              onChange={(e) => {
                                const bindingMode = e.target.value;
                                actions.updatePayloadInput(
                                  index,
                                  "bindingMode",
                                  bindingMode,
                                );
                                actions.updatePayloadInput(
                                  index,
                                  "sourceType",
                                  bindingMode === "sample-bound"
                                    ? "table_rows"
                                    : null,
                                );
                                if (bindingMode === "sample-bound") {
                                  actions.updatePayloadInput(
                                    index,
                                    "inputType",
                                    "text",
                                  );
                                }
                              }}
                            >
                              <option value="fixed">fixed</option>
                              <option value="sample-bound">sample-bound</option>
                            </select>
                            {!(
                              input.bindingMode === "sample-bound" &&
                              input.sourceType === "table_rows"
                            ) && (
                              <select
                                className="payload-source-control"
                                value={input.sourceType ?? ""}
                                aria-label="Input source"
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "sourceType",
                                    e.target.value || null,
                                  )
                                }
                              >
                                {input.inputType === "text" &&
                                input.bindingMode === "fixed" ? (
                                  <>
                                    <option value="">Paste text</option>
                                    <option>asset</option>
                                  </>
                                ) : input.inputType === "text" &&
                                  input.bindingMode === "sample-bound" ? (
                                  <>
                                    <option>sample</option>
                                    <option>artifact</option>
                                    <option value="model_output">
                                      Previous step output
                                    </option>
                                  </>
                                ) : input.bindingMode === "fixed" ? (
                                  <>
                                    <option value="">Select source</option>
                                    <option>asset</option>
                                  </>
                                ) : (
                                  <>
                                    <option>sample</option>
                                    <option>artifact</option>
                                  </>
                                )}
                              </select>
                            )}
                            {input.inputType === "text" &&
                            input.sourceType == null ? (
                              <textarea
                                rows="3"
                                placeholder="Paste text"
                                value={input.fixedValue}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "fixedValue",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : input.sourceType === "asset" ? (
                              <input
                                list={`fixed-source-options-${index}`}
                                placeholder={
                                  input.inputType === "text"
                                    ? "Search text assets"
                                    : "Search assets"
                                }
                                value={input.sourceObjectId}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "sourceObjectId",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType === "sample" ? (
                              <span className="payload-input-source-note">
                                Current sample
                              </span>
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType === "artifact" ? (
                              <input
                                list={`artifact-group-options-${index}`}
                                placeholder="Search artifact groups"
                                value={input.artifactGroupId}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "artifactGroupId",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType === "model_output" ? (
                              <label className="payload-model-output-source">
                                <span>Source workflow step</span>
                                <select
                                  value={input.workflowStepId ?? ""}
                                  onChange={(e) =>
                                    actions.updatePayloadInput(
                                      index,
                                      "workflowStepId",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">Select workflow step</option>
                                  {workflowSteps.map((record) => (
                                    <option
                                      key={record.workflow_step_id}
                                      value={record.workflow_step_id}
                                    >
                                      {record.step_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType === "table_rows" ? (
                              <div className="payload-table-source-config">
                                <div className="payload-table-source-selector">
                                  <label>
                                    Table
                                    <select
                                      value={
                                        input.sourceConfig?.table || "artifacts"
                                      }
                                      onChange={(e) => {
                                        const table = e.target.value;
                                        actions.updatePayloadSourceConfig(
                                          index,
                                          "table",
                                          table,
                                        );
                                        actions.updatePayloadSourceConfig(
                                          index,
                                          "match_field",
                                          table === "samples" ||
                                            table === "model_outputs"
                                            ? "sample_id"
                                            : "originating_sample_id",
                                        );
                                        actions.updatePayloadSourceConfig(
                                          index,
                                          "order_by",
                                          table === "samples"
                                            ? "sample_id"
                                            : table === "model_outputs"
                                              ? "model_output_id"
                                              : "artifact_id",
                                        );
                                        const allowedFields =
                                          TABLE_SOURCE_FIELDS[table] || [];
                                        (
                                          input.sourceConfig?.fields || []
                                        ).forEach((field, fieldIndex) => {
                                          if (
                                            !allowedFields.includes(field.field)
                                          ) {
                                            actions.updatePayloadSourceField(
                                              index,
                                              fieldIndex,
                                              "field",
                                              allowedFields[0],
                                            );
                                          }
                                          if (
                                            table === "model_outputs" &&
                                            field.type === "file"
                                          ) {
                                            actions.updatePayloadSourceField(
                                              index,
                                              fieldIndex,
                                              "type",
                                              "text",
                                            );
                                          }
                                        });
                                      }}
                                    >
                                      <option value="artifacts">
                                        artifacts
                                      </option>
                                      <option value="samples">samples</option>
                                      <option value="model_outputs">
                                        model outputs
                                      </option>
                                    </select>
                                  </label>
                                  <label>
                                    Match field
                                    <select
                                      value={
                                        input.sourceConfig?.match_field || ""
                                      }
                                      onChange={(e) =>
                                        actions.updatePayloadSourceConfig(
                                          index,
                                          "match_field",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {(
                                        TABLE_SOURCE_MATCH_FIELDS[
                                          input.sourceConfig?.table ||
                                            "artifacts"
                                        ] || []
                                      ).map((field) => (
                                        <option key={field} value={field}>
                                          {field}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {input.sourceConfig?.table ===
                                    "model_outputs" && (
                                    <label className="payload-table-workflow-step-selector">
                                      Workflow step
                                      <select
                                        value={input.workflowStepId ?? ""}
                                        onChange={(e) =>
                                          actions.updatePayloadInput(
                                            index,
                                            "workflowStepId",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="">
                                          Select workflow step
                                        </option>
                                        {workflowSteps.map((record) => (
                                          <option
                                            key={record.workflow_step_id}
                                            value={record.workflow_step_id}
                                          >
                                            {record.step_name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  )}
                                </div>
                                <div className="payload-table-fields-heading">
                                  <span>Fields from each matched row</span>
                                  <button
                                    className="btn-ghost btn-tight"
                                    type="button"
                                    onClick={() =>
                                      actions.addPayloadSourceField(index)
                                    }
                                  >
                                    + Add field
                                  </button>
                                </div>
                                {(input.sourceConfig?.fields || []).length >
                                  0 && (
                                  <div className="payload-table-field-header">
                                    <span>Database field</span>
                                    <span>Gemini type</span>
                                    <span>MIME type (optional)</span>
                                  </div>
                                )}
                                {(input.sourceConfig?.fields || []).map(
                                  (sourceField, fieldIndex) => (
                                    <div
                                      className="payload-table-field-row"
                                      key={fieldIndex}
                                    >
                                      <select
                                        value={sourceField.field}
                                        onChange={(e) =>
                                          actions.updatePayloadSourceField(
                                            index,
                                            fieldIndex,
                                            "field",
                                            e.target.value,
                                          )
                                        }
                                      >
                                        {(sourceField.type === "file"
                                          ? [
                                              input.sourceConfig?.table ===
                                              "samples"
                                                ? "sample_blob"
                                                : "artifact_blob",
                                            ]
                                          : (
                                              TABLE_SOURCE_FIELDS[
                                                input.sourceConfig?.table ||
                                                  "artifacts"
                                              ] || []
                                            ).filter(
                                              (field) =>
                                                !field.endsWith("_blob"),
                                            )
                                        ).map((field) => (
                                          <option key={field} value={field}>
                                            {field}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={sourceField.type}
                                        onChange={(e) => {
                                          const type = e.target.value;
                                          actions.updatePayloadSourceField(
                                            index,
                                            fieldIndex,
                                            "type",
                                            type,
                                          );
                                          if (type === "file") {
                                            actions.updatePayloadSourceField(
                                              index,
                                              fieldIndex,
                                              "field",
                                              input.sourceConfig?.table ===
                                                "samples"
                                                ? "sample_blob"
                                                : "artifact_blob",
                                            );
                                          }
                                        }}
                                      >
                                        <option value="text">text</option>
                                        {input.sourceConfig?.table !==
                                          "model_outputs" && (
                                          <option value="file">file</option>
                                        )}
                                      </select>
                                      {sourceField.type === "file" ? (
                                        <select
                                          value={sourceField.mime_type || ""}
                                          aria-label="Optional MIME type override"
                                          onChange={(e) =>
                                            actions.updatePayloadSourceField(
                                              index,
                                              fieldIndex,
                                              "mime_type",
                                              e.target.value || null,
                                            )
                                          }
                                        >
                                          <option value="">Auto-detect</option>
                                          {COMMON_MIME_TYPES.map((mimeType) => (
                                            <option
                                              key={mimeType}
                                              value={mimeType}
                                            >
                                              {mimeType}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="payload-table-field-na">
                                          —
                                        </span>
                                      )}
                                      <button
                                        className="payload-remove-button"
                                        type="button"
                                        aria-label="Remove table field"
                                        onClick={() =>
                                          actions.removePayloadSourceField(
                                            index,
                                            fieldIndex,
                                          )
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <input
                                list={`step-options-${index}`}
                                placeholder="Filter by workflow step"
                                value={input.workflowStepId}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "workflowStepId",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                            <label className="payload-batch-limit-field">
                              <span>Batch limit</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={input.batchLimit ?? ""}
                                placeholder="Optional"
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "batchLimit",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                            {input.sourceType === "asset" ? (
                              <datalist id={`fixed-source-options-${index}`}>
                                {(input.inputType === "text"
                                  ? sourceRecords.textAsset
                                  : sourceRecords.asset
                                ).map((record) => {
                                  return (
                                    <option
                                      key={record.asset_id}
                                      value={record.asset_id}
                                    >
                                      {record.asset_name} (
                                      {record.asset_mime_type})
                                    </option>
                                  );
                                })}
                              </datalist>
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType ===
                                "sample" ? null : input.bindingMode ===
                                "sample-bound" &&
                              input.sourceType === "artifact" ? (
                              <datalist id={`artifact-group-options-${index}`}>
                                {(state.artifactGroups || []).map((record) => (
                                  <option
                                    key={record.artifact_group_id}
                                    value={record.artifact_group_id}
                                  >
                                    {record.artifact_group_name}
                                  </option>
                                ))}
                              </datalist>
                            ) : (
                              <datalist id={`step-options-${index}`}>
                                {workflowSteps.map((record) => (
                                  <option
                                    key={record.workflow_step_id}
                                    value={record.workflow_step_id}
                                  >
                                    {record.step_name}
                                  </option>
                                ))}
                              </datalist>
                            )}
                            <label className="payload-required-toggle">
                              <input
                                type="checkbox"
                                checked={input.required}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "required",
                                    e.target.checked,
                                  )
                                }
                              />{" "}
                              Required
                            </label>
                            <button
                              className="payload-remove-button"
                              type="button"
                              aria-label="Remove input"
                              onClick={() => actions.removePayloadInput(index)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="payload-empty-state">
                        <strong>No inputs for this message</strong>
                        <span>
                          Inputs will be inserted at paths inside the selected
                          message template.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="payload-empty-state payload-empty-state-tall">
                    <strong>Select a message</strong>
                    <span>
                      Right-click a message card to toggle its selection.
                    </span>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="btn-ghost"
          type="button"
          onClick={actions.closeCreatePayloadTemplate}
        >
          Cancel
        </button>
        <div className="inline-actions">
          {step === 2 ? (
            <button
              className="btn-ghost"
              type="button"
              onClick={actions.previousCreatePayloadTemplateStep}
            >
              Back
            </button>
          ) : null}
          {step === 1 ? (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.nextCreatePayloadTemplateStep}
            >
              Continue to prompt structure
            </button>
          ) : (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.submitCreatePayloadTemplate}
              disabled={state.createPayloadTemplateLoading}
            >
              {state.createPayloadTemplateLoading
                ? "Creating..."
                : "Create payload template"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
