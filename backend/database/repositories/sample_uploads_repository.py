from __future__ import annotations

from sqlalchemy.engine import Engine


class SampleUploadsRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def insert(self, row: dict[str, object]) -> None:
        raise NotImplementedError("No backing table is defined for this repository.")
