from __future__ import annotations

import importlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_mock_engine, inspect, select

from backend.api.dependencies import get_engine
from backend.api.main import app
from backend.database.schema import metadata
from backend.database.repositories.derivative_groups_repository import DerivativeGroupsRepository
from backend.database.repositories.prompt_resolution_repository import PromptResolutionRepository
from backend.models.step_outputs import StepOutputRecord
from backend.database.tables.step_outputs_table import step_outputs


class CanonicalContractsTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        environment = patch.dict(os.environ, {
            'DATABASE_URL': str(Path(directory.name) / 'contracts.db'), 'DEV': 'true',
        })
        environment.start()
        self.addCleanup(environment.stop)
        get_engine.cache_clear()
        self.addCleanup(get_engine.cache_clear)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(lambda: self.client.__exit__(None, None, None))
        self.engine = get_engine()
        self.addCleanup(self.engine.dispose)

    def post(self, path, payload):
        response = self.client.post('/api/v2/' + path, json=payload)
        self.assertLess(response.status_code, 300, response.text)
        return response.json()['data']

    def test_every_table_and_fk_uses_canonical_columns(self):
        self.assertEqual(19, len(metadata.tables))
        self.assertIn('payload_templates', metadata.tables)
        self.assertNotIn('payload_template', metadata.tables)
        self.assertFalse(hasattr(importlib.import_module(
            'backend.database.tables.payload_templates_table'), 'payload_template'))
        for table in metadata.tables.values():
            with self.subTest(table=table.name):
                if table.name == 'sample_set_samples':
                    self.assertEqual({'sample_set_id', 'sample_id'}, set(table.primary_key.columns.keys()))
                else:
                    self.assertEqual(['id'], list(table.primary_key.columns.keys()))
                for column in table.c:
                    if column.name.endswith('_id'):
                        self.assertTrue(column.foreign_keys, f'{table.name}.{column.name}')
                for fk in table.foreign_keys:
                    self.assertEqual('id', fk.column.name)
                self.assertEqual(set(table.c.keys()), {c['name'] for c in inspect(self.engine).get_columns(table.name)})
        self.assertEqual(set(step_outputs.c.keys()), set(StepOutputRecord.model_fields))
        ddl = []
        mock_engine = create_mock_engine('postgresql+psycopg://', lambda statement, *a, **k: ddl.append(str(statement.compile(dialect=mock_engine.dialect))))
        metadata.create_all(mock_engine)
        self.assertTrue(any('REFERENCES payload_templates (id)' in statement for statement in ddl))
        self.assertTrue(any('UNIQUE (sample_id, name)' in statement for statement in ddl))

    def test_samples_assets_and_batches_share_local_field_names(self):
        sample = self.post('samples', {'id': 'page', 'name': 'page'})
        self.assertEqual('page', sample['id'])
        self.assertFalse(sample['has_blob'])
        uploaded = self.client.put('/api/v2/samples/page/blob', files={'file': ('page.png', b'image', 'image/png')})
        self.assertEqual({'id': 'page'}, uploaded.json()['data'])
        detail = self.client.get('/api/v2/samples/page').json()['data']
        self.assertEqual('image/png', detail['mime_type'])
        self.assertEqual(5, detail['blob_size'])
        self.assertFalse(any(key.startswith('sample_') for key in detail))
        asset = self.post('assets', {'name': 'instructions', 'type': 'text'})
        response = self.client.put(f"/api/v2/assets/{asset['id']}/blob", files={'file': ('instructions.txt', b'Read', 'text/plain')})
        self.assertEqual({'id': asset['id']}, response.json()['data'])
        assets = self.client.get('/api/v2/assets', params={'name': 'instructions', 'type': 'text'}).json()['items']
        self.assertEqual('instructions', assets[0]['name'])
        self.assertEqual(4, assets[0]['blob_size'])
        response = self.client.request('DELETE', '/api/v2/assets', json={'ids': [asset['id']]})
        self.assertEqual(200, response.status_code, response.text)
        response = self.client.request('DELETE', '/api/v2/samples', json={'ids': ['page']})
        self.assertEqual(200, response.status_code, response.text)

    def test_legacy_fields_are_rejected(self):
        for path, payload in [
            ('samples', {'id': 'a', 'name': 'a', 'sample_id': 'old'}),
            ('assets', {'name': 'a', 'type': 'text', 'asset_name': 'old'}),
            ('sample-sets', {'name': 'a', 'sample_set_name': 'old'}),
            ('payload-templates', {'name': 'a', 'model_family': 'gemini', 'payload': {}, 'payload_template': {}}),
            ('derivative-groups', {'name': 'a', 'derivative_group_name': 'old'}),
            ('derivatives', {'derivatives': [{'name': 'a', 'mime_type': 'image/png', 'originating_sample_id': 'old'}]}),
        ]:
            with self.subTest(path=path):
                response = self.client.post('/api/v2/' + path, json=payload)
                self.assertEqual(422, response.status_code, response.text)

    def test_derivative_group_relation_drives_mapping_and_search(self):
        self.post('samples', {'id': 'page', 'name': 'page'})
        derivative = self.post('derivatives', {'derivatives': [{'name': 'page_line_1.png', 'mime_type': 'image/png'}]})[0]
        group = self.post('derivative-groups', {'name': 'Line crops', 'position_rule': {
            'membership_derivative_field': 'name', 'membership_operator': 'contains',
            'membership_pattern': '_line_', 'sample_mapping_derivative_field': 'name',
            'sample_mapping_sample_field': 'name', 'sample_mapping_operator': 'contains',
        }})
        mapped = self.post('derivatives/map', {'derivatives': [{'id': derivative['id'], 'name': derivative['name']}]})
        self.assertEqual(1, mapped['mapped_count'])
        record = mapped['mapped_derivatives'][0]
        self.assertEqual('page', record['sample_id'])
        self.assertEqual(group['id'], record['derivative_group_id'])
        patched = self.client.patch('/api/v2/derivatives', json={'derivatives': [{
            'id': derivative['id'], 'sample_id': 'page', 'derivative_group_id': group['id'],
        }]})
        self.assertEqual(200, patched.status_code, patched.text)
        DerivativeGroupsRepository(self.engine).update(group['id'], {'name': 'Renamed group'})
        records = self.client.get('/api/v2/derivatives', params={'query': 'Renamed group'}).json()['items']
        self.assertEqual([derivative['id']], [row['id'] for row in records])
        self.assertNotIn('derivative_group_name', records[0])
        self.assertNotIn('derivative_group_name', metadata.tables['derivatives'].c)
        response = self.client.delete(f"/api/v2/derivative-groups/{group['id']}")
        self.assertEqual(200, response.status_code, response.text)
        detail = self.client.get(f"/api/v2/derivatives/{derivative['id']}").json()['data']
        self.assertIsNone(detail['derivative_group_id'])
        self.assertEqual('page', detail['sample_id'])

    def test_group_can_be_created_from_related_derivative_ids(self):
        derivative = self.post('derivatives', {'derivatives': [{'name': 'crop', 'mime_type': 'image/png'}]})[0]
        group = self.post('derivative-groups', {'name': 'Selected crops', 'derivative_ids': [derivative['id']]})
        detail = self.client.get(f"/api/v2/derivatives/{derivative['id']}").json()['data']
        self.assertEqual(group['id'], detail['derivative_group_id'])

    def test_prompt_resource_shape_and_resolution_match_storage(self):
        self.post('samples', {'id': 'page', 'name': 'page'})
        template = self.post('payload-templates', {
            'name': 'Named template', 'model_family': 'gemini', 'payload': {'text': '{{pages.name}}'},
            'resources': [{'name': 'pages', 'source_table': 'samples', 'batch_limit': 1,
                           'conditions': [{'field_name': 'id', 'operator': 'equals',
                                           'value_type': 'sample-field', 'value': 'id'}]}],
        })
        resource = template['resources'][0]
        self.assertEqual(template['id'], resource['payload_template_id'])
        self.assertEqual('pages', resource['name'])
        self.assertEqual(resource['id'], resource['conditions'][0]['prompt_resource_id'])
        self.assertEqual('id', resource['conditions'][0]['field_name'])
        listed = self.client.get('/api/v2/payload-templates').json()['items'][0]
        self.assertEqual(template, listed)
        repository = PromptResolutionRepository(self.engine)
        runtime_resource = repository.list_prompt_resources(template['id'])[0]
        rows = repository.list_prompt_resource_rows(runtime_resource, {'id': 'page'})
        self.assertEqual('page', rows[0]['id'])
        response = self.client.request('DELETE', '/api/v2/payload-templates', json={'ids': [template['id']]})
        self.assertEqual(200, response.status_code, response.text)
        with self.engine.connect() as connection:
            self.assertEqual([], connection.execute(select(metadata.tables['prompt_resources'])).all())
            self.assertEqual([], connection.execute(select(metadata.tables['prompt_resource_conditions'])).all())

    def test_dag_and_workflow_crud_preserve_local_ids_and_related_ids(self):
        self.post('samples', {'id': 'page', 'name': 'Page'})
        sample_set = self.post('sample-sets', {'name': 'Pages', 'sample_ids': ['page']})
        template = self.post('payload-templates', {'name': 'Prompt', 'model_family': 'gemini', 'payload': {}})
        spec = self.post('output-specs', {'name': 'Text', 'type': 'plain-text'})
        step = self.post('workflow-steps', {'name': 'Read', 'step_executor_id': 'gemini',
                         'method': 'transcribe', 'executor_config': {'model': 'test'},
                         'payload_template_id': template['id'], 'output_spec_id': spec['id']})
        workflow = self.post('workflows', {'name': 'Transcribe', 'sample_set_id': sample_set['id']})
        base = f"workflows/{workflow['id']}"
        nodes = [self.post(base + '/workflow-dag-nodes', {
            'workflow_step_id': step['id'], 'row': 1, 'col': col,
        }) for col in (1, 2)]
        edge = self.post(base + '/workflow-dag-edges', {
            'from_workflow_dag_node_id': nodes[0]['id'], 'to_workflow_dag_node_id': nodes[1]['id'],
            'condition': {'type': 'depends_on'},
        })
        self.assertEqual({'type': 'depends_on'}, edge['condition'])
        self.assertEqual(workflow['id'], edge['workflow_id'])
        for suffix, expected in [('/workflow-dag-nodes', nodes), ('/workflow-dag-edges', [edge])]:
            response = self.client.get('/api/v2/' + base + suffix)
            self.assertEqual(expected, response.json()['items'])
        response = self.client.patch('/api/v2/' + base, json={'name': 'Renamed', 'description': 'Demo'})
        self.assertEqual('Renamed', response.json()['data']['name'])
        self.assertEqual(sample_set['id'], response.json()['data']['sample_set_id'])
        response = self.client.request('DELETE', '/api/v2/' + base + '/workflow-dag-edges', json={'id': edge['id']})
        self.assertEqual(200, response.status_code, response.text)
        response = self.client.request('DELETE', '/api/v2/' + base + '/workflow-dag-nodes', json={'ids': [node['id'] for node in nodes]})
        self.assertEqual(200, response.status_code, response.text)
        response = self.client.delete(f"/api/v2/workflow-steps/{step['id']}")
        self.assertEqual(200, response.status_code, response.text)
        response = self.client.request('DELETE', '/api/v2/output-specs', json={'ids': [spec['id']]})
        self.assertEqual(200, response.status_code, response.text)

    def test_job_event_subscription_matches_canonical_job_id(self):
        import asyncio
        from unittest.mock import AsyncMock
        from backend.services.job_events import JobEventHub
        async def run():
            hub = JobEventHub()
            matching, other = AsyncMock(), AsyncMock()
            await hub.connect(matching, workflow_id=12, execution_job_id=34)
            await hub.connect(other, workflow_id=12, execution_job_id=35)
            event = {'event': 'COMPLETED', 'rows': [{'id': 34, 'workflow_id': 12}]}
            await hub.broadcast(event)
            matching.send_json.assert_awaited_once_with(event)
            other.send_json.assert_not_awaited()
        asyncio.run(run())
