"use client";

import { Dialog, ListRow, Stack } from "../../ui/primitives/index.js";
import { findNode } from "./workflowBuilderUtils.js";

export function WorkflowStepDetailModal({ state, actions }) {
  const selectedNode = findNode(state.nodes, state.detailNodeId);
  return (
    <Dialog
      open={Boolean(state.detailOpen && selectedNode)}
      title={selectedNode?.label || "Workflow step"}
      onClose={actions.closeNodeDetail}
      size="small"
    >
      {selectedNode ? (
        <Stack gap="compact">
          <ListRow
            title="Canvas position"
            detail={`Row ${selectedNode.row}, column ${selectedNode.col}`}
          />
          <ListRow
            title="Description"
            detail={selectedNode.description || "No description provided."}
          />
        </Stack>
      ) : null}
    </Dialog>
  );
}
