"use client";

export function SampleFilterPanel({
  filters = [],
  actions = "",
  summary = "",
  rows = null,
  emptyState = "No samples match the current filters.",
  listClass = "sample-picker",
  listAttributes = {},
}) {
  return (
    <div className="selection-summary">
      <div className="sample-filter-grid">
        {filters.map((filter) => {
          const fieldProps = {
            id: filter.id,
            ...(filter.kind === "select"
              ? { value: filter.value ?? "", onChange: (event) => filter.onChange(event.target.value) }
              : { value: filter.value ?? "", onChange: (event) => filter.onChange(event.target.value) }),
            disabled: filter.disabled || false,
            required: filter.required || false,
            placeholder: filter.placeholder || undefined,
          };

          return (
            <div className="field" key={filter.id}>
              <label htmlFor={filter.id}>{filter.label}</label>
              {filter.kind === "select" ? (
                <select {...fieldProps}>
                  {(filter.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" {...fieldProps} />
              )}
            </div>
          );
        })}
      </div>
      {actions ? <div className="inline-actions workflow-selection-actions">{actions}</div> : null}
      {summary ? <div className="count-label">{summary}</div> : null}
      <div className={listClass} {...listAttributes}>
        {rows || <div className="empty-state">{emptyState}</div>}
      </div>
    </div>
  );
}
