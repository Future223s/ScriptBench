# gemini

## Trigger: Service

- Service file: `backend/services/gemini.py`
- Service name: `GeminiClient`

## Initialization

- Inherits from `TranscriptionEngine`
- Requires a `WorkflowConfig`
- Uses `image_dir` if provided, otherwise `.` by default
- Uses `cache_registry_path` if provided
- Loads environment variables from `.env` with override enabled
- Reads `GEMINI_API_KEY` from the environment and fails fast if it is missing
- Picks the model from `workflow_config.model`, then `GEMINI_MODEL`, then `gemini-3-flash-preview`
- Creates a `google.genai.Client` with the API key

## Integration Map

- Called by `backend/api/routes/workspaces.py` during job creation
- Inherits shared upload and transcription behavior from `backend/core/transcription_engine.py`
- Works with `backend/core/workflow_config.py` to carry workflow identity into prompts and cache names
- Supplies prompt building and transcription calls to the workspace job creation flow
- Depends on Google Gemini file, cache, and generation APIs

## Methods

- `_upload_sample(sample_id, sample_blob, sample_mime_type)`: uploads one sample blob to Gemini
- `_get_file_ref(ref_name)`: fetches a Gemini file reference by name
- `_content_preview(contents, max_chars=2000)`: builds a truncated text preview for cache registry storage
- `_serialize_model_object(item)`: converts Gemini model objects into plain JSON-compatible data
- `create_cache(contents, ttl)`: creates cached Gemini content and records metadata in the cache registry file
- `retrieve_cache(cache_name)`: loads a cached Gemini cache object
- `build_prompt(prompt_spec, sample_payloads_by_sample_id, sample_ids=None)`: resolves prompt contents for Gemini from instructions, examples, and sample files
- `transcribe(contents, cached_content=None)`: sends a generation request and returns the model text
