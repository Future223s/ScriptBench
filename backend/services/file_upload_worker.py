from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.engine import Engine

from backend.database.repositories.artifacts_repository import ArtifactsRepository
from backend.database.repositories.assets_repository import AssetsRepository
from backend.database.repositories.samples_repository import SamplesRepository
from backend.services.upload_events import FileUploadEventHub

logger = logging.getLogger(__name__)

UploadTask = dict[str, Any]


class FileUploadWorker:
    def __init__(
        self,
        *,
        engine: Engine,
        event_hub: FileUploadEventHub | None,
    ) -> None:
        self.engine = engine
        self.event_hub = event_hub
        self._queue: asyncio.Queue[UploadTask] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._run(), name="file-upload-worker")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    def enqueue(self, task: UploadTask) -> str:
        upload_batch_id = str(task.get("upload_batch_id") or uuid4())
        task["upload_batch_id"] = upload_batch_id
        self._queue.put_nowait(task)
        self._publish(
            {
                "event": "file_upload.queued",
                "message": f"Queued {len(task.get('items', []))} {task.get('upload_type', 'file')} upload(s).",
                "upload_batch_id": upload_batch_id,
                "upload_type": task.get("upload_type"),
                "queued_files": len(task.get("items", [])),
            }
        )
        return upload_batch_id

    def _publish(self, payload: dict[str, Any]) -> None:
        if self.event_hub is None:
            return
        self.event_hub.broadcast_threadsafe(payload)

    async def _run(self) -> None:
        while True:
            task = await self._queue.get()
            try:
                await self._process_task(task)
            except Exception:
                logger.exception("Unexpected failure while processing file upload task")
            finally:
                self._queue.task_done()

    async def _process_task(self, task: UploadTask) -> None:
        upload_type = str(task["upload_type"])
        items = list(task.get("items", []))
        batch_id = str(task["upload_batch_id"])
        processed = 0
        failed = 0

        for item in items:
            try:
                if upload_type == "sample":
                    await asyncio.to_thread(self._persist_sample, item)
                elif upload_type == "asset":
                    await asyncio.to_thread(self._persist_asset, item)
                else:
                    await asyncio.to_thread(self._persist_artifact, item)
                processed += 1
                self._publish(
                    {
                        "event": "file_upload.file_uploaded",
                        "message": f"Uploaded {item.get('display_name') or item.get('artifact_name') or item.get('sample_name') or item.get('asset_name')}.",
                        "upload_batch_id": batch_id,
                        "upload_type": upload_type,
                        "processed_files": processed,
                        "failed_files": failed,
                        "total_files": len(items),
                        "item": item.get("event_payload") or item,
                    }
                )
            except Exception as exc:
                failed += 1
                self._publish(
                    {
                        "event": "file_upload.file_failed",
                        "message": str(exc),
                        "upload_batch_id": batch_id,
                        "upload_type": upload_type,
                        "processed_files": processed,
                        "failed_files": failed,
                        "total_files": len(items),
                        "item": item.get("event_payload") or item,
                    }
                )

        self._publish(
            {
                "event": "file_upload.batch_completed",
                "message": f"Finished {upload_type} upload batch.",
                "upload_batch_id": batch_id,
                "upload_type": upload_type,
                "processed_files": processed,
                "failed_files": failed,
                "total_files": len(items),
            }
        )

    def _persist_sample(self, item: dict[str, Any]) -> None:
        repo = SamplesRepository(self.engine)
        sample_id = str(item["sample_id"])
        sample_name = str(item["sample_name"])
        if repo.fetch_sample(sample_id) is not None:
            raise ValueError(f"Sample already exists: {sample_id}")
        if repo.fetch_samples_by_names([sample_name]):
            raise ValueError(f"Sample name already exists: {sample_name}")
        repo.insert_sample_metadata(
            sample_id=sample_id,
            sample_name=sample_name,
            ground_truth_text=item.get("ground_truth_text"),
        )
        updated = repo.update_sample_blob(
            sample_id=sample_id,
            sample_blob=item["sample_blob"],
            sample_mime_type=item.get("sample_mime_type"),
        )
        if updated != 1:
            raise ValueError(f"Failed to persist sample blob: {sample_id}")

    def _persist_asset(self, item: dict[str, Any]) -> None:
        repo = AssetsRepository(self.engine)
        asset_name = str(item["asset_name"])
        if repo.fetch_assets_by_names([asset_name]):
            raise ValueError(f"Asset name already exists: {asset_name}")
        now = datetime.now(timezone.utc)
        repo.insert_assets(
            [
                {
                    "asset_name": asset_name,
                    "asset_type": item["asset_type"],
                    "asset_blob": item["asset_blob"],
                    "asset_mime_type": item.get("asset_mime_type"),
                    "created_at": now,
                    "updated_at": now,
                }
            ]
        )

    def _persist_artifact(self, item: dict[str, Any]) -> None:
        artifacts_repository = ArtifactsRepository(self.engine)
        artifact_id = int(item["artifact_id"])
        artifact_row = artifacts_repository.fetch_artifact(artifact_id)
        if artifact_row is None:
            raise ValueError(f"Artifact not found: {artifact_id}")

        updated = artifacts_repository.update_artifact_blob(
            artifact_id=artifact_id,
            artifact_blob=item["artifact_blob"],
            artifact_mime_type=item.get("artifact_mime_type"),
        )
        if updated != 1:
            raise ValueError(f"Failed to persist artifact blob: {artifact_id}")
