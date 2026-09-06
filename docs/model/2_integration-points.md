# Integration Points

- `RowCoordinator -> PromptResolutionService`: resolve a payload template for one execution row before jobs are created.
- `PromptResolutionService -> PromptResolutionRepository`: read template, resources, conditions, and allowed source rows.
- `PromptResolutionService -> FileReferenceCoordinator`: hand off provider-neutral file parts after rendering.
- `RowCoordinator -> ExecutionRowsRepository`: persist immutable jobs containing the resolved snapshot.
- `WorkflowExecutionCoordinator -> LlmClient`: convert and submit the snapshot to the selected provider.
- `FileReferenceCoordinator -> ObjectUploadsRepository`: reuse or refresh provider file handles for files used in the snapshot.
