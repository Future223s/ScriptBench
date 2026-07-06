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

Open `http://127.0.0.1:3000` in your browser.

## Open the app

- Frontend: `http://127.0.0.1:3000`
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

Then open:

- Frontend: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8000`

To stop the stack, press `Ctrl+C` and then run:

```powershell
docker compose -f docker-compose-dev.yml down
```

The Docker setup keeps the backend database and frontend build artifacts in named volumes, so your data and cached build state persist between runs.

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
