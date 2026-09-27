from __future__ import annotations

import argparse

from backend.api.dependencies import get_engine
from backend.database.repositories.bootstrap_repository import BootstrapRepository
from backend.scripts.bootstrapping.manuscripts import _upsert_transcription_smoke_test
from sqlalchemy.engine import Engine


EXECUTOR_CONFIGS = {
    "gemini": {"model": "gemini-3.1-flash-lite", "temperature": 0.0},
    "anthropic": {"model": "claude-sonnet-4-6", "max_tokens": 4096},
}


def bootstrap_workflow(engine: Engine, executor: str) -> tuple[int, int]:
    """Idempotently create one executor-specific transcription demo workflow."""
    config = EXECUTOR_CONFIGS.get(executor)
    if config is None:
        supported = ", ".join(sorted(EXECUTOR_CONFIGS))
        raise ValueError(f"Unsupported executor '{executor}'. Supported executors: {supported}")

    from backend.services.step_executor_catalog import seed_step_executors

    repository = BootstrapRepository(engine)
    with repository.transaction() as connection:
        seed_step_executors(connection)
        sample_set_id = repository.fetch_sample_set_id("test", conn=connection)
        if sample_set_id is None:
            raise ValueError(
                "The demo sample set is missing. Run manuscripts bootstrap first."
            )
        sample_ids = repository.list_sample_ids(sample_set_id, conn=connection)
        if not sample_ids:
            raise ValueError(
                "The demo sample set is empty. Run manuscripts bootstrap first."
            )
        return _upsert_transcription_smoke_test(
            repository,
            connection,
            sample_ids,
            executor=executor,
            config=config,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap one executor-specific transcription demo workflow."
    )
    parser.add_argument("--executor", choices=sorted(EXECUTOR_CONFIGS), required=True)
    args = parser.parse_args()
    sample_set_id, workflow_id = bootstrap_workflow(get_engine(), args.executor)
    print(
        f"Bootstrapped {args.executor} workflow "
        f"(sample_set_id={sample_set_id}, workflow_id={workflow_id})."
    )


if __name__ == "__main__":
    main()
