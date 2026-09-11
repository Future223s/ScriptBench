"use client";

import { EmptyState } from "../common/EmptyState.js";
import { Modal } from "../common/Modal.js";
import { SampleSetCreateModal } from "./SampleSetCreateModal.js";
import {
  Button,
  Checkbox,
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
  RadioGroup,
  Select,
  SectionTitle,
  Stack,
  StepStrip,
  Textarea,
  TextInput,
} from "../../ui/primitives/index.js";

const TABLE_SOURCE_FIELDS = {
  derivatives: [
    "id",
    "name",
    "sample_id",
    "derivative_group_id",
    "category",
    "blob",
    "mime_type",
  ],
  samples: [
    "id",
    "name",
    "blob",
    "mime_type",
    "ground_truth_text",
  ],
  step_outputs: [
    "id",
    "workflow_id",
    "workflow_step_id",
    "sample_id",
    "parsed_output",
    "parse_status",
    "parse_error",
    "created_at",
    "completed_at",
  ],
};

const TABLE_SOURCE_MATCH_FIELDS = {
  derivatives: ["sample_id"],
  samples: ["id"],
  step_outputs: ["sample_id"],
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

function WorkflowStepDetailModal({ open, record, actions }) {
  return (
    <Modal
      open={open}
      panelClassName="resource-detail-modal"
      data-modal="resource-detail"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          actions.closeWorkflowStepDetail();
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
          onClick={actions.closeWorkflowStepDetail}
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
              {(record.sections || []).map((section) =>
                section.collapsible ? (
                  <details key={section.title} className="resource-detail-section">
                    <summary>{section.title}</summary>
                    <pre>{section.content || ""}</pre>
                  </details>
                ) : (
                  <div key={section.title} className="resource-detail-section">
                    <h3>{section.title}</h3>
                    <pre>{section.content || ""}</pre>
                  </div>
                ),
              )}
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

function DerivativeGroupConditionRows({ kind, conditions, actions }) {
  const isMembership = kind === "membership";
  return (
    <Stack gap="compact">
      <SectionTitle>
        {isMembership ? "Derivative membership" : "Sample mapping"}
      </SectionTitle>
      {conditions.map((condition, index) => (
        <Grid columns={4} key={`${kind}-${index}`}>
          <Field density="compact" label="Field">
            <Select value={condition.field} onChange={(event) => actions.updateDerivativeGroupCondition(kind, index, "field", event.target.value)}>
              <option value="name">name</option>
              <option value="sample_id">sample_id</option>
              {isMembership ? <option value="name">name</option> : null}
            </Select>
          </Field>
          <Field density="compact" label="Operator">
            <Select value={condition.operator} onChange={(event) => actions.updateDerivativeGroupCondition(kind, index, "operator", event.target.value)}>
              <option value="equals">is</option><option value="contains">contains</option><option value="starts_with">starts with</option><option value="ends_with">ends with</option>
            </Select>
          </Field>
          <Field density="compact" label="Value type">
            <Select value={condition.valueType} onChange={(event) => actions.updateDerivativeGroupCondition(kind, index, "valueType", event.target.value)}>
              <option value={isMembership ? "manual" : "sample-field"}>{isMembership ? "Manual value" : "Sample field"}</option>
            </Select>
          </Field>
          <Field density="compact" label="Value" action={<IconButton label="Remove condition" variant="danger" onClick={() => actions.removeDerivativeGroupCondition(kind, index)}><Icon name="delete" /></IconButton>}>
            {isMembership ? <TextInput value={condition.value} onChange={(event) => actions.updateDerivativeGroupCondition(kind, index, "value", event.target.value)} placeholder="_line_" /> : <Select value={condition.value} onChange={(event) => actions.updateDerivativeGroupCondition(kind, index, "value", event.target.value)}><option value="name">name</option><option value="id">id</option></Select>}
          </Field>
        </Grid>
      ))}
      <Button size="compact" onClick={() => actions.addDerivativeGroupCondition(kind)}>Add condition</Button>
    </Stack>
  );
}

function DerivativeGroupCreateModal({ open, state, actions }) {
  const draft = state.createDerivativeGroupDraft;
  const step = state.createDerivativeGroupStep;

  return (
    <Dialog
      open={open}
      title="Create derivative group"
      description={`Step ${step} of 4`}
      size="wide"
      onClose={actions.closeCreateDerivativeGroup}
      footer={
        <Inline gap="compact" justify="end">
          <Button
            onClick={
              step === 1
                ? actions.closeCreateDerivativeGroup
                : actions.previousCreateDerivativeGroupStep
            }
            disabled={state.createDerivativeGroupLoading}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            variant="primary"
            onClick={
              step < 4
                ? actions.nextCreateDerivativeGroupStep
                : actions.submitCreateDerivativeGroup
            }
            disabled={state.createDerivativeGroupLoading}
          >
            {step < 4
              ? "Next"
              : state.createDerivativeGroupLoading
                ? "Creating..."
                : "Create derivative group"}
          </Button>
        </Inline>
      }
    >
      <Stack>
        <StepStrip
          activeId={`step-${step}`}
          steps={[
            { id: "step-1", label: "Details" },
            { id: "step-2", label: "Membership" },
            { id: "step-3", label: "Sample mapping" },
            { id: "step-4", label: "Review" },
          ]}
        />
        {step === 1 ? (
          <Stack>
            <Field label="Group name">
              <TextInput
                value={draft.groupName}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "groupName",
                    event.target.value,
                  )
                }
                placeholder="Line Derivatives"
              />
            </Field>
            <Field label="Description" hint="Optional">
              <Textarea
                rows="4"
                value={draft.description}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "description",
                    event.target.value,
                  )
                }
                placeholder="Derivatives representing extracted text lines"
              />
            </Field>
            <RadioGroup
              label="Mapping type"
              name="derivative-group-mapping-type"
              value={draft.mappingType}
              onChange={(value) =>
                actions.setCreateDerivativeGroupField("mappingType", value)
              }
              options={[
                { value: "one-to-one", label: "One-to-one" },
                { value: "one-to-many", label: "One-to-many" },
              ]}
            />
            <Field label="Ordering">
              <Select
                value={draft.ordering}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "ordering",
                    event.target.value,
                  )
                }
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="derivative-id">Derivative ID</option>
              </Select>
            </Field>
          </Stack>
        ) : null}
        {false ? (
          <Stack>
            <Grid columns={2}>
              <Field label="Derivative field">
                <Select
                value={draft.membershipDerivativeField}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "membershipDerivativeField",
                    event.target.value,
                  )
                }
              >
                <option value="name">Derivative name</option>
                <option value="sample_id">
                  Originating sample ID
                </option>
                </Select>
              </Field>
              <Field label="Operator">
                <Select
                value={draft.membershipOperator}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "membershipOperator",
                    event.target.value,
                  )
                }
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
                </Select>
              </Field>
            </Grid>
            <Field label="Pattern" hint="Required">
              <TextInput
                value={draft.membershipPattern}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "membershipPattern",
                    event.target.value,
                  )
                }
                placeholder="_line_"
              />
            </Field>
            <Checkbox
              label="Case sensitive"
              checked={draft.membershipCaseSensitive}
              onChange={(event) =>
                actions.setCreateDerivativeGroupField(
                  "membershipCaseSensitive",
                  event.target.checked,
                )
              }
            />
          </Stack>
        ) : null}
        {step === 2 ? (
          <Stack>
            <DerivativeGroupConditionRows
              kind="membership"
              conditions={draft.membershipConditions}
              actions={actions}
            />
          </Stack>
        ) : null}
        {step === 3 ? (
          <Stack>
            <DerivativeGroupConditionRows
              kind="sample"
              conditions={draft.sampleMappingConditions}
              actions={actions}
            />
          </Stack>
        ) : null}
        {false ? (
          <Stack>
            <Grid columns={2}>
              <Field label="Derivative field">
                <Select
                value={draft.sampleMappingDerivativeField}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "sampleMappingDerivativeField",
                    event.target.value,
                  )
                }
              >
                <option value="name">Derivative name</option>
                <option value="sample_id">
                  Originating sample ID
                </option>
                </Select>
              </Field>
              <Field label="Sample field">
                <Select
                value={draft.sampleMappingSampleField}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "sampleMappingSampleField",
                    event.target.value,
                  )
                }
              >
                <option value="name">Sample name</option>
                <option value="id">Sample ID</option>
                </Select>
              </Field>
              <Field label="Operator">
                <Select
                value={draft.sampleMappingOperator}
                onChange={(event) =>
                  actions.setCreateDerivativeGroupField(
                    "sampleMappingOperator",
                    event.target.value,
                  )
                }
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
                </Select>
              </Field>
            </Grid>
            <Checkbox
              label="Case sensitive"
              checked={draft.sampleMappingCaseSensitive}
              onChange={(event) =>
                actions.setCreateDerivativeGroupField(
                  "sampleMappingCaseSensitive",
                  event.target.checked,
                )
              }
            />
          </Stack>
        ) : null}
        {step === 4 ? (
          <Grid columns={2}>
            <Panel title="Group">
              <CodeBlock label="Configuration">
                {JSON.stringify(
                  {
                    name: draft.groupName || "Not set",
                    mapping_type: draft.mappingType,
                    ordering: draft.ordering,
                    description: draft.description || null,
                  },
                  null,
                  2,
                )}
              </CodeBlock>
            </Panel>
            <Panel title="Rules">
              <Stack gap="compact">
                <CodeBlock label="Membership rule">
                  {JSON.stringify(draft.membershipConditions, null, 2)}
                </CodeBlock>
                <CodeBlock label="Sample mapping">
                  {JSON.stringify(draft.sampleMappingConditions, null, 2)}
                </CodeBlock>
              </Stack>
            </Panel>
          </Grid>
        ) : null}
      </Stack>
    </Dialog>
  );
}

