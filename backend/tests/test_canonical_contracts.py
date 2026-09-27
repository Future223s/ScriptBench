from __future__ import annotations

import base64
import importlib
from io import BytesIO
import os
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_mock_engine, inspect, select

from backend.api.dependencies import get_engine
from backend.api.main import app
from backend.database.schema import metadata
from backend.database.migrations import upgrade_database
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
        upgrade_database(os.environ["DATABASE_URL"])
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
        self.assertEqual(23, len(metadata.tables))
        self.assertNotIn('sample_mapping', metadata.tables)
        self.assertIn('payload_templates', metadata.tables)
        self.assertNotIn('payload_template', metadata.tables)
        self.assertFalse(hasattr(importlib.import_module(
            'backend.database.tables.payload_templates_table'), 'payload_template'))
        for table in metadata.tables.values():
            with self.subTest(table=table.name):
                if table.name == 'sample_set_samples':
                    self.assertEqual({'sample_set_id', 'sample_id'}, set(table.primary_key.columns.keys()))
                elif table.name == 'execution_job_dependencies':
                    self.assertEqual({'execution_job_id', 'depends_on_execution_job_id'}, set(table.primary_key.columns.keys()))
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
        sample = self.post('samples', {'id': 'page', 'name': '_page'})
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

    def test_file_names_automatically_create_document_hierarchy(self):
        second = self.post('samples', {'id': 'legacy-2', 'name': 'EMMO-La115_2v'})
        first = self.post('samples', {'id': 'legacy-1', 'name': 'EMMO-La115_1r'})
        self.assertEqual('EMMO-La115', first['document_id'])
        self.assertEqual('EMMO-La115', second['document_id'])

        document = self.client.get('/api/v2/documents/EMMO-La115').json()['data']
        self.assertEqual(['legacy-1', 'legacy-2'], document['sample_ids'])
        self.assertEqual(['EMMO-La115_1r', 'EMMO-La115_2v'], document['sample_names'])
        self.assertFalse(document['has_blob'])

        uploaded = self.client.put(
            '/api/v2/documents/EMMO-La115/blob',
            files={'file': ('EMMO-La115.pdf', b'%PDF-1.4\n%%EOF', 'application/pdf')},
        )
        self.assertEqual(200, uploaded.status_code, uploaded.text)
        document = self.client.get('/api/v2/documents/EMMO-La115').json()['data']
        self.assertTrue(document['has_blob'])
        self.assertEqual('application/pdf', document['mime_type'])

        documentless = self.post('samples', {'id': 'solo', 'name': '_1r'})
        self.assertIsNone(documentless['document_id'])
        invalid = self.client.post('/api/v2/samples', json={'id': 'bad', 'name': 'page'})
        self.assertEqual(400, invalid.status_code, invalid.text)

    def test_document_pdf_can_be_assembled_from_ordered_sample_images(self):
        for sample_id, name, color in [
            ('page-2', 'book_2', 'blue'),
            ('page-1', 'book_1', 'red'),
        ]:
            self.post('samples', {'id': sample_id, 'name': name})
            image_bytes = BytesIO()
            Image.new('RGB', (8, 8), color=color).save(image_bytes, format='PNG')
            response = self.client.put(
                f'/api/v2/samples/{sample_id}/blob',
                files={'file': (f'{name}.png', image_bytes.getvalue(), 'image/png')},
            )
            self.assertEqual(200, response.status_code, response.text)

        response = self.client.post('/api/v2/documents/book/assemble')
        self.assertEqual(200, response.status_code, response.text)
        document = self.client.get('/api/v2/documents/book').json()['data']
        self.assertEqual(['page-1', 'page-2'], document['sample_ids'])
        self.assertEqual('assembled', document['metadata']['pdf_source'])
        self.assertTrue(base64.b64decode(document['blob_base64']).startswith(b'%PDF-'))

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
        self.post('samples', {'id': 'page', 'name': '_page'})
        group = self.post('derivative-groups', {'name': 'Line crops', 'position_rule': {
            'membership_derivative_field': 'name', 'membership_operator': 'contains',
            'membership_pattern': '_line_',
        }})
        record = self.post('derivatives', {'derivatives': [{'name': '_page_line_1.png', 'mime_type': 'image/png'}]})[0]
        self.assertEqual('page', record['sample_id'])
        self.assertEqual(group['id'], record['derivative_group_id'])
        DerivativeGroupsRepository(self.engine).update(group['id'], {'name': 'Renamed group'})
        records = self.client.get('/api/v2/derivatives', params={'query': 'Renamed group'}).json()['items']
        self.assertEqual([record['id']], [row['id'] for row in records])
        self.assertNotIn('derivative_group_name', records[0])
        self.assertNotIn('derivative_group_name', metadata.tables['derivatives'].c)
        response = self.client.delete(f"/api/v2/derivative-groups/{group['id']}")
        self.assertEqual(200, response.status_code, response.text)
        detail = self.client.get(f"/api/v2/derivatives/{record['id']}").json()['data']
        self.assertIsNone(detail['derivative_group_id'])
        self.assertEqual('page', detail['sample_id'])

    def test_prompt_resource_shape_and_resolution_match_storage(self):
        self.post('samples', {'id': 'page', 'name': '_page'})
        template = self.post('payload-templates', {
            'name': 'Named template', 'model_family': 'gemini', 'payload': {'text': '{{pages.name}}'},
            'resources': [{'name': 'pages', 'type': 'content',
                           'source_table': 'samples', 'row_id': 'page'}],
        })
        resource = template['resources'][0]
        self.assertEqual(template['id'], resource['payload_template_id'])
        self.assertEqual('pages', resource['name'])
        self.assertEqual('content', resource['type'])
        self.assertEqual('page', resource['row_id'])
        listed = self.client.get('/api/v2/payload-templates').json()['items'][0]
        self.assertEqual(template, listed)
        repository = PromptResolutionRepository(self.engine)
        runtime_resource = repository.list_prompt_resources(template['id'])[0]
        rows = repository.list_prompt_resource_rows(runtime_resource, {})
        self.assertEqual('page', rows[0]['id'])
        self.assertEqual('_page', rows[0]['name'])
        response = self.client.request('DELETE', '/api/v2/payload-templates', json={'ids': [template['id']]})
        self.assertEqual(200, response.status_code, response.text)
        with self.engine.connect() as connection:
            self.assertEqual([], connection.execute(select(metadata.tables['prompt_resources'])).all())
            self.assertEqual([], connection.execute(select(metadata.tables['prompt_resource_conditions'])).all())

    def test_payload_resources_distinguish_content_and_bindings(self):
        asset = self.post('assets', {'name': 'Instructions', 'type': 'text/plain'})
        template = self.post('payload-templates', {
            'name': 'Bound template', 'model_family': 'gemini', 'payload': {},
            'resources': [{
                'name': 'crops', 'type': 'binding',
                'source_table': 'derivatives',
            }, {
                'name': 'prior', 'type': 'binding',
                'source_table': 'step_outputs',
            }, {
                'name': 'instructions', 'type': 'content',
                'source_table': 'assets', 'row_id': str(asset['id']),
            }],
        })
        resources = {item['name']: item for item in template['resources']}
        self.assertEqual('binding', resources['crops']['type'])
        self.assertIsNone(resources['prior']['row_id'])
        self.assertEqual('content', resources['instructions']['type'])
        self.assertEqual(str(asset['id']), resources['instructions']['row_id'])
        resource = next(item for item in PromptResolutionRepository(self.engine).list_prompt_resources(template['id'])
                        if item['name'] == 'instructions')
        self.assertEqual([asset['id']], [row['id'] for row in PromptResolutionRepository(self.engine).list_prompt_resource_rows(resource, {})])

    def test_payload_template_rejects_unknown_prompt_resource_reference(self):
        response = self.client.post('/api/v2/payload-templates', json={
            'name': 'Invalid reference', 'model_family': 'gemini',
            'payload': {'contents': [{'parts': [{'text': '{{missing.text}}'}]}]},
            'resources': [],
        })
        self.assertEqual(400, response.status_code, response.text)
        self.assertIn('unknown prompt resource', response.json()['detail'])

    def test_dag_and_workflow_crud_preserve_local_ids_and_related_ids(self):
        self.post('samples', {'id': 'page', 'name': '_page'})
        sample_set = self.post('sample-sets', {'name': 'Pages', 'sample_ids': ['page']})
        template = self.post('payload-templates', {'name': 'Prompt', 'model_family': 'gemini', 'payload': {}})
        spec = self.post('output-specs', {'name': 'Text', 'item_schema': {'type': 'string'}})
        step = self.post('workflow-steps', {'name': 'Read', 'step_executor_id': 'gemini',
                         'method': 'transcribe', 'executor_config': {'model': 'test'},
                         'payload_template_id': template['id'], 'output_spec_id': spec['id']})
        workflow = self.post('workflows', {'name': 'Transcribe', 'sample_set_id': sample_set['id']})
        base = f"workflows/{workflow['id']}"
        nodes = [self.post(base + '/workflow-dag-nodes', {
            'workflow_step_id': step['id'], 'row': 1, 'col': col,
        }) for col in (1, 7)]
        overlap = self.client.post('/api/v2/' + base + '/workflow-dag-nodes', json={
            'workflow_step_id': step['id'], 'row': 2, 'col': 4,
        })
        self.assertEqual(409, overlap.status_code, overlap.text)
        self.assertIn('overlaps', overlap.json()['detail'])
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

    def test_workflow_finalization_validates_dag_and_step_output_dependencies(self):
        self.post('samples', {'id': 'page', 'name': '_page'})
        sample_set = self.post('sample-sets', {'name': 'Pages', 'sample_ids': ['page']})
        specification = self.post('output-specs', {'name': 'Text', 'item_schema': {'type': 'string'}})
        source_template = self.post('payload-templates', {
            'name': 'Source prompt', 'model_family': 'gemini', 'payload': {},
        })
        source_step = self.post('workflow-steps', {
            'name': 'Transcribe', 'step_executor_id': 'gemini', 'method': 'transcribe',
            'executor_config': {'model': 'test'},
            'payload_template_id': source_template['id'], 'output_spec_id': specification['id'],
        })
        dependent_template = self.post('payload-templates', {
            'name': 'Review prompt', 'model_family': 'gemini', 'payload': {},
            'resources': [{
                'name': 'step_output', 'type': 'binding',
                'source_table': 'step_outputs',
            }],
        })
        dependent_step = self.post('workflow-steps', {
            'name': 'Review', 'step_executor_id': 'gemini', 'method': 'transcribe',
            'executor_config': {'model': 'test'},
            'payload_template_id': dependent_template['id'], 'output_spec_id': specification['id'],
        })

        valid = self.post('workflows', {'name': 'Valid chain', 'sample_set_id': sample_set['id']})
        valid_base = f"workflows/{valid['id']}"
        source_node = self.post(valid_base + '/workflow-dag-nodes', {
            'workflow_step_id': source_step['id'], 'row': 1, 'col': 1,
        })
        dependent_node = self.post(valid_base + '/workflow-dag-nodes', {
            'workflow_step_id': dependent_step['id'], 'row': 1, 'col': 7,
        })
        self.post(valid_base + '/workflow-dag-edges', {
            'from_workflow_dag_node_id': source_node['id'],
            'to_workflow_dag_node_id': dependent_node['id'],
        })
        response = self.client.patch('/api/v2/' + valid_base + '/finalize')
        self.assertEqual(200, response.status_code, response.text)
        runtime_resource = PromptResolutionRepository(self.engine).list_prompt_resources(
            dependent_template['id']
        )[0]
        self.assertEqual(
            [],
            PromptResolutionRepository(self.engine).list_prompt_resource_rows(
                runtime_resource,
                {'id': 'page'},
                execution_job_id=next(
                    row['id']
                    for row in self.client.get(
                        f'/api/v2/workflows/{valid["id"]}/execution-jobs'
                    ).json()['items']
                    if row['workflow_dag_node_id'] == dependent_node['id']
                ),
                workflow_id=valid['id'],
            ),
        )

        invalid = self.post('workflows', {'name': 'Invalid chain', 'sample_set_id': sample_set['id']})
        invalid_base = f"workflows/{invalid['id']}"
        dependent_node = self.post(invalid_base + '/workflow-dag-nodes', {
            'workflow_step_id': dependent_step['id'], 'row': 1, 'col': 1,
        })
        source_node = self.post(invalid_base + '/workflow-dag-nodes', {
            'workflow_step_id': source_step['id'], 'row': 1, 'col': 7,
        })
        self.post(invalid_base + '/workflow-dag-edges', {
            'from_workflow_dag_node_id': dependent_node['id'],
            'to_workflow_dag_node_id': source_node['id'],
        })
        response = self.client.patch('/api/v2/' + invalid_base + '/finalize')
        self.assertEqual(409, response.status_code, response.text)
        self.assertIn('incoming workflow edge', response.json()['detail'])

        cyclic = self.post('workflows', {'name': 'Cycle', 'sample_set_id': sample_set['id']})
        cyclic_base = f"workflows/{cyclic['id']}"
        first_node = self.post(cyclic_base + '/workflow-dag-nodes', {
            'workflow_step_id': source_step['id'], 'row': 1, 'col': 1,
        })
        second_node = self.post(cyclic_base + '/workflow-dag-nodes', {
            'workflow_step_id': source_step['id'], 'row': 1, 'col': 7,
        })
        self.post(cyclic_base + '/workflow-dag-edges', {
            'from_workflow_dag_node_id': first_node['id'],
            'to_workflow_dag_node_id': second_node['id'],
        })
        with self.engine.begin() as connection:
            connection.execute(metadata.tables['workflow_dag_edges'].insert().values(
                workflow_id=cyclic['id'],
                from_workflow_dag_node_id=second_node['id'],
                to_workflow_dag_node_id=first_node['id'],
                condition={'type': 'depends_on'},
            ))
        response = self.client.patch('/api/v2/' + cyclic_base, json={'name': 'Cycle renamed'})
        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual('Cycle', self.client.get('/api/v2/' + cyclic_base).json()['data']['name'])
        response = self.client.patch('/api/v2/' + cyclic_base + '/finalize')
        self.assertEqual(409, response.status_code, response.text)
        self.assertIn('contains a cycle', response.json()['detail'])

    def test_sample_set_analytics_uses_only_terminal_dag_step_outputs(self):
        self.post('samples', {'id': 'page-1', 'name': '_page-1'})
        self.post('samples', {'id': 'page-2', 'name': '_page-2'})
        self.post('samples', {'id': 'page-3', 'name': '_page-3'})
        sample_set = self.post('sample-sets', {
            'name': 'Analytics pages',
            'sample_ids': ['page-1', 'page-2', 'page-3'],
        })
        template = self.post('payload-templates', {
            'name': 'Analytics prompt', 'model_family': 'gemini', 'payload': {},
        })
        output_spec = self.post('output-specs', {
            'name': 'Analytics text', 'item_schema': {'type': 'string'},
        })
        source_step = self.post('workflow-steps', {
            'name': 'Analytics source', 'step_executor_id': 'gemini',
            'method': 'transcribe', 'executor_config': {'model': 'test'},
            'payload_template_id': template['id'], 'output_spec_id': output_spec['id'],
        })
        final_step = self.post('workflow-steps', {
            'name': 'Analytics final', 'step_executor_id': 'gemini',
            'method': 'transcribe', 'executor_config': {'model': 'test'},
            'payload_template_id': template['id'], 'output_spec_id': output_spec['id'],
        })
        workflow = self.post('workflows', {
            'name': 'Analytics workflow', 'sample_set_id': sample_set['id'],
        })
        base = f"workflows/{workflow['id']}"
        source_node = self.post(base + '/workflow-dag-nodes', {
            'workflow_step_id': source_step['id'], 'row': 1, 'col': 1,
        })
        final_node = self.post(base + '/workflow-dag-nodes', {
            'workflow_step_id': final_step['id'], 'row': 1, 'col': 7,
        })
        self.post(base + '/workflow-dag-edges', {
            'from_workflow_dag_node_id': source_node['id'],
            'to_workflow_dag_node_id': final_node['id'],
        })

        now = datetime.now(timezone.utc)
        with self.engine.begin() as connection:
            job_ids = []
            for sample_id in ('page-1', 'page-2', 'page-3'):
                result = connection.execute(
                    metadata.tables['execution_jobs'].insert().values(
                        workflow_id=workflow['id'], sample_id=sample_id,
                        current_workflow_dag_node_id=final_node['id'],
                        status='completed',
                    )
                )
                job_ids.append(result.inserted_primary_key[0])
            output_rows = []
            raw_table = metadata.tables['raw_outputs']
            for job_id, sample_id, source_cer, final_cer in (
                (job_ids[0], 'page-1', 0.90, 0.10),
                (job_ids[1], 'page-2', 0.80, 0.20),
            ):
                for attempt_no, (step, text, metric) in enumerate((
                    (source_step, 'source', source_cer),
                    (final_step, 'final', final_cer),
                ), start=1):
                    raw_id = connection.execute(raw_table.insert().values(
                        execution_job_id=job_id, workflow_id=workflow['id'],
                        workflow_step_id=step['id'], attempt_no=attempt_no,
                        assembled_model_payload={}, raw_model_response=text,
                        parsed_output=text, complete_output=text,
                        parse_status='success', time_elapsed=0.0,
                        started_at=now, completed_at=now,
                    )).inserted_primary_key[0]
                    output_rows.append({
                        'raw_output_id': raw_id, 'execution_job_id': job_id,
                        'workflow_id': workflow['id'], 'workflow_step_id': step['id'],
                        'sample_id': sample_id, 'output_scope': 'samples',
                        'entity_type': 'sample', 'entity_key': sample_id,
                        'output': text, 'cer': metric, 'wer': metric,
                    })
            connection.execute(metadata.tables['step_outputs'].insert(), output_rows)

        response = self.client.get(
            f"/api/v2/sample-sets/{sample_set['id']}/analytics"
        )
        self.assertEqual(200, response.status_code, response.text)
        analytics = response.json()['data']['analytics_by_workflow'][str(workflow['id'])]
        self.assertEqual(2, analytics['completed_sample_count'])
        self.assertEqual(0.10, analytics['metrics']['cer']['min'])
        self.assertEqual(0.20, analytics['metrics']['cer']['max'])
        self.assertEqual(0.10, analytics['metrics']['wer']['min'])
        self.assertEqual(0.20, analytics['metrics']['wer']['max'])

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
