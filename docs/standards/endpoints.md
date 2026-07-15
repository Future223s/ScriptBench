## Files To Check First

- `/database/tables`
  - Treat these table definitions as the authoritative persistence schema.
  - Use them as the source of truth for field names, types, nullability, defaults, primary keys, unique constraints, and relationships.

- `/database/repositories`
  - Add or update repository methods only when the current change requires persistence behavior.
  - Repositories should reflect the table contract and only contain persistence operations needed by the current feature.

- `/models`
  - Ensure Pydantic models exist where needed for:
    - request payloads
    - response payloads
    - database record shapes
  - Realign models when they diverge from the persistence schema.

- If the current iteration includes frontend integration:
  - `/frontend/api/endpoints`
  - `/hooks/{corresponding-page}/{corresponding-hook}`

## Precedence

When shapes or contracts disagree, use this precedence order unless the user explicitly instructs otherwise:

1. `/database/tables`
2. `/models` database record models
3. repository behavior
4. API request/response models
5. backend endpoint wiring
6. frontend API client/endpoints
7. frontend hooks and UI consumers

If prose docs conflict with `/database/tables`, treat `/database/tables` as authoritative for implementation.

## Model Boundaries

- Distinguish database record models from API models.
- Database record models should match the persistence shape closely.
- API request models should represent what the endpoint accepts.
- API response models should represent what the endpoint returns.
- Do not assume database record models and API models are identical.
- Only expose fields in API models that are intentionally part of the API contract.

## Repository Scope

- Only add repository methods required for the current change.
- Do not create speculative repository methods for possible future use.
- Remove stale repository methods that no longer match the current table contract when they are clearly obsolete.
- Keep repositories focused on persistence access, not response shaping or endpoint-specific orchestration.

## Practices

- Prefer the smallest local change that restores alignment.
- Reuse existing repo patterns before introducing a new shape.
- Do not create endpoint-local helper methods just to centralize one-off logic.
- If logic is genuinely reusable across endpoints, move it into dependencies or another shared backend module.
- Wrap every endpoint response in the appropriate generic API response model from `/models/api`.
- Do not return ad hoc raw dictionaries from endpoints when a typed response model exists.

## Logging Guidance

- Emit a log immediately before returning a successful response.
- Logs should be structured and include the primary identifier(s) for the object or operation being returned.
- Include enough context for validation without dumping unnecessary payload data.

## Nullability And Default Matching

- Match database nullability in database record models unless there is an explicit reason not to.
- Match database defaults in models and endpoint behavior where those defaults are part of the contract.
- If a field is nullable in the database but required in the API, that must be an intentional API decision.
- If a field has a database default, do not require callers to provide it unless the API intentionally overrides that behavior.
- When models and schema differ on required vs optional fields, realign them to the database contract unless the user explicitly requests a different API boundary.

## Frontend Integration

If the current iteration touches frontend integration:

- Verify the backend response model and frontend API contract still match exactly.
- Update the corresponding frontend endpoint client and consuming hook in the same iteration.
- Keep field names consistent across backend and frontend unless there is an intentional translation boundary.