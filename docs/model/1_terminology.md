# Terminology

- **Payload template:** Stored JSON structure for a prompt; it contains no resolved row values.
- **Prompt resource:** Named query definition owned by a payload template. Its name is the namespace used by `{{resource.field}}` and `$each`.
- **Prompt-resource condition:** A field/operator/value predicate used to select source rows.
- **Execution context:** The workflow, current execution row, sample, step, and model family used to resolve one prompt.
- **Resolved resource:** Ordered source rows returned for a prompt resource in one execution context.
- **Rendered prompt:** Template JSON after interpolation and `$each` expansion, before provider conversion.
- **Job snapshot:** Immutable rendered prompt and file references stored before a provider call.
- **Upload reference:** Provider-specific file handle cached for a source object and model family; it is transport state, not a prompt resource.
