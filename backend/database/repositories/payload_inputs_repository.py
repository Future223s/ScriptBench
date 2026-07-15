from __future__ import annotations

from sqlalchemy import insert
from sqlalchemy.engine import Engine

from ..tables.payload_inputs_table import payload_inputs


class PayloadInputsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        with self.engine.begin() as conn:
            conn.execute(insert(payload_inputs).values(**row))
