How can I expose an interface for viewing and updating workflow-steps, payload-templates, and 


Please use this information to create a new page in the application titled 

User Flows
Add Workflow Step
Delete Workflow Step
Add Dependency
Delete Dependency
Create Workflow Step
Create Payload Template
Create Output Specification
Save Workflow
UI Component
Workflow Metadata Form 
Workflow Name Input
Workflow Description Input
Sample Set Dropdown
Save Workflow Button 
Workflow Creation Control Bar
Add Workflow Step Button
Add Dependencies Button
Delete Workflow Step Button
Delete Dependencies Button
Cancel Button
Workflow Mode Instructions
Confirm Action Button
Workflow Creation Canvas
Placement Grid
Placement Target Squares
Workflow Step Nodes
Dependency Edges
Workflow Step Assignment Popup 
Workflow Step Selector 
Create Workflow Step Button 
Confirm Step Selection Button 
Workflow Step Creation Wizard
Next Button
Workflow Step Identification Form (Step 1)
Payload Template Setup (Step 2)
Payload Template Selector
Create Payload Template Button
Payload Template Creation Form
Payload Template Metadata Form
Payload Template Inputs List
Add Input Button
Output Specification Setup (Step 3)
Output Specification Selector
Create Output Specification Button
Output Specification Creation Form
Presentation Hook Methods
selectNode
Visually updates the selected state of the Workflow Step Node.
Updates available Placement Target Squares.
enterAddWorkflowStepMode
Hides mode selection actions and displays Cancel Button.
Updates the Workflow Creation Control Bar to display add-step instructions.
Enables Placement Target Squares on selected Workflow Step Nodes.
enterAddDependencyMode
Updates the Workflow Creation Control Bar to display dependency creation instructions.
Hides mode selection actions and displays Cancel Button.
Enables parent/child selection on Workflow Step Nodes.
enterDeleteWorkflowStepMode
Updates the Workflow Creation Control Bar to display workflow step deletion instructions.
Hides mode selection actions and displays Cancel Button.
Enables deletion selection on Workflow Step Nodes.
enterDeleteDependencyMode
Updates the Workflow Creation Control Bar to display dependency deletion instructions.
Hides mode selection actions and displays Cancel Button.
Enables parent/child selection on Dependency Edges.
confirmWorkflowStepAddition
Creates the selected workflow DAG node from the Workflow Step Assignment Popup.
Calls createWorkflowDagNode.
Calls loadWorkflow to refresh the Workflow Creation Canvas.
confirmWorkflowStepDeletion
Removes the selected Workflow Step Node from the Workflow Creation Canvas.
Calls deleteWorkflowDagNode.
Calls loadWorkflow.
confirmDependencyAddition
Creates a dependency between selected Workflow Step Nodes.
Updates the corresponding Dependency Edges.
Calls createWorkflowDagEdge.
Calls loadWorkflow.
confirmDependencyDeletion
Removes the selected dependency from the Dependency Edges.
Calls deleteWorkflowDagEdge.
Calls loadWorkflow.
cancelCanvasAction
Resets the Workflow Creation Control Bar to its default state.
Removes active instructions from Workflow Mode Instructions.
Clears selections from Workflow Step Nodes and Dependency Edges.
selectPlacementTarget
Updates the selected Placement Target Square.
Determines the placement location for a new Workflow Step Node.
Calls openWorkflowStepAssignment
openWorkflowStepAssignment
Opens the Workflow Step Assignment Popup.
Displays Workflow Step Source Selector.
submitWorkflowStepAssignment 
Validates the selected option from the Workflow Step Source Selector
Closes the Workflow Step Assignment Popup after successful selection. 
selectWorkflowStep
Updates the selected workflow step in the Workflow Step Selector.
Sets the selected step for the pending Workflow Step Node creation.
openWorkflowStepCreationWizard
Opens the Workflow Step Creation Wizard.
Initializes the Workflow Step Identification Form, Payload Template Setup, and Output Specification Setup stages.
createWorkflowStep
Creates a new workflow step through createWorkflowStep.
Creates associated payload template/output specification through createPayloadTemplate and createOutputSpecification when selected.
Closes Workflow Step Creation Wizard
nextWizardStage
Validates the current stage of the Workflow Step Creation Wizard.
Advances the wizard from Workflow Step Identification Form (Step 1) -> Payload Template Setup (Step 2) -> Output Specification Setup (Step 3).
selectPayloadTemplate
Updates the selected payload template in the Payload Template Selector.
Stores the selected payload template for the workflow step.
openPayloadTemplateCreation
Opens the Payload Template Creation Form.
Displays the Payload Template Metadata Form and Payload Template Inputs List.
createPayloadTemplate
Submits the Payload Template Creation Form.
Calls createPayloadTemplate.
Calls fetchPayloadTemplates.
Refreshes the Payload Template Selector with the newly created payload template available for selection.
createPayloadTemplateInput
Submits the Payload Template Creation Form.
Calls <u>createPayloadTemplate</u>.
Calls <u>fetchPayloadTemplates</u>.
Refreshes the Payload Template Selector with the newly created payload template available for selection.
submitPayloadTemplateInput
Validates the new input configuration.
Adds the created input to the Payload Template Inputs List.
Submits the Payload Template Creation Form.
Updates the Payload Template Inputs List.
Calls createPayloadTemplate.
selectOutputSpecification
Updates the selected output specification in the Output Specification Selector.
Stores the selected output specification for the workflow step.
openOutputSpecificationCreation
Opens the Output Specification Creation Form.
createOutputSpecification
Submits the Output Specification Creation Form.
Calls createOutputSpecification.
Calls fetchOutputSpecifications.
Refreshes the Output Specification Selector with the newly created output specification available for selection.
Service Hook Methods
loadWorkflow
GET /api/v2/workflows/{workflowId}
GET /api/v2/workflows/{workflowId}/workflow-dag-nodes
GET /api/v2/workflows/{workflowId}/workflow-dag-edges
createWorkflow
POST /api/v2/workflow/workflow-steps
createWorkflowDagNode
POST /api/v2/workflows/{workflowId}/workflow-dag-nodes
deleteWorkflowDagNode
DELETE  /api/v2/workflows/{workflowId}/workflow-dag-nodes
createWorkflowDagEdge
POST /api/v2/workflows/{workflowId}/workflow-dag-edges
deleteWorkflowDagEdge
DELETE /api/v2/workflows{workflowId}//workflow-dag-edges
getWorkflowSteps
GET /api/v2/workflow-steps
createWorkflowStep
POST /api/v2/workflow-steps
getPayloadTemplates
GET /api/v2/payload-templates
createPayloadTemplate
POST /api/v2/payload-templates
getOutputSpecifications
GET /api/v2/output-specs
createOutputSpecification
POST /api/v2/output-specs
Coincidence
exacamnete 
Endpoints
POST /api/v2/workflows
GET /api/v2/workflows/{workflowId}
GET /api/v2/workflows/{workflowId}/workflow-dag-nodes
GET /api/v2/workflows/{workflowId}/workflow-dag-edges
POST /api/v2/workflows/{workflowId}/workflow-dag-nodes
DELETE  /api/v2/workflows/{workflowId}/workflow-dag-nodes
POST /api/v2/workflows/{workflowId}/workflow-dag-edges
DELETE /api/v2/workflows{workflowId}//workflow-dag-edges
GET /api/v2/workflow-steps
POST /api/v2/workflow-steps
GET /api/v2/payload-templates
POST /api/v2/payload-templates
LIST /api/v2/payload-templates
GET /api/v2/output-specs
POST /api/v2/output-specs
LIST /api/v2/output-specs

