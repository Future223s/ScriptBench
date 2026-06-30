# prompt-resolution

## Trigger: Service

- Service file: `backend/services/prompt_resolution.py`
- Service name: `PromptResolutionService`

## Initialization

- Stores the active `WorkflowConfig`
- Stores a `TranscriptionEngine` provider, usually `GeminiClient`
- Stores `SampleUploadsRepository` so upload references can be reused across runs

## Integration Map

- Called by `backend/api/routes/workspaces.py` while creating transcription jobs
- Uses `backend/database/repositories/sample_uploads_repository.py` to reuse upload refs for the same sample and model family
- Uses a `TranscriptionEngine` implementation for file upload and file-reference lookups
- Produces the resolved prompt payload that is written into `transcription_jobs.resolved_prompt`

## Methods

- `resolve_prompt(prompt_spec, sample_payloads_by_sample_id, sample_ids=None)`: validates the prompt spec, reuses prior uploads, uploads missing files, builds Gemini content, and returns a resolved prompt payload
- `_serialize_model_object(item)`: converts model objects into plain JSON-compatible data
