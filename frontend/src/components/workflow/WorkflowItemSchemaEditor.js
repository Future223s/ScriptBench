"use client";

export function WorkflowItemSchemaEditor({ itemSchemaEntries, actions }) {
  return (
    <>
      {itemSchemaEntries.map((entry, index) => (
        <div className="schema-row" key={index}>
          <div className="field">
            <label htmlFor={`item-schema-field-${index}`}>Field</label>
            <input
              id={`item-schema-field-${index}`}
              data-schema-field="field"
              data-schema-index={index}
              value={entry.field}
              onChange={(event) => actions.setWorkflowDraftField(
                "item_schema_entries",
                itemSchemaEntries.map((item, entryIndex) => (
                  entryIndex === index ? { ...item, field: event.target.value } : item
                )),
              )}
              placeholder="text"
            />
          </div>
          <div className="field">
            <label htmlFor={`item-schema-description-${index}`}>Description</label>
            <input
              id={`item-schema-description-${index}`}
              data-schema-field="description"
              data-schema-index={index}
              value={entry.description}
              onChange={(event) => actions.setWorkflowDraftField(
                "item_schema_entries",
                itemSchemaEntries.map((item, entryIndex) => (
                  entryIndex === index ? { ...item, description: event.target.value } : item
                )),
              )}
              placeholder="Describe this field"
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn-danger" type="button" data-action="remove-schema-field" data-schema-index={index}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button className="btn-ghost" type="button" data-action="add-schema-field">
        Add field
      </button>
      <span className="count-label">Used when the output format is structured, such as json_array.</span>
    </>
  );
}
