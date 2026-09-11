from sqlalchemy import Boolean, Column, DateTime, JSON, String, Table, Text, func, true

from ..schema import metadata

step_executors = Table(
    "step_executors", metadata,
    Column("id", String(64), primary_key=True),
    Column("name", String(255), nullable=False),
    Column("description", Text, nullable=False),
    Column("config_schema", JSON, nullable=False),
    Column("methods", JSON, nullable=False),
    Column("input_schema", JSON, nullable=False),
    Column("output_schema", JSON, nullable=False),
    Column("active", Boolean, nullable=False, server_default=true()),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()),
)
