# Sample Intake and Grouping

## Overview

Support uploading source samples and derived line crops, storing ground truth where available, inspecting sample records, searching and filtering the sample set, and assigning samples into named groupings and group values. This slice covers the data entry and organization layer that all workflow authoring depends on.

## UI

- Provide an upload entry point for either individual files or bulk folder uploads.
- Show uploaded samples in a browsable list with search and group-based filtering.
- Let the user open a sample to inspect its metadata, image content, and ground truth text.
- Let the user create a grouping, narrow the sample picker with contains-style search, bulk-select the visible rows, and assign those samples to that grouping or to a group value.
- Keep bulk-select interactions fast and obvious, since this is the primary way the user tags many line crops at once.

## API

- Read the dashboard and sample list to populate the sample browser.
- Use the sample upload endpoint to create or replace sample records.
- Use the grouping endpoints to create a grouping, add grouping values, and delete a grouping.
- Use sample-detail requests when a user opens an individual sample for inspection.
- Filter the loaded sample list locally in the create-grouping modal so search and contains matching stay responsive without a new server endpoint.
- Refresh the dashboard after uploads or grouping changes so the sample and grouping panels stay in sync.

## Storage

- Read from `samples` to list samples, filter by sample group, and inspect ground truth or sample bytes.
- Write to `samples` when uploading, updating ground truth, assigning a sample to a group, or assigning a sample to a group value.
- Use the `sample_group` and `sample_groups` fields as the current source of truth for grouping membership.
- Use the sample list ordered by sample ID when rendering sample selection and grouping views.
- Treat the create-grouping search box as a client-side filter over the loaded samples, with contains, starts-with, and exact matching modes.

## Open Questions

- Groupings are currently stored on the sample record instead of in a dedicated grouping table. That works for the current UI, but it leaves the grouping model split between a naming layer and sample-side membership data.
- The codebase does not yet define a first-class distinction between source samples and line crops beyond how the user names them.
- The create-grouping picker now supports local search and bulk selection, but it still only filters the loaded sample set and does not yet browse derived grouping combinations or server-side faceted results.
