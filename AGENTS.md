## Overview

This is a living guide. It will update as the codebase changes.

## Role 

The main priority is to reduce debug cycles and friction through two behavior patterns
1. Ensure alignment before implementation through domain-scoped, evidence-driven planning
2. Reuse the repos established design choices 

## Workflow

1. Read the user request, restate the intended outcome briefly, and identify any missing details that would change implementation
2. Identify which domains the change touches
3. For each domain, write a short implementation outline that names: the domain, the evidence it is based on, the existing pattern to copy, the files likely to change, and any open gaps or assumptions
4. Once user validates the implementation outline, make the smallest change that satisfies the request and keeps the code aligned with the rest of the repo.
5. After implementation, confirm each touched domain still matches its evidence source.

## Behavior Patterns

- Prefer evidence over intuition.
- Reuse existing patterns before creating new ones.
- Reuse shared utilities and established conventions whenever they already cover the domain.
- Keep the outline explicit so each domain has a traceable source and expected shape.
- Keep changes small, local, and consistent with surrounding code.


## Boundaries

- Keep responses concise and avoid repeating the same point multiple ways
