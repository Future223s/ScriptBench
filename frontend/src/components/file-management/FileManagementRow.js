"use client";

import {
  Button,
  Inline,
  ListRow,
  StatusBadge,
} from "../../ui/primitives/index.js";

export function FileManagementRow({
  title,
  descriptors = [],
  badge,
  selected = false,
  onClick,
  onContextMenu,
}) {
  return (
    <ListRow
      title={title}
      detail={
        descriptors.filter(Boolean).join(" / ") || "No additional details"
      }
      selected={selected}
      onContextMenu={onContextMenu}
      action={
        <Inline gap="default">
          {badge ? <StatusBadge>{badge}</StatusBadge> : null}
          {onClick ? (
            <Button size="compact" onClick={onClick}>
              View
            </Button>
          ) : null}
        </Inline>
      }
    />
  );
}
