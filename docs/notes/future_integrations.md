# Future Integrations

## Prompt resources

The payload template record must own only the payload identity and template JSON. Resource-query definitions belong in a separate `prompt_resources` table rather than inside the persisted payload JSON.

### Current persistence model

`payload_template`

- `payload_template_id`
- payload template metadata
- `payload_template`: the prompt JSON/template only

`prompt_resources`

- `prompt_resource_id`
- `payload_template_id` — foreign key to `payload_template`
- `resource_name` — name used in prompt references, such as `instructions` or `line_crops`
- `source_table`
- `batch_limit`

`prompt_resource_conditions`

- `prompt_resource_condition_id`
- `prompt_resource_id` — foreign key to `prompt_resources`
- `field`
- `operator`
- `value_type` — initially `sample_field` or `manual`
- `value`

This normalizes one resource with many conditions and keeps query configuration out of the prompt JSON.

### Runtime resolution contract

For each execution input/sample:

1. Fetch the payload template by `payload_template_id`.
2. Fetch its `prompt_resources` and their conditions.
3. Resolve each resource by querying its configured table with field/operator/value conditions.
4. When `{{resource.attribute}}` occurs, substitute the attribute from the resolved resource row.
5. When `$each` occurs, resolve the named resource and expand the target JSON array once for every matched row; interpolate that resource's attributes in every expanded template object.
6. Convert the fully rendered prompt JSON to provider-specific prompt content.

### Current limits

- only `artifacts` and `samples` are supported source tables;
- only `input_text` prompt content is rendered; file/image parts still need a typed provider-content mapping;
- `batch_limit` currently caps resolved rows instead of producing independent execution batches;
- no query-plan validation or preview is available before execution;
- only `sample-field` and `manual` condition values are supported;
- nested `$each`, resource-to-resource conditions, and regex/pattern matching are intentionally out of scope.

### Compatibility

The resolver retains a backward-compatible reader for templates created while resource definitions were embedded in the template JSON. New templates persist prompt JSON and prompt-resource rows separately.
