"use client";

import {
  EmptyState,
  Panel,
  Stack,
  StatusBadge,
} from "../../ui/primitives/index.js";
import { SampleFilterPanel } from "./SampleFilterPanel.js";

export function FileManagementListPanel({
  title,
  description,
  filters,
  actions,
  summary,
  rows,
  emptyState,
  listClass = "sample-picker file-sample-picker",
}) {
  return (
    <Panel
      title={title}
      eyebrow={description}
      meta={summary ? <StatusBadge>{summary}</StatusBadge> : null}
      actions={actions}
    >
      <Stack gap="compact">
        <SampleFilterPanel
          filters={filters}
          actions={null}
          actionsClassName="u-compact-actions"
          summary=""
          rows={rows || <EmptyState title={emptyState} />}
          emptyState={emptyState}
          listClass={listClass}
        />
      </Stack>
    </Panel>
  );
}
