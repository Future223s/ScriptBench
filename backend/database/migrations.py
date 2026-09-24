from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config


def upgrade_database(database_url: str | None = None) -> None:
    """Apply committed migrations; used by tests and explicit setup commands."""
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    value = database_url or os.getenv("DATABASE_URL")
    if value:
        if "://" not in value:
            value = f"sqlite:///{Path(value).as_posix()}"
        config.set_main_option("sqlalchemy.url", value)
    command.upgrade(config, "head")
