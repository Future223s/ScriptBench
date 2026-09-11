from __future__ import annotations

import argparse

from backend.api.dependencies import get_engine
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

    from sqlalchemy import select
    from backend.database.tables.sample_set_samples_table import sample_set_samples
    from backend.database.tables.sample_sets_table import sample_sets
    from backend.services.step_executor_catalog import seed_step_executors

    with engine.begin() as connection:
        seed_step_executors(connection)
        sample_set_id = connection.execute(
            select(sample_sets.c.id).where(sample_sets.c.name == "test")
        ).scalar_one_or_none()
        if sample_set_id is None:
            raise ValueError(
                "The demo sample set is missing. Run manuscripts bootstrap first."
            )
        sample_ids = [
            str(value)
            for value in connection.execute(
                select(sample_set_samples.c.sample_id)
                .where(sample_set_samples.c.sample_set_id == sample_set_id)
                .order_by(sample_set_samples.c.position)
            ).scalars().all()
        ]
        if not sample_ids:
            raise ValueError(
                "The demo sample set is empty. Run manuscripts bootstrap first."
            )
        return _upsert_transcription_smoke_test(
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