file management

samples, assets, artifacts -> get (for detail view), list (for list), post (for uploading), delete (for delete) 
2 more tabs 
model uploads -> list, get 
asset_groups -> post, list, get, delete

workflow builder
get / save / create (both patch methods??)
create / delete / get edges and nodes 
create / get / lists payload templates and model specs

Workflow Creation Canvas
Canvas
Actions
Adding Workflow Steps
Click add workflow step
Select Node
Select / create workflow
Confirm selection
Deleting Workflow Steps
Select node
Confirm Selection to delete
Adding Dependencies
Click add dependency
Select parent
Select child
Confirm selection
Deleting Dependencies
Select parent
Select child
Confirm selection to delete
Create workflow step 
Supply workflow step identification (name, model_family, model)
Select or create workflow payload template
Create workflow payload template
Add input
Configure input
User Interface
A form section directly beneath the navigation bar containing inputs for the workflow name, description, and sample set selection (dropdown).
Immediately below the form section, a compact control bar with the Add Workflow Step, Add Dependencies, Delete Workflow Step, and Delete Dependencies actions centered horizontally.
When a mode is selected
The mode selection buttons disappear from the control bar
A cancel button appears on the left edge of the bar
Instructions for the current step are displayed in the center
A confirm step is displayed once all steps have been completed
“add dependencies” instructions
Select a parent step
Select a child step
Finally reveal a confirmation to create the dependency.
“add workflow step” instructions
Select the step you want to build from
Click one of the four translucent expansion squares (Clicking one of those squares opens up the workflow step selector popup for choosing what to place there.)
Finally reveal a confirmation to add the workflow step
“delete workflow step” instructions
Select the step you want to delete
Confirm
“delete dependency” 
Select the parent step
Select the child step
Finally reveal a confirmation to delete the dependency.
Clicking one of those squares opens a popup for choosing what to place there.
The popup includes a simple search bar and two top actions: Select workflow step and Create new workflow step.
Select workflow step lets the user choose from existing steps; Create new workflow step starts a new step from scratch.
Grid Scaffolding for node placement
Grid role: the grid is the placement scaffold, not the data model. Each workflow step occupies one cell, and the grid expands by adding rows or columns as new steps or branches are created.
Placement cues: when a node is selected in Add Nodes mode, show four translucent target squares in the adjacent grid cells around that node.
Square meaning: left = Add previous step, right = Add next step, above/below = Add parallel path.
SVG role: use SVG only for edges and dependency lines. The SVG layer should sit behind the nodes but above the grid background. 
Edge behavior: edges should snap from node ports to node ports, and the UI should only allow connections between distinct steps. 
Connection flow: in Add Edges mode, the SVG should visually preview the parent-to-child path while the user is selecting endpoints. 
Let the board resize automatically. The grid should expand outward when new steps or branches need more space.
Keep cell sizing uniform. Resizing should affect the overall canvas or lane spacing, not individual grid cells by hand
Workflow step creation wizard
Three stages (reuse existing workflow creation wizard)
1. The form contains inputs for identification fields.
 2. Interface for selecting / creating the prompt_template
