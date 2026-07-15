# Workflow Resource Endpoints

The Workflow Resources page manages:

* Artifact groups
* Payload templates
* Output specifications

Each GET endpoint returns full hydrated rows so the page can load all resource details at once without separate detail requests.

```text
GET    /api/v2/artifact-groups
POST   /api/v2/artifact-groups/preview
POST   /api/v2/artifact-groups
DELETE /api/v2/artifact-groups

GET    /api/v2/payload-templates
POST   /api/v2/payload-templates
DELETE /api/v2/payload-templates

GET    /api/v2/output-specs
POST   /api/v2/output-specs
DELETE /api/v2/output-specs

GET /api/v2/workflow-steps 
POST /api/v2/workflow-steps
DELETE /api/v2/workflow-steps
```

## Artifact Groups

### `GET /api/v2/artifact-groups`

1. Load all artifact groups.
2. Hydrate each group with its membership mapping and sample mapping.
3. Include mapping type, ordering behavior, and artifact counts.
4. Return full page-ready rows in a stable order.

### `POST /api/v2/artifact-groups/preview`

1. Accept the artifact-group details, membership mapping, and sample mapping from the creation wizard.
2. Search the membership-mapping rules against existing artifacts.
3. For matched artifacts, search the samples table using the proposed sample mapping.
4. Report matched groups, originating samples, unmapped artifacts, ambiguities, and mapping-type conflicts.
5. Do not persist the artifact group or change existing artifacts.

### `POST /api/v2/artifact-groups`

1. Accept the group details and both mapping definitions from the creation wizard.
2. Validate the membership mapping, sample mapping, and mapping type.
3. Run the same backend mapping validation used by the preview endpoint.
4. Create the artifact group, membership mapping, and sample mapping in one transaction.
5. Roll back the complete creation if any part fails.
6. Return the hydrated artifact-group row.

### `DELETE /api/v2/artifact-groups`

1. Accept one or more artifact-group IDs.
2. Verify that every requested group exists.
3. Validate all groups before deleting any of them.
4. Delete the artifact groups and their owned mapping rows in one transaction.
5. Set existing artifacts’ `artifact_group_id` to null through the configured foreign-key behavior.
6. Roll back all deletions if any operation fails.
7. Return `204`.

---

## Payload Templates

### `GET /api/v2/payload-templates`

1. Load all payload templates.
2. Hydrate each template with its payload inputs.
3. Include binding modes, source types, template paths, matching settings, ordering rules, and batch limits.
4. Return full page-ready rows in a stable order.

### `POST /api/v2/payload-templates`

1. Accept the template definition and payload inputs from the creation wizard.
2. Validate the template structure and every template path.
3. Validate fixed and sample-bound input configurations.
4. Verify all referenced assets, artifact groups, or other source records.
5. Create the template and all payload inputs in one transaction.
6. Roll back the complete creation if any input fails.
7. Return the hydrated payload-template row.

### `DELETE /api/v2/payload-templates`

1. Accept one or more payload-template IDs.
2. Verify that every template exists.
3. Check whether any template is referenced by a workflow step.
4. Return `409 Conflict` and delete nothing if any template is referenced.
5. Delete all unreferenced templates and their payload inputs in one transaction.
6. Roll back all deletions if any operation fails.
7. Return `204`.

---

## Output Specifications

### `GET /api/v2/output-specs`

1. Load all output specifications.
2. Return their complete schema and parsing configuration.
3. Include any field definitions and validation metadata needed by the page.
4. Return full page-ready rows in a stable order.

### `POST /api/v2/output-specs`

1. Accept the output-specification definition from the creation wizard.
2. Validate the schema structure, field names, and supported field types.
3. Reject duplicate paths or unsupported parsing behavior.
4. Compile or test the specification before persistence where applicable.
5. Create the output specification.
6. Return the complete created row.

### `DELETE /api/v2/output-specs`

1. Accept one or more output-specification IDs.
2. Verify that every specification exists.
3. Check whether any specification is referenced by a workflow step.
4. Return `409 Conflict` and delete nothing if any specification is referenced.
5. Delete all unreferenced specifications in one transaction.
6. Roll back all deletions if any operation fails.
7. Return `204`.

## Workflow Steps

### `GET /api/v2/workflow-steps`

1. Load all reusable workflow-step rows.
2. Hydrate each step with its referenced payload template and output specification.
3. Include model configuration, step metadata, and any fields needed by the Workflow Resources page.
4. Return full page-ready rows in a stable order.
5. Do not require separate detail requests.

### `POST /api/v2/workflow-steps`

1. Accept the workflow-step definition from the creation wizard.
2. Validate the step name, model configuration, payload-template reference, and output-specification reference.
3. Verify that the referenced payload template and output specification exist.
4. Validate that the selected model and payload configuration are compatible.
5. Create the workflow step in one transaction.
6. Return the complete hydrated workflow-step row.

### `DELETE /api/v2/workflow-steps`

1. Accept one or more workflow-step IDs.
2. Verify that every requested workflow step exists.
3. Check whether any step is referenced by a workflow DAG node.
4. Return `409 Conflict` and delete nothing if any requested step is still in use.
5. Delete all unreferenced workflow steps in one transaction.
6. Roll back the entire deletion if any operation fails.
7. Return `204`.