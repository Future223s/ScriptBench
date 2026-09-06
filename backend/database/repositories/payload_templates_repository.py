from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection
from sqlalchemy.engine import Engine

from ..tables.payload_templates_table import payload_templates
from ..tables.workflow_steps_table import workflow_steps
from .prompt_resources_repository import PromptResourcesRepository


class PayloadTemplatesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection | None = None) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(payload_templates)
                    .values(**row)
                    .returning(payload_templates.c.payload_template_id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def fetch(self, payload_template_id: int, conn: Connection | None = None):
        def run(connection: Connection):
            return (
                connection.execute(
                    select(payload_templates).where(
                        payload_templates.c.payload_template_id == payload_template_id
                    )
                )
                .mappings()
                .first()
            )

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)

    def list(self) -> list:
        with self.engine.connect() as connection:
            templates = list(
                connection.execute(
                    select(payload_templates).order_by(
                        payload_templates.c.payload_template_name
                    )
                )
                .mappings()
                .all()
            )
        resources_by_template = {
            int(template["payload_template_id"]): PromptResourcesRepository(
                self.engine
            ).list_for_template(int(template["payload_template_id"]))
            for template in templates
        }
        return [
            {
                **dict(template),
                "resources": resources_by_template.get(
                    int(template["payload_template_id"]), []
                ),
            }
            for template in templates
        ]

    def list_referencing_workflow_step_ids(
        self, payload_template_ids: list[int], conn: Connection | None = None
    ) -> list[int]:
        statement = select(workflow_steps.c.workflow_step_id).where(
            workflow_steps.c.payload_template_id.in_(payload_template_ids)
        )

        def run(connection: Connection) -> list[int]:
            return [
                int(value) for value in connection.execute(statement).scalars().all()
            ]

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)

    def delete_many(
        self, payload_template_ids: list[int], conn: Connection | None = None
    ) -> int:
        statement = delete(payload_templates).where(
            payload_templates.c.payload_template_id.in_(payload_template_ids)
        )

        def run(connection: Connection) -> int:
            return int(connection.execute(statement).rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
