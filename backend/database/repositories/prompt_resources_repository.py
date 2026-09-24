from __future__ import annotations

from sqlalchemy import insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.prompt_resources_table import prompt_resources
from ..tables.assets_table import assets
from ..tables.documents_table import documents
from ..tables.derivatives_table import derivatives
from ..tables.samples_table import samples
from ..tables.step_outputs_table import step_outputs


class PromptResourcesRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object], conn: Connection) -> int:
        return int(
            conn.execute(
                insert(prompt_resources)
                .values(**row)
                .returning(prompt_resources.c.id)
            ).scalar_one()
        )

    def source_row_exists(self, source_table: str, row_id: str) -> bool:
        tables = {
            "assets": assets,
            "documents": documents,
            "derivatives": derivatives,
            "samples": samples,
            "step_outputs": step_outputs,
        }
        table = tables[source_table]
        try:
            typed_row_id = table.c.id.type.python_type(str(row_id).strip())
        except (TypeError, ValueError) as error:
            raise ValueError("Selected content row is invalid") from error
        with self.engine.connect() as connection:
            value = connection.execute(
                select(table.c.id).where(table.c.id == typed_row_id)
            ).scalar_one_or_none()
        return value is not None

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
                    .order_by(prompt_resources.c.id.asc())
                )
                .mappings()
                .all()
            )
            return [
                {
                    "id": resource["id"],
                    "payload_template_id": resource["payload_template_id"],
                    "name": resource["name"],
                    "type": resource["type"],
                    "source_table": resource["source_table"],
                    "row_id": resource["row_key"],
                    "created_at": resource["created_at"],
                }
                for resource in resources
            ]

        if conn is not None:
            return run(conn)
        with self.engine.connect() as connection:
            return run(connection)
