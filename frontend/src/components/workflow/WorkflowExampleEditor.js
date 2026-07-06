"use client";

export function WorkflowExampleEditor({ examples, actions }) {
  return (
    <>
      {examples.map((example, index) => (
        <div className="example-editor" key={index}>
          <div className="field">
            <label htmlFor={`example-title-${index}`}>Title</label>
            <input
              id={`example-title-${index}`}
              data-example-field="title"
              data-example-index={index}
              value={example.title}
              onChange={(event) => actions.setWorkflowDraftField(
                "examples",
                examples.map((item, exampleIndex) => (
                  exampleIndex === index ? { ...item, title: event.target.value } : item
                )),
              )}
            />
          </div>
          <div className="field">
            <label htmlFor={`example-instructions-${index}`}>Instruction text</label>
            <textarea
              id={`example-instructions-${index}`}
              data-example-field="instruction_text"
              data-example-index={index}
              rows="4"
              value={example.instruction_text}
              onChange={(event) => actions.setWorkflowDraftField(
                "examples",
                examples.map((item, exampleIndex) => (
                  exampleIndex === index ? { ...item, instruction_text: event.target.value } : item
                )),
              )}
            />
          </div>
          <div className="field">
            <label htmlFor={`example-assets-${index}`}>Assets</label>
            <textarea
              id={`example-assets-${index}`}
              data-example-field="assets"
              data-example-index={index}
              rows="2"
              value={example.assets}
              onChange={(event) => actions.setWorkflowDraftField(
                "examples",
                examples.map((item, exampleIndex) => (
                  exampleIndex === index ? { ...item, assets: event.target.value } : item
                )),
              )}
            />
          </div>
          <button className="btn-danger" type="button" data-action="remove-example" data-example-index={index}>
            Remove example
          </button>
        </div>
      ))}
      <button className="btn-ghost" type="button" data-action="add-example">
        Add example
      </button>
    </>
  );
}
