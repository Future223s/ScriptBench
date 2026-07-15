```text
GET    /api/v2/samples
POST   /api/v2/samples
DELETE /api/v2/samples

GET    /api/v2/assets
POST   /api/v2/assets
DELETE /api/v2/assets/{asset_id}
DELETE /api/v2/assets

GET    /api/v2/artifacts
POST   /api/v2/artifacts
POST   /api/v2/artifacts/map
DELETE /api/v2/artifacts/{artifact_id}
DELETE /api/v2/artifacts
```

## Samples

### `GET /api/v2/samples`

1. Load all sample rows needed by the File Management page.
2. Return full hydrated records, including metadata and blob access information.
3. Apply stable ordering, preferably by `sample_name`.
4. Support optional filters without requiring separate detail requests.

### `POST /api/v2/samples`

1. Accept one or more sample files in a single request.
2. Validate file type, size, sample name, and optional ground-truth text.
3. Reject duplicate names in the request or database.
4. Create every sample in one transaction.
5. Roll back the complete request if any sample fails.
6. Return the created hydrated sample rows.

### `DELETE /api/v2/samples`

1. Accept one or more sample IDs.
2. Verify that every sample exists and can be deleted.
3. Reject the complete request if any sample has a deletion conflict.
4. Delete all samples and cascading dependent records in one transaction.
5. Roll back all deletions if any operation fails.
6. Return `204` when successful.

---

## Assets

### `GET /api/v2/assets`

1. Load all asset rows required by the page.
2. Return full hydrated records with metadata and blob access information.
3. Apply stable ordering by `asset_name`.
4. Support optional filtering by asset name or type.

### `POST /api/v2/assets`

1. Accept one or more asset files.
2. Validate file type, size, asset type, and asset name.
3. Derive the asset name from the filename when omitted.
4. Reject duplicate names.
5. Create all assets atomically.
6. Return the created hydrated asset rows.

### `DELETE /api/v2/assets/{asset_id}`

1. Verify the asset exists.
2. Check whether it is referenced by a fixed payload input.
3. Return `409` when deletion would break a referenced resource.
4. Delete the asset and its stored blob.
5. Return `204`.

### `DELETE /api/v2/assets`

1. Accept one or more asset IDs.
2. Validate every asset and its references before deleting anything.
3. Reject the complete request if any asset cannot be deleted.
4. Delete all assets in one transaction.
5. Roll back every deletion if one fails.
6. Return `204`.

---

## Artifacts

### `GET /api/v2/artifacts`

1. Load all artifact rows required by the File Management page.
2. Hydrate each artifact with its artifact group and originating sample.
3. Include category, MIME type, blob access information, and lineage metadata.
4. Apply stable ordering or the artifact group’s configured position rule.
5. Support optional filtering by group, sample, category, or name.

### `POST /api/v2/artifacts/map`

1. Accept metadata for one or more new artifacts, or IDs of existing artifacts being remapped.
2. Search every `membership_mapping` row to find which artifact group each artifact belongs to.
3. Reject or report artifacts matching zero or multiple groups.
4. Load the selected group’s `sample_mapping`.
5. Search the samples table to find which sample matches each artifact.
6. Reject or report artifacts matching zero or multiple samples.
7. Validate one-to-one or one-to-many group constraints.
8. Return a complete mapped payload without persisting changes.

### `POST /api/v2/artifacts`

1. Accept one or more mapped artifacts returned by `/artifacts/map`.
2. Verify all referenced groups, samples, files, and mappings still exist.
3. Revalidate membership, sample mapping, uniqueness, and mapping-type constraints.
4. Insert new artifacts or refresh existing artifact assignments.
5. Perform all changes in one transaction.
6. Roll back the entire request if any artifact fails.
7. Return the created or updated hydrated artifact rows.

### `DELETE /api/v2/artifacts/{artifact_id}`

1. Verify the artifact exists.
2. Check dependent lineage or execution references.
3. Apply configured foreign-key behavior to child artifacts.
4. Delete the artifact and its stored blob.
5. Return `204`.

### `DELETE /api/v2/artifacts`

1. Accept one or more artifact IDs.
2. Validate every artifact and dependency before deleting anything.
3. Reject the complete request if any artifact cannot be deleted.
4. Delete all artifacts in one transaction.
5. Roll back every deletion if one fails.
6. Return `204`.