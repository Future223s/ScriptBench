# prompt-spec

## Trigger: API Schema

- API file: `backend/api/routes/prompt_spec.py`

## Purpose

- Defines the request schema used by workflow creation
- No endpoints live in this file

## Models

- `PromptSpecExample`
  - `title`
  - `instruction_text`
  - `assets`
- `PromptSpecInputs`
  - `sample_ids`
  - `selection_mode`
  - `batch_size`
- `PromptSpecOutputFormat`
  - `type`
  - `item_schema`
- `PromptSpec`
  - `instructions`
  - `examples`
  - `inputs`
  - `output_format`
