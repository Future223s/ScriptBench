"use client";

import {
  EmptyState,
  Field,
  Grid,
  Inline,
  Select,
  Stack,
  StatusBadge,
  TextInput,
} from "../../ui/primitives/index.js";

export function SampleFilterPanel({
  filters = [],
  actions = "",
  summary = "",
  rows = null,
  emptyState = "No samples match the current filters.",
  listClass = "sample-picker",
  listAttributes = {},
  actionsClassName = "",
}) {
  return (
    <Stack gap="compact">
      {summary || actions ? (
        <Inline align="center" justify={summary ? "between" : "end"}>
          {summary ? <StatusBadge>{summary}</StatusBadge> : null}
          {actions ? <Inline gap="default">{actions}</Inline> : null}
        </Inline>
      ) : null}
      <Grid columns={Math.min(filters.length, 4)}>
        {filters.map((filter) => {
          const fieldProps = {
            id: filter.id,
            ...(filter.kind === "select"
              ? {
                  value: filter.value ?? "",
                  onChange: (event) => filter.onChange(event.target.value),
                }
              : {
                  value: filter.value ?? "",
                  onChange: (event) => filter.onChange(event.target.value),
                }),
            disabled: filter.disabled || false,
            required: filter.required || false,
            placeholder: filter.placeholder || undefined,
          };

          return (
            <Field key={filter.id} label={filter.label} action={filter.action}>
              {filter.kind === "select" ? (
                <Select {...fieldProps}>
                  {(filter.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput type="text" {...fieldProps} />
              )}
            </Field>
          );
        })}
      </Grid>
      <Stack gap="compact" {...listAttributes}>
        {rows || <EmptyState title={emptyState} />}
      </Stack>
    </Stack>
  );
}
