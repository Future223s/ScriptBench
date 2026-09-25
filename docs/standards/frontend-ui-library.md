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
- `ColumnFilter` — the catalog column-header filter trigger and menu, including the active-filter dot.
- `CatalogPagination` — the standard result range and previous/next catalog footer.
- `DataTable` — the canonical catalog table with composable columns, row rendering, activation, and optional selection.
- `EmptyState`, `LoadingState`, `LoadingPlaceholder`, and `Notification`

It also owns the locked theme: Inter for UI text, Georgia for display headings, and all color, spacing, typography, radius, elevation, motion, responsive, and icon-size tokens.

Only the primitives domain may define or change these styles. A primitive has one canonical style by default. Variants are reserved for reusable semantic differences such as primary and destructive actions; they must not encode page-specific appearances or accept arbitrary styling overrides.

## Patterns domain

Patterns compose primitives into reusable product structures without redefining them:

- `Catalog` — title/description, metadata and action slots, primary search or selection controls, a body, and a footer.

Patterns live under `frontend/src/ui/patterns/{PatternName}` with their own implementation and stylesheet.

## Style ownership and location

- `frontend/src/ui/foundation/tokens.css` contains values only: semantic colors, typography, spacing, radii, control dimensions, elevation, and motion.
- `frontend/src/ui/primitives/{PrimitiveName}/{PrimitiveName}.css` owns one primitive's complete canonical appearance and states.
- `frontend/src/ui/patterns/{PatternName}/{PatternName}.css` owns only the layout required to compose its primitives.
- `frontend/src/app/styles/pages/{page-name}.css` owns high-level page geometry that cannot be expressed by a shared pattern.
- `frontend/src/ui/primitives/primitives.css` and `frontend/src/app/styles/components` remain compatibility layers during migration. New verified styling must not be added to them.

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

Page-specific geometry must live in `frontend/src/app/styles/pages/{page-name}.css`. Do not add primitive or pattern styling there; global CSS is limited to shared application-wide concerns.

## Copy casing

Instructional text must use sentence case and the shared `Instruction` primitive; all-uppercase instructions are prohibited.

## Versioning and protection

The UI library is versioned as one contract. Visual or public-prop changes require a changelog entry; breaking changes require a major-version migration note. Consumer pages must migrate to approved variants rather than preserving deprecated styling.

### Changelog

- **1.9.0** — Promoted the approved Dashboard configuration into the canonical foundation tokens and owning primitive styles; application pages no longer opt into a Dashboard theme.
- **1.8.0** — Began the canonical stylesheet split: verified primitives now own dedicated CSS files, `Catalog` moved to the patterns layer, and legacy styles remain as an explicit compatibility layer.
- **1.7.0** — Adopted the approved prototype's dark colorway as the canonical application palette through the shared semantic tokens.
- **1.6.0** — Standardized `Tabs` on the Dashboard underline treatment as its sole visual form; `SegmentedControl` remains the distinct compact pill control.
- **1.5.0** — Added the opt-in Dashboard application theme for its compact typography, controls, spacing, radii, and elevation; File Management is the first consumer.
- **1.4.0** — Aligned the canonical catalog primitives with the approved Dashboard prototype: full-width primary search, column filters, conditional selection, compact tables, and pagination.
- **1.3.0** — Added the composable `Catalog` primitive and separated page-header actions from catalog-header and selection controls.
- **1.2.0** — Aligned the locked typography, warm neutral colors, elevation, stacked-selector proportions, and edit icon with the approved dashboard prototype.
- **1.1.0** — Added the shared `PageHeader` and `StackedSelect` primitives, the floating page-header variant, and optional primary-navigation icons for the unified application-shell migration.

## Linting and cleanup

During migration, treat the following as errors:

- `className` or style props passed to protected primitives/templates unless explicitly documented;
- raw color, font, spacing, radius, shadow, z-index, or transition values outside the primitives domain;
- selectors targeting primitive/template internals from a page stylesheet;
- duplicate component styles or a new one-off visual variant.

Use linting to reject these patterns, then resolve each failure by removing the override, using an existing variant, or adding a reviewed reusable variant in the primitives domain. Do not silence or waive lint errors for page-specific CSS.