export function WorkflowStepsOverlays({ state, actions }) {
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
                  String(sample.id),
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
      <WorkflowStepDetailModal
        open={state.detailOpen}
        record={state.selectedResource}
        actions={actions}
      />
      <DerivativeGroupCreateModal
        open={state.createDerivativeGroupOpen}
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
  derivatives: [
    "id",
    "name",
    "sample_id",
    "derivative_group_id",
    "category",
    "mime_type",
  ],
  samples: [
    "id",
    "name",
    "mime_type",
    "ground_truth_text",
  ],
  step_outputs: [
    "id",
    "workflow_id",
    "workflow_step_id",
    "sample_id",
    "parsed_output",
    "parse_status",
    "parse_error",
    "created_at",
    "completed_at",
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
              <option value="derivatives">Derivatives</option>
              <option value="samples">Samples</option>
              <option value="step_outputs">Step outputs</option>
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
                          <option value="id">id</option>
                          <option value="name">name</option>
                          <option value="mime_type">
                            mime_type
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
    "template": { "type": "input_text", "text": "{{line_crops.name}}" }
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
            <Field
              label="Step executor"
              hint="Payload templates can only be used by workflow steps with this executor."
            >
              <Select
                value={draft.modelFamily}
                onChange={(event) =>
                  actions.updatePayloadDraft("modelFamily", event.target.value)
                }
              >
                <option value="">Select executor</option>
                {(state.stepExecutors || []).map((executor) => (
                  <option key={executor.id} value={executor.id}>
                    {executor.name}
                  </option>
                ))}
              </Select>
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
              placeholder="Describe the expected step output."
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
  const executor = state.executorDefinition;
  const templates = (state.payloadTemplates || []).filter(
    (item) => executor && item.model_family === executor.id,
  );
  return (
    <Modal
      open={state.createWorkflowStepOpen}
      panelClassName="workflow-step-create-modal"
    >
      <div className="modal-header">
        <div className="panel-title">
          <h2>Create Workflow Step</h2>
          <span>Step {step} of 4</span>
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
          {["Metadata & executor", "Configuration", "Payload template", "Output spec"].map((label, index) => (
            <span key={label} className={step === index + 1 ? "is-active" : step > index + 1 ? "is-complete" : ""}>
              0{index + 1} <b>{label}</b>
            </span>
          ))}
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
            <div className="field wide">
              <label htmlFor="step-executor">Step executor</label>
              <select id="step-executor" disabled={state.createWorkflowStepLoading} value={draft.stepExecutor}
                onChange={(event) => actions.updateCreateWorkflowStepField("stepExecutor", event.target.value)}>
                <option value="">Select executor</option>
                {(state.stepExecutors || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="executor-method">Method</label>
              <select id="executor-method" value={draft.method}
                onChange={(event) => actions.updateCreateWorkflowStepField("method", event.target.value)}>
                <option value="">Select method</option>
                {(executor?.methods || []).map((method) => <option key={method.name} value={method.name}>{method.label || method.name}</option>)}
              </select>
              <p>{executor?.methods.find((method) => method.name === draft.method)?.description}</p>
            </div>
            {Object.entries(executor?.config_schema.properties || {}).map(([key, option]) => {
              const rules = option.type ? option : option.anyOf.find((item) => item.type !== "null");
              const numeric = rules.type === "number" || rules.type === "integer";
              return <div className="field" key={key}>
                <label htmlFor={`executor-${key}`}>{option.title}{executor.config_schema.required?.includes(key) ? " *" : " (optional)"}</label>
                <input id={`executor-${key}`} type={numeric ? "number" : "text"}
                  step={rules.type === "integer" ? 1 : "any"}
                  min={rules.minimum ?? (rules.exclusiveMinimum != null ? rules.exclusiveMinimum + 1 : undefined)}
                  max={rules.maximum}
                  value={draft.executorConfig[key] ?? ""}
                  onChange={(event) => actions.updateCreateWorkflowStepField("executorConfig", {
                    ...draft.executorConfig,
                    [key]: numeric && event.target.value !== "" ? Number(event.target.value) : event.target.value,
                  })} />
              </div>;
            })}
          </div>
        ) : null}
        {step === 3 ? (
          <div className="resource-choice-list">
            <div className="resource-choice-list-header">
              <span>Select a payload template</span>
              <Button
                size="compact"
                variant="primary"
                onClick={() => actions.openCreatePayloadTemplate(draft.stepExecutor)}
              >
                Create +
              </Button>
            </div>
            {templates.length ? (
              templates.map((template) => (
                <div className="resource-choice-row" key={template.id}>
                  <button
                    className={
                      String(draft.payloadTemplateId) === String(template.id)
                        ? "resource-choice is-selected"
                        : "resource-choice"
                    }
                    type="button"
                    onClick={() => actions.updateCreateWorkflowStepField("payloadTemplateId", template.id)}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.model_family || "Unknown family"}</span>
                  </button>
                  <IconButton
                    label={`Delete payload template ${template.name}`}
                    variant="danger"
                    onClick={() => actions.deletePayloadTemplateFromWorkflowStep(template.id)}
                  >
                    <Icon name="delete" />
                  </IconButton>
                </div>
              ))
            ) : (
              <div className="payload-empty-state">
                <strong>No compatible payload templates</strong>
              </div>
            )}
          </div>
        ) : null}
        {step === 4 ? (
          <div className="resource-choice-list">
            <div className="resource-choice-list-header">
              <span>Select an output specification</span>
              <Button
                size="compact"
                variant="primary"
                onClick={actions.openCreateOutputSpec}
              >
                Create +
              </Button>
            </div>
            {(state.outputSpecs || []).length ? (
              state.outputSpecs.map((spec) => (
                <div className="resource-choice-row" key={spec.id}>
                  <button
                    className={
                      String(draft.outputSpecId) === String(spec.id)
                        ? "resource-choice is-selected"
                        : "resource-choice"
                    }
                    type="button"
                    onClick={() => actions.updateCreateWorkflowStepField("outputSpecId", spec.id)}
                  >
                    <strong>{spec.name}</strong>
                    <span>{spec.type || "Output specification"}</span>
                  </button>
                  <IconButton
                    label={`Delete output specification ${spec.name}`}
                    variant="danger"
                    onClick={() => actions.deleteOutputSpecFromWorkflowStep(spec.id)}
                  >
                    <Icon name="delete" />
                  </IconButton>
                </div>
              ))
            ) : (
              <div className="payload-empty-state">
                <strong>No output specifications</strong>
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
          {step < 4 ? (
            <button
              className="btn-primary"
              type="button"
              onClick={actions.nextCreateWorkflowStep}
              disabled={state.createWorkflowStepLoading}
            >
              {state.createWorkflowStepLoading ? "Loading..." : "Next"}
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
      const mimeType = String(record.mime_type || "").toLowerCase();
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
                  placeholder="Analyze a source document with supporting derivatives."
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
                                  : input.sourceType === "step_output"
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
                                    <option>derivative</option>
                                    <option value="step_output">
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
                                    <option>derivative</option>
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
                              input.sourceType === "derivative" ? (
                              <input
                                list={`derivative-group-options-${index}`}
                                placeholder="Search derivative groups"
                                value={input.derivativeGroupId}
                                onChange={(e) =>
                                  actions.updatePayloadInput(
                                    index,
                                    "derivativeGroupId",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType === "step_output" ? (
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
                                      key={record.id}
                                      value={record.id}
                                    >
                                      {record.name}
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
                                        input.sourceConfig?.table || "derivatives"
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
                                          table === "samples" ? "id" : "sample_id",
                                        );
                                        actions.updatePayloadSourceConfig(
                                          index,
                                          "order_by",
                                          table === "samples"
                                            ? "id"
                                            : table === "step_outputs"
                                              ? "id"
                                              : "id",
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
                                            table === "step_outputs" &&
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
                                      <option value="derivatives">
                                        derivatives
                                      </option>
                                      <option value="samples">samples</option>
                                      <option value="step_outputs">
                                        step outputs
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
                                            "derivatives"
                                        ] || []
                                      ).map((field) => (
                                        <option key={field} value={field}>
                                          {field}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {input.sourceConfig?.table ===
                                    "step_outputs" && (
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
                                            key={record.id}
                                            value={record.id}
                                          >
                                            {record.name}
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
                                                ? "blob"
                                                : "blob",
                                            ]
                                          : (
                                              TABLE_SOURCE_FIELDS[
                                                input.sourceConfig?.table ||
                                                  "derivatives"
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
                                                ? "blob"
                                                : "blob",
                                            );
                                          }
                                        }}
                                      >
                                        <option value="text">text</option>
                                        {input.sourceConfig?.table !==
                                          "step_outputs" && (
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
                                      key={record.id}
                                      value={record.id}
                                    >
                                      {record.name} (
                                      {record.mime_type})
                                    </option>
                                  );
                                })}
                              </datalist>
                            ) : input.bindingMode === "sample-bound" &&
                              input.sourceType ===
                                "sample" ? null : input.bindingMode ===
                                "sample-bound" &&
                              input.sourceType === "derivative" ? (
                              <datalist id={`derivative-group-options-${index}`}>
                                {(state.derivativeGroups || []).map((record) => (
                                  <option
                                    key={record.id}
                                    value={record.id}
                                  >
                                    {record.name}
                                  </option>
                                ))}
                              </datalist>
                            ) : (
                              <datalist id={`step-options-${index}`}>
                                {workflowSteps.map((record) => (
                                  <option
                                    key={record.id}
                                    value={record.id}
                                  >
                                    {record.name}
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
