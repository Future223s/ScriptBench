---
type: standard
domain: frontend-ui
status: active
---

# Frontend UI Library Standard

## Purpose

ScriptBench uses a small, versioned UI library to prevent visual drift. Its styles, fonts, tokens, primitives, and templates are protected contracts, not page-local implementation details.

## Primitives domain

The primitives domain owns the visual language and the only reusable UI building blocks:

- `Button` — primary, secondary, danger; compact and default sizes.
- `IconButton` — accessible compact actions such as close, delete, and zoom.
- `Icon` — approved SVG glyphs for common actions and navigation.
- `Field` — label, control, help text, and validation state for inputs, selects, textareas, and checkboxes.
- `Panel` — standard, inset, and selectable containers.
- `ListRow` — standard, selected, and actionable rows.
- `SelectableRow` — single- or multi-select rows with a locked selection treatment.
- `StatusBadge` — neutral, success, info, warning, and danger states.
- `Tabs` / `SegmentedControl`
- `StepStrip` — numbered current/completed/upcoming progress for short flows.
- `CollapsibleSection` — a standard labelled open/close content region.
- `EmptyState`, `LoadingState`, `LoadingPlaceholder`, and `Notification`

It also owns the locked theme: Inter for UI text, Playfair Display for display headings, and all color, spacing, typography, radius, elevation, motion, responsive, and icon-size tokens.

Only the primitives domain may define or change these styles. Each primitive exposes documented variants and semantic props; it must not accept arbitrary styling overrides.

## Workflow: tokens → primitives → code

1. **Tokens** define the small, approved scale for fonts, type sizes, colors, spacing, radii, controls, elevation, and motion.
2. **Primitives** consume only those tokens and own their visual and reusable interaction behavior.
3. **Components and pages** compose primitives: they choose order, slots, layout relationships, domain data, and callbacks.

Composition may use approved layout primitives such as `Stack`, `Grid`, and `SplitPane`. It must not restyle a primitive, target its internals, or add a one-off visual exception. If composition exposes a reusable missing capability, add a documented primitive or primitive variant first.

## Templates

Larger templates must be composed only from the locked primitives and theme tokens:

- `AppShell`
- `CollectionPage`
- `WorkspacePage`
- `BuilderPage`
- `FlowModal`
- `Dialog`

Templates may arrange primitives and expose structural slots. They may not introduce a new visual language, redefine primitive styling, or accept arbitrary/page-specific class-name overrides. A necessary reusable variation becomes an explicit primitive or template variant after review; it is never added as an ad hoc CSS exception.

## Page-level domain

All application pages are strictly consumer pages. They may:

- supply domain data, copy, callbacks, and approved template variants;
- choose documented layout slots; and
- implement domain-specific behavior.

They may not define typography, colors, spacing scales, button/form/panel/modal styling, or page-specific overrides of primitive/template classes. Page CSS is permitted only for domain geometry that cannot belong to a template (for example, workflow-canvas node positioning), and it must use locked tokens.

Larger page-specific component styles that compose primitives must live in `/ui/pages/{page_name}.css`. Do not add those styles to a global CSS file; global CSS is limited to shared application-wide concerns.

## Copy casing

Instructional text must use sentence case and the shared `Instruction` primitive; all-uppercase instructions are prohibited.

## Versioning and protection

The UI library is versioned as one contract. Visual or public-prop changes require a changelog entry; breaking changes require a major-version migration note. Consumer pages must migrate to approved variants rather than preserving deprecated styling.

## Linting and cleanup

During migration, treat the following as errors:

- `className` or style props passed to protected primitives/templates unless explicitly documented;
- raw color, font, spacing, radius, shadow, z-index, or transition values outside the primitives domain;
- selectors targeting primitive/template internals from a page stylesheet;
- duplicate component styles or a new one-off visual variant.

Use linting to reject these patterns, then resolve each failure by removing the override, using an existing variant, or adding a reviewed reusable variant in the primitives domain. Do not silence or waive lint errors for page-specific CSS.
