# Module Decomposition

- `PayloadBuilder`: owns resource selection, interpolation, `$each`, and conversion to provider-neutral prompt content. It returns one payload for one sample and never batches or uploads files.
- `RowCoordinator`: owns creation of the single job snapshot for a row and step.
- `OutputResolver`: validates plain-text or JSON output and persists the resulting model output.
- `WorkflowExecutionCoordinator`: owns payload build handoff, model-client invocation, validation, persistence, and row progression.
- `ExecutionWorker`: claims rows/jobs and emits lifecycle events.
- `FileReferenceCoordinator`: retained for a future file-upload flow; inactive in the current runtime.
