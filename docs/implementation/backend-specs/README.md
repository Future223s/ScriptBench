# Backend Specs

This folder is a quick reference layout of the current backend codebase.
It mirrors the source folders and uses consistent trigger words so each file is easy to scan.

## Trigger Words

- `Database`: table shape, indices, and foreign keys
- `Repository`: persistence methods for that table
- `Service`: initialization, integration map, and method behavior
- `Endpoint`: caller and step-by-step request workflow

## Layout

- `database/`
- `services/`
- `api/`

## Scope

- Backend only
- Frontend intentionally excluded for now
- Existing implementation slice docs are left untouched
