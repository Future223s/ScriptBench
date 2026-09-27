from sqlalchemy import func, insert, select, update
from sqlalchemy.engine import Connection
from ..tables.step_executors_table import step_executors


class StepExecutorsRepository:
    def __init__(self, engine):
        self.engine = engine

    def list(self):
        with self.engine.connect() as connection:
            return connection.execute(select(
                step_executors.c.id, step_executors.c.name, step_executors.c.description,
            ).where(step_executors.c.active.is_(True)).order_by(step_executors.c.name)).mappings().all()

    def fetch(self, executor_id):
        with self.engine.connect() as connection:
            return connection.execute(select(step_executors).where(
                step_executors.c.id == executor_id
            )).mappings().first()

    def upsert(
        self, executor_id: str, values: dict[str, object], *, conn: Connection
    ) -> None:
        existing = conn.execute(
            select(step_executors.c.id).where(step_executors.c.id == executor_id)
        ).first()
        if existing:
            conn.execute(
                update(step_executors)
                .where(step_executors.c.id == executor_id)
                .values(**values, updated_at=func.current_timestamp())
            )
        else:
            conn.execute(
                insert(step_executors).values(id=executor_id, **values)
            )
