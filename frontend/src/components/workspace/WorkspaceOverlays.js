"use client";

import { useEffect, useState } from "react";
import {
  Button,
  CodeBlock,
  Dialog,
  Field,
  Grid,
  Inline,
  Select,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";

function ExecutionRowDetail({ row, onClose }) {
  const workflowSteps = row?.workflow_steps || [];
  const modelOutputs = row?.model_outputs || [];
  const stepOutput = row?.step_output;
  const [selectedStepId, setSelectedStepId] = useState("");
  const defaultStepId = String(
    modelOutputs[0]?.workflow_step_id ??
      workflowSteps[0]?.workflow_step_id ??
      "",
  );
  useEffect(() => {
    setSelectedStepId((current) =>
      workflowSteps.some(
        (step) => String(step.workflow_step_id) === current,
      )
        ? current
        : defaultStepId,
    );
  }, [defaultStepId, row?.execution_job_id, workflowSteps]);
  const activeStepId = selectedStepId || defaultStepId;
  const selectedOutput = modelOutputs.find(
    (output) => String(output.workflow_step_id) === activeStepId,
  );
  const selectedStepOutput =
    stepOutput && String(stepOutput.workflow_step_id) === activeStepId
      ? stepOutput
      : null;
  const displayedOutput = selectedOutput || selectedStepOutput;
  return (
    <Dialog
      open={Boolean(row)}
      title={row ? `Execution job ${row.execution_job_id}` : "Execution job"}
      onClose={onClose}
      size="wide"
    >
      {row ? (
        <Stack gap="compact">
          <Field label="Workflow step">
            <Select
              value={activeStepId}
              onChange={(event) => setSelectedStepId(event.target.value)}
              disabled={!workflowSteps.length}
            >
              {!workflowSteps.length ? (
                <option>No workflow steps</option>
              ) : null}
              {workflowSteps.map((step) => (
                <option
                  key={step.workflow_step_id}
                  value={step.workflow_step_id}
                >
                  {step.step_name || `Step ${step.workflow_step_id}`}
                </option>
              ))}
            </Select>
          </Field>
          {displayedOutput ? (
            <>
              <Inline gap="compact">
                <StatusBadge>
                  {selectedOutput?.parse_status || selectedStepOutput?.status || "unknown"}
                </StatusBadge>
              </Inline>
              <Grid columns={3}>
                <StatusBadge>
                  CER{" "}
                  {selectedOutput.cer != null
                    ? Number(selectedOutput.cer).toFixed(3)
                    : "Not scored"}
                </StatusBadge>
                <StatusBadge>
                  WER{" "}
                  {selectedOutput.wer != null
                    ? Number(selectedOutput.wer).toFixed(3)
                    : "Not scored"}
                </StatusBadge>
                <StatusBadge>
                  Hallucinations{" "}
                  {selectedOutput.hallucination_count ?? "Not scored"}
                </StatusBadge>
              </Grid>
              <CodeBlock label="Model output">
                {selectedOutput?.parsed_output != null
                  ? typeof selectedOutput.parsed_output === "string"
                    ? selectedOutput.parsed_output
                    : JSON.stringify(selectedOutput.parsed_output, null, 2)
                  : selectedOutput?.raw_model_response ||
                    (selectedStepOutput?.output_value != null
                      ? typeof selectedStepOutput.output_value === "string"
                        ? selectedStepOutput.output_value
                        : JSON.stringify(selectedStepOutput.output_value, null, 2)
                      : "No structured output available.")}
              </CodeBlock>
            </>
          ) : (
            <StatusBadge>No output is available for this step.</StatusBadge>
          )}
        </Stack>
      ) : null}
    </Dialog>
  );
}

function FailureOverlay({ failure, actions }) {
  return (
    <Dialog
      open={Boolean(failure)}
      title="Execution failed"
      onClose={actions.closeFailureOverlay}
      footer={
        <Inline gap="compact" justify="end">
          <Button variant="primary" onClick={actions.retryFailure}>
            Retry
          </Button>
          <Button variant="danger" onClick={actions.stopFailureExecution}>
            Stop execution
          </Button>
        </Inline>
      }
    >
      {failure ? (
        <Stack gap="compact">
          <StatusBadge tone="danger">
            {failure.error_message || "The execution row failed."}
          </StatusBadge>
          <CodeBlock label="Failure payload">
            {JSON.stringify(failure.raw_payload || {}, null, 2)}
          </CodeBlock>
        </Stack>
      ) : null}
    </Dialog>
  );
}

export function WorkspaceOverlays({ state, actions }) {
  return (
    <>
      <ExecutionRowDetail
        row={state.selectedExecutionRow}
        onClose={actions.closeRowDetail}
      />
      <FailureOverlay failure={state.failureOverlay} actions={actions} />
    </>
  );
}
