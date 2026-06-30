## Core Concepts

- `sample`: A single input item in the system. A sample may be an image, a line crop, or another supported input type.
- `source sample`: A sample that represents the original source item and may include ground truth text.
- `line crop`: A derived sample extracted from a source sample, typically without ground truth text.
- `ground truth`: The reference text associated with a sample.
- `sample ID`: The stable identifier for a sample.
- `sample upload`: The action of adding one sample or a folder of samples to the system.

## Grouping Terms

- `grouping`: A named categorization dimension used to organize samples.
- `group value`: A specific value within a grouping.
- `sample membership`: The assignment of a sample to one or more group values.
- `membership filter`: A filter that returns samples belonging to a selected grouping or group value.
- `bulk select`: Selecting many visible samples at once.

## Workflow Terms

- `workflow`: A named transcription configuration that defines model choice, grouping inputs, prompt instructions, batching, and output behavior.
- `workflow stage`: The named stage or iteration associated with a workflow.
- `workflow definition`: The stored configuration for a workflow before execution.
- `workflow sample set`: The samples attached to a workflow for execution.
- `prompt spec`: The structured prompt definition for a workflow, including instructions, examples, inputs, and output format.
- `example`: A prompt example attached to a workflow.
- `batch mode`: A workflow input mode that processes samples in groups.
- `output format`: The structured shape expected from the model output.

## Execution Terms

- `workspace`: The page where a workflow is monitored, assembled, and reviewed.
- `transcription job`: A queued execution unit created from a workflow and one or more samples.
- `job status`: The current state of a transcription job, such as pending, queued, or completed.
- `requeue`: Moving a completed job back into execution.
- `retry`: Another attempt to process a failed or completed job.
- `resolved prompt`: The prompt actually sent to the model after workflow configuration is applied.

## Output Terms

- `transcription`: A persisted output record produced from a workflow run.
- `assembled transcription`: A transcription grouped and stored for review.
- `output name`: The label used to identify a transcription output in review views.
- `group membership JSON`: The stored JSON object that records the group-value combination used to assemble an output.
- `metrics`: Evaluation data such as CER, WER, or related quality measurements.

## Review Terms

- `comparison view`: The interface used to inspect transcriptions, compare them, and review metrics.
- `detail inspector`: The panel that shows the selected transcription, its ground truth, and related metadata.
- `source metadata`: The job or sample metadata used to explain where an output came from.

## Naming Rules

- Prefer `grouping` over `group` when referring to the named categorization dimension.
- Prefer `group value` over `value` when the meaning could be ambiguous.
- Prefer `workflow stage` over `stage` when the workflow context matters.
- Prefer `transcription job` over `job` when distinguishing execution from output review.
- Prefer `assembled transcription` over `result` when referring to persisted reviewable output.
