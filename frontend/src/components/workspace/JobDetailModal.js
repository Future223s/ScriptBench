"use client";

import {
  CodeBlock,
  DescriptionList,
  Dialog,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { safeJsonStringify } from "../../utils/json.js";

export function JobDetailModal({ open, job, onClose }) {
  return (
    <Dialog
      open={open}
      title={`Job ${job?.job_id || ""}`}
      onClose={onClose}
      size="wide"
    >
      <Stack gap="compact">
        <StatusBadge>{job?.status || "Unknown status"}</StatusBadge>
        <DescriptionList
          items={[
            ["Workflow", job?.workflow_id || "n/a"],
            [
              "Elapsed",
              job?.time_elapsed != null
                ? `${Number(job.time_elapsed).toFixed(1)}s`
                : "n/a",
            ],
            ["Created", job?.created_at || "n/a"],
            [
              "Samples",
              Array.isArray(job?.sample_ids)
                ? job.sample_ids.join(", ")
                : "n/a",
            ],
          ]}
        />
        {job?.failure_reason ? (
          <CodeBlock label="Failure reason">{job.failure_reason}</CodeBlock>
        ) : null}
        <CodeBlock label="Resolved prompt">
          {safeJsonStringify(job?.resolved_prompt) ||
            "No resolved prompt available."}
        </CodeBlock>
        <CodeBlock label="Transcription content">
          {job?.raw_content || "No transcription content yet."}
        </CodeBlock>
      </Stack>
    </Dialog>
  );
}
