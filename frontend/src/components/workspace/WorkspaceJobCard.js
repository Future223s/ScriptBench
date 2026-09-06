"use client";

import {
  Button,
  SelectableRow,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { formatDate } from "../../utils/date.js";

export function WorkspaceJobCard({ job, kind, selected, onToggle, onOpen }) {
  const samples = Array.isArray(job?.sample_ids)
    ? job.sample_ids.join(", ")
    : "No sample ids";
  return (
    <SelectableRow
      title={`Job ${job.job_id}`}
      detail={`${samples} / ${formatDate(job?.created_at)}`}
      selected={selected}
      onSelectedChange={(checked) => onToggle?.(kind, job.job_id, checked)}
      action={
        <>
          <StatusBadge>{job?.status || kind}</StatusBadge>
          <Button size="compact" onClick={() => onOpen?.(job.job_id)}>
            Open
          </Button>
        </>
      }
    />
  );
}
