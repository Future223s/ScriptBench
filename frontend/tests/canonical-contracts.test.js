import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneFilters, normalizeRecordPreview, recordIdForType, visibleRecordsForType,
} from '../src/hooks/file-management/fileManagementShared.js';
import {
  buildWorkflowSteps, cloneWorkflowStepFilters, visibleWorkflowStepRows,
} from '../src/hooks/workflow-steps/workflowStepsShared.js';
import { buildWorkflowPayload } from '../src/utils/workflow.js';
import { buildCharacterDiff } from '../src/utils/textDiff.js';
import {
  getCanvasBounds, isCanvasPlacementAvailable,
} from '../src/components/workflow-builder/workflowBuilderUtils.js';

test('step output diff refines substitutions at character level', () => {
  assert.deepEqual(buildCharacterDiff('riwer', 'river'), [
    { type: 'equal', text: 'ri' },
    { type: 'delete', text: 'w' },
    { type: 'insert', text: 'v' },
    { type: 'equal', text: 'er' },
  ]);
});

test('file selectors use local IDs and resolve group display names through foreign keys', () => {
  const groups = [{ id: 90, name: 'Line crops', description: 'Segments' }];
  const derivative = { id: 7, name: 'page_line_1', sample_id: 'page', derivative_group_id: 90 };
  const preview = normalizeRecordPreview('derivative', derivative, groups);
  assert.equal(preview.name, derivative.name);
  assert.equal(preview.metadata.find(([key]) => key === 'Group')[1], 'Line crops');
  assert.equal(preview.metadata.find(([key]) => key === 'Origin')[1], 'page');
  const state = { derivatives: [derivative], derivativeGroups: groups, appliedFilters: cloneFilters() };
  state.appliedFilters.derivative.query = 'Line crops';
  assert.deepEqual(visibleRecordsForType(state, 'derivative'), [derivative]);
  groups[0].name = 'Renamed';
  assert.deepEqual(visibleRecordsForType(state, 'derivative'), []);
  state.appliedFilters.derivative.query = 'Renamed';
  assert.deepEqual(visibleRecordsForType(state, 'derivative'), [derivative]);
  assert.equal(recordIdForType('sample', { id: 'page' }), 'page');
  assert.equal(recordIdForType('asset', { id: 11 }), '11');
  assert.equal(recordIdForType('derivative', derivative), '7');
});

test('ungrouped derivatives remain displayable when no derivative groups exist', () => {
  const derivative = { id: 7, name: 'page_line_1', sample_id: 'page', derivative_group_id: null };
  const preview = normalizeRecordPreview('derivative', derivative, []);
  assert.equal(preview.name, 'page_line_1');
  assert.equal(preview.metadata.find(([key]) => key === 'Group')[1], 'Ungrouped');
});

test('sample membership filters retain qualified related IDs', () => {
  const state = {
    samples: [{ id: 'page', name: 'Page' }, { id: 'other', name: 'Other' }],
    sampleSets: [{ id: 8, name: 'Selected', sample_ids: ['page'] }],
    appliedFilters: cloneFilters(),
  };
  state.appliedFilters.sample.sampleSetId = '8';
  assert.deepEqual(visibleRecordsForType(state, 'sample'), [state.samples[0]]);
});

test('workflow step details join templates and specs by their foreign keys', () => {
  const template = { id: 20, name: 'Prompt', payload: { contents: [] }, resources: [], status: 'active' };
  const spec = { id: 30, name: 'Text', item_schema: { type: 'string' }, status: 'active' };
  const step = { id: 10, name: 'Read', payload_template_id: 20, output_spec_id: 30, step_executor_id: 'gemini', method: 'transcribe', status: 'active' };
  const rows = buildWorkflowSteps({ payloadTemplates: [template], outputSpecs: [spec], workflowSteps: [step] });
  const result = rows['workflow-step'][0];
  assert.equal(result.id, '10');
  assert.equal(result.executor, 'gemini');
  assert.equal(result.payloadTemplate, 'Prompt');
  assert.equal(result.outputSpecification, 'Text');
  assert.equal(result.method, 'transcribe');
  assert.equal(result.status, 'active');
  assert.equal(result.previewText, 'Payload: Prompt • Output: Text');
  assert.equal(JSON.parse(result.detail.sections[0].content).id, 20);
  assert.equal(JSON.parse(result.detail.sections[1].content).id, 30);
  const filters = cloneWorkflowStepFilters();
  filters['workflow-step'].payloadTemplateId = '20';
  filters['workflow-step'].outputSpecId = '30';
  assert.equal(visibleWorkflowStepRows(rows, filters, 'workflow-step').length, 1);
  filters['workflow-step'].payloadTemplateId = '10';
  assert.equal(visibleWorkflowStepRows(rows, filters, 'workflow-step').length, 0);
  assert.deepEqual(JSON.parse(rows['payload-template'][0].detail.sections[0].content), { payload: template.payload, resources: [] });
});

test('workflow form emits canonical local fields and qualified sample-set relation', () => {
  assert.deepEqual(buildWorkflowPayload({ name: ' Read ', description: ' Demo ', sample_set_id: '8' }), {
    name: 'Read', description: 'Demo', sample_set_id: 8, status: 'draft', execution_mode: 'continuous',
  });
});

test('workflow canvas uses a granular grid and reserves each node footprint', () => {
  assert.deepEqual(getCanvasBounds({ nodes: [] }), {
    minRow: -7,
    maxRow: 7,
    minCol: -10,
    maxCol: 10,
    rows: 15,
    cols: 21,
  });
  const nodes = [{ row: 6, col: 12 }];
  assert.equal(getCanvasBounds({ nodes }).rows, 15);
  assert.equal(getCanvasBounds({ nodes }).cols, 21);
  assert.equal(isCanvasPlacementAvailable(nodes, 8, 17), false);
  assert.equal(isCanvasPlacementAvailable(nodes, 9, 12), true);
  assert.equal(isCanvasPlacementAvailable(nodes, 6, 18), true);
});
