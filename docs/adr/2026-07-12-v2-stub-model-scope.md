# Keep V2 Stub Work Scoped to `models.py`

## Context

The user requested stubbed V2 endpoints for workflows, workflow steps, payload templates, and output specs, and then clarified that the intent was for the work to stay inside a single models file. The earlier interpretation expanded beyond that scope by considering endpoint scaffolding and router changes.

## Decision

For this change, keep the implementation limited to one `models.py` file that defines the required Pydantic models for the V2 stub shapes. Do not add endpoint behavior, router wiring, or broader refactors unless the user explicitly asks for those later.

This ADR covers the scope boundary only. It does not prescribe the eventual endpoint implementation beyond the model shapes needed by the stubs.
