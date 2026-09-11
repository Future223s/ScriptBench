# ScriptBench

ScriptBench is a web app for uploading samples, organizing them into sample sets, running reproducible, fail-safe transcription workflows, and reviewing the outputs.

## Local setup

Prerequisites:

- Node.js 18 or newer
- Python installed on your machine
- `GEMINI_API_KEY` if you want transcription workflows to call Gemini

Start the backend and frontend in separate terminals from the repository root:

1. Backend

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
python -m backend.api.main
```

The backend starts on `http://127.0.0.1:8000` and uses a local SQLite database automatically. No separate database setup is required.

2. Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:3001` in your browser.

## Open the app

- Frontend: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:8000`

The frontend is already configured to send `/api` requests to the backend.

## Docker

This repository includes a development compose file for running both services together.

Prerequisites:

- Docker Desktop or Docker Engine with Compose v2
- `GEMINI_API_KEY` in your shell environment if you want Gemini-powered workflows

From the repository root, run:

```powershell
docker compose -f docker-compose-dev.yml up --build
```

Compose starts PostgreSQL, the backend, and the frontend. Bootstrap scripts do not
run on startup. Both bootstrappers are idempotent: rerunning them updates their
named demo records without duplication.

The `step_executors` table is the runtime metadata source. Startup and dataset
seeding insert missing Gemini and Anthropic catalog records and overwrite all
seed-managed metadata on existing records, including `active`. IDs and `created_at`
are preserved; `updated_at` is refreshed. See [the exact seed inventory](docs/seeding.md). The wizard lists active executor names on stage one, then gets
the selected record on stage two to render configuration and method selection.
`input_schema` and `output_schema` are keyed by method and validate internal
operation inputs/results; they are separate from payload templates and output specs.
The code registry only maps supported executor methods to implementations.
Anthropic image inputs use the [documented base64 message format](https://platform.claude.com/docs/en/build-with-claude/vision).
Set `ANTHROPIC_API_KEY` alongside `GEMINI_API_KEY` for real execution;
`DEV=true` enables the small development-settings icon at the top right of the
navbar. Open it to toggle **Use stub executor** and **Force stub failure** without
restarting. Development starts with stub execution on and forced failure off.
With `DEV=false` (the backend default), the controls are hidden, updates are rejected,
and real providers are used. Compose defaults `DEV` to `true` for development.

Both controls are shared by clients of the same backend process and apply to the
next executor created; already-running executions keep their settings. Changes are
in memory, reset on backend restart, and are not shared across multiple backend
worker processes. The development Compose setup runs one worker. Opening the
control refreshes its state from the backend. When stub mode is off, the forced
failure switch is disabled and has no effect. `DEV` is read once at startup; only
changing that development gate requires a restart.

Tables and API records use local fields (`id`, `name`, `description`, `blob`,
`mime_type`, `payload`) and qualified foreign keys (`sample_id`,
`derivative_group_id`, `step_executor_id`, etc.). Existing databases must be
recreated: there are no migrations or compatibility aliases. See the
[complete canonical schema and exact recreation/bootstrap commands](docs/canonical-schema.md).
Seeding does not reset or migrate the database.

Run the manuscript bootstrap independently after the PostgreSQL service is healthy.
It accepts an `EMMO` directory containing `images`, `ground_truth_txt`, and
`segementation_line_crops`; it creates the samples, derivatives, mappings, and demo
sample set. If the stack is not already running, start it with
`docker compose -f docker-compose-dev.yml up -d postgres` first:

```bash
docker compose -f docker-compose-dev.yml run --rm --no-deps \
  -v "/absolute/path/to/EMMO:/emmo:ro" \
  -e EMMO_ROOT=/emmo \
  backend python -m backend.scripts.bootstrapping.manuscripts
```

Create one executor-specific demo workflow after bootstrapping manuscripts. This
creates its payload template, output specification, workflow step, workflow, and DAG node:

```bash
docker compose -f docker-compose-dev.yml run --rm --no-deps \
  backend python -m backend.scripts.bootstrapping.workflow --executor gemini
```

Then open:

- Frontend: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:8000`

To stop the stack, press `Ctrl+C` and then run:

```powershell
docker compose -f docker-compose-dev.yml down
```

The Docker setup keeps the backend database and frontend build derivatives in named volumes, so your data and cached build state persist between runs.

## High-Level Workflow

1. Upload your samples in **File Management**.
2. Group related samples and create a **sample set**.
3. Create a **workflow** and attach the sample set.
4. Open the **Workflow Workspace** to queue jobs.
5. Assemble the job outputs into **transcriptions**.
6. Review and score the transcriptions.

## Terms

- **Sample**: one input item in the system, usually an image.
- **Ground truth**: the reference text used to evaluate model outputs
- **Grouping**: a dimensions across which you can make groups of sample
- **Group value**: a value inside a grouping used to distinguish samples within the group
- **Sample set**: the bundle of samples used to experiment with different workflows
- **Workflow**: the transcription configuration, including model choice and prompt instructions.
- **Transcription job**: one execution unit sent to the model.
- **Workspace**: the area where jobs are queued, assembled, and reviewed.
- **Assembled transcription**: a saved reviewable transcription created from job output.
- **Metrics**: quality measurements such as CER or WER.

## First Transcription Tutorial

### 1. Prepare your files

- For a single file upload, you need:
  - a sample ID
  - the image file
  - optional ground truth text
- For folder upload, use:
  - one folder of images
  - one folder of ground truth text files

Ground truth files should be named like the image file with `_gt` added before the extension, for example `page_01_gt.txt`.

### 2. Upload the samples

1. Open **File Management**.
2. Click **Upload samples**.
3. Choose **Folder** if you are uploading a batch.
4. Pick the image folder.
5. Pick the ground truth folder if you have one.
6. Click **Upload**.

If you only have one sample, switch to **Single file**, enter the sample ID, choose the image, add ground truth text if available, then upload.

### 3. Create a grouping

Example scenario: you have one source image per page and several line-crop images derived from each page. For example:

`sample_1` -> `sample_1_line_001`, `sample_1_line_002`, `sample_1_line_003`
`sample_2` -> `sample_2_line_001`, `sample_2_line_002`

In this setup, the condition for grouping membership consists of being a line-crop dervied from a page.

1. In **File Management**, click **Create grouping**.
2. Enter a grouping name such as `Original Sample`.
3. Use the search box and filtering tools to narrow the visible samples. (e.g. filtering by `Contains: line`)
4. Click **Select all visible** if the filtered rows are the ones you want.
5. Click **Save grouping**.

### 4. Add grouping values

Once the grouping is created, you might add values like `sample_1` to identify a crop family within the grouping.

1. Open the grouping.
2. Click **Add value**.
3. Enter a value name such as `sample_1`.
4. Select the matching line crops by filtering for line crops that contain `sample_1` in their name.
5. Save the value.

### 5. Create a sample set

1. In **File Management**, switch to **Create sample set**.
2. Give the set a name, such as `Line Crops`.
3. Fill in the sample set type.
4. Add an optional description.
5. Save the sample set.

The sample set is what you attach to a workflow later, so it should contain the samples you want to transcribe together.

### 6. Create a workflow

1. Click **Create workflow**.
2. Enter a workflow name.
3. Choose a **workflow stage** name, such as `Iteration 1`.
4. Pick the model family and model such as `gemini` and `gemini-3-flash-preview`
5. Select the sample set you created.
6. Add your transcription instructions.
7. Choose whether this is a single-sample or batch workflow.
8. Configure the output format if needed.
9. Create the workflow.

### 7. Run the first transcription jobs

1. Open **Workflow Workspace**.
2. Select your workflow.
3. CLick generate jobs, wait for them to complete, and click on a job to inspect its details generated accordingly
4. Queue the pending jobs and wait for the jobs to complete.
5. Open any completed job to inspect the resolved prompt and raw model output.

If a job looks wrong, you can retry it from the workspace.