Select a mode (create / select / update existing) and corresponding interface opens
Selecting a payload templates reveals scrollable list of existing payload templates
Creating a workflow reveals form for inputting identification information and dynamically builds a list of payload input
Adding a prompt input is done by clicking a captioned plus button
That opens a creation form at the top of the list of existing payload inputs. Clicking save adds the saved input to the list
3. Interface for selecting / creating the output_mode
Select a mode (create / select / update existing) and corresponding interface opens
Each mode should look visually the same to the workflow step creation wizard, except for creation which should only be a form (no list)
Creating a workflow payload template
Backend
Workflow Workspace
Execution Viewer
Actions
Manual selection of rows
Selection of all rows in a given column
Queuing of selected rows
Dequeuing of selected rows
Retrying of selected rows
User Interface
Reuse the same three-column layout but align names with Not Started, In Progress, and Completed. Headers 
A single, one-line execution panel above the three columns featuring configuration and execution controls
Configuration: selectors for maximum concurrent requests and maximum concurrent execution rows
Execution: button triggers for queuing, dequeing, or retiring selected rows. 
Execution controls move out of the column specific headers
Execution row card summary
Features sample_id, execution scope, and a truncated one-line blurb offering a glance at the names of sample-scoped inputs (e.g. sample_1, sample_1_artifact, samp…)
Details about current status
Not Started
Not started
In Progress
In Progress
Last successful completion: {enter name of workflow step last successfully completed}
Queued: Queued
Queued
Last successful completion: {enter name of workflow step last successfully completed}
Running: 
Running node {enter name of workflow step being run}
Last successful completion: {enter name of workflow_name last successfully completed}
Rows with decomposed_item execution scope are NOT displayed by the front end
Emitted events must only rerender their corresponding execution row.
Endpoints
 POST api/v2/workflows/workspaces/execution_rows: 
Creates a source execution row for every sample_id
All following endpoints nested under POST api/v2/workflows/workspaces/execution_rows
/queue
Step 1: Payload Resolution
For the current sample_id pertaining to the execution_row, it applies the matching_rule pertaining to every payload_input that goes into the current step’s payload_template and ensures that at least one object is present. If there are more objects than the batch_limit. It creates decomposed_item execution_rows for each batch, using the order in which the objects were returned according to the matching_rule as the canonical ordering. These are simply meant for downstream correlation with model_outputs; they are never displayed by the frontend. They are immediately queued, bypassing all other rows as decomposed_item should be transcribed first. After a decomposed_item row is successfully completed, it is checked whether other rows have also reached a successful output, if all execution_row_id for decomposed_items pertaining to the parent execution_row_id exist in model output, the deterministic, platform-defined model output merging service is called.
Step 2: Status Update Changes row status to queued
Status is changed to queued
Step 3: Worker Execution
Rows with status = queued are picked up with execution_row_id as the primary sorting key so that once a row is queued, it is prioritized for completion before wasting capacity on running new execution rows.
For every processed execution row, the worker emits two events carrying the execution_row_ud through the web-socket for frontend correlation with lifecycle updates: ASSEMBLING and REQUEST_SENT
Step 4: Failure handling
Failure at any point temporarily pauses the worker and triggers an FAILED event containing the execution_row_id, error message and raw payload. The event should trigger a popup that displays the summary execution row information along with the error message and raw payload (if applicable). User can either “Acknowledge” “Retry” or “Abort Execution”
Failures for decomposed items also contain parent_execution_id and expose the same options. 
/dequeue
All execution rows selected are reverted back to In Progress. In-flight requests are allowed to complete
/retry
All execution rows selected are reverted back to In Progress. In-flight requests are allowed to complete

execution
queue 
retry
dequeue
pause (sets variable that stops worker from consuming jobs)
get model output

error catching layer for worker so any job resolution / worker related issue and raises source

errors
gemini
worker code
payload creation
output soec resolution


Changes to Persistence:
Status enum expanded to include Running and Queued
Add last_successful_completion to execution_row
For initial nodes, workflow_dag_edges should be constructed linking them to an internal “root” node to simplify resolving the initial nodes.

Persistence idea
Rather than have prompt construction service infer the batching behavior when there are multiple rows of the same sample_bound input, the user defines it explicitly and we persist it. Having one row per repeated example adds unnecessary complexity since the logic is redundant. It also makes it difficult to know whether say 5 row are required or a maximum of 5 rows at a time are supported. So, we should add a count type to table, which for now should be interpreted as a maximum of count inputs. If the matching_rule determines more, then they should be made into a separate batch


Delete
