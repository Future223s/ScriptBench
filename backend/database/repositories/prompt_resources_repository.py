from __future__ import annotations

from sqlalchemy import insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.prompt_resource_conditions_table import prompt_resource_conditions
from ..tables.prompt_resources_table import prompt_resources


class PromptResourcesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection) -> int:
        return int(
            conn.execute(
                insert(prompt_resources)
                .values(**row)
                .returning(prompt_resources.c.prompt_resource_id)
            ).scalar_one()
        )

    def insert_condition(self, row: dict[str, object], conn: Connection) -> int:
        return int(
            conn.execute(
                insert(prompt_resource_conditions)
                .values(**row)
                .returning(prompt_resource_conditions.c.prompt_resource_condition_id)
            ).scalar_one()
        )

    def list_for_template(
        self, payload_template_id: int, conn: Connection | None = None
    ) -> list[dict[str, object]]:
        def run(connection: Connection) -> list[dict[str, object]]:
            resources = (
                connection.execute(
                    select(prompt_resources)
                    .where(
                        prompt_resources.c.payload_template_id == payload_template_id
                    )
                    .order_by(prompt_resources.c.prompt_resource_id.asc())
                )
                .mappings()
                .all()
            )
            conditions = (
                connection.execute(
                    select(prompt_resource_conditions)
                    .join(prompt_resources)
                    .where(
                        prompt_resources.c.payload_template_id == payload_template_id
                    )
                    .order_by(
                        prompt_resource_conditions.c.prompt_resource_id.asc(),
                        prompt_resource_conditions.c.position.asc(),
                    )
                )
                .mappings()
                .all()
            )
            by_resource: dict[int, list[dict[str, object]]] = {}
            for condition in conditions:
                by_resource.setdefault(int(condition["prompt_resource_id"]), []).append(
                    dict(condition)
                )
            return [
                {
                    **dict(resource),
                    "conditions": by_resource.get(
                        int(resource["prompt_resource_id"]), []
                    ),
                }
                for resource in resources
            ]

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)
