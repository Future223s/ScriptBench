from __future__ import annotations

from sqlalchemy import delete, insert, select
from sqlalchemy.engine import Connection, Engine

from ..tables.workflow_dag_edges_table import workflow_dag_edges
from ..tables.workflow_dag_nodes_table import workflow_dag_nodes


class WorkflowDagRepository:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def list_nodes(self, workflow_id: int) -> list[dict[str, object]]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(workflow_dag_nodes)
                    .where(workflow_dag_nodes.c.workflow_id == workflow_id)
                    .order_by(
                        workflow_dag_nodes.c.row.asc(),
                        workflow_dag_nodes.c.col.asc(),
                        workflow_dag_nodes.c.workflow_dag_node_id.asc(),
                    )
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def fetch_first_node(self, workflow_id: int) -> dict[str, object] | None:
        with self.engine.connect() as connection:
            row = (
                connection.execute(
                    select(workflow_dag_nodes)
                    .where(workflow_dag_nodes.c.workflow_id == workflow_id)
                    .order_by(
                        workflow_dag_nodes.c.row.asc(),
                        workflow_dag_nodes.c.col.asc(),
                        workflow_dag_nodes.c.workflow_dag_node_id.asc(),
                    )
                    .limit(1)
                )
                .mappings()
                .first()
            )
        return dict(row) if row is not None else None

    def fetch_node(self, workflow_dag_node_id: int) -> dict[str, object] | None:
        with self.engine.connect() as connection:
            row = (
                connection.execute(
                    select(workflow_dag_nodes).where(
                        workflow_dag_nodes.c.workflow_dag_node_id
                        == workflow_dag_node_id
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row is not None else None

    def insert_node(
        self, row: dict[str, object], conn: Connection | None = None
    ) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(workflow_dag_nodes)
                    .values(**row)
                    .returning(workflow_dag_nodes.c.workflow_dag_node_id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def delete_nodes(
        self, workflow_id: int, node_ids: list[int], conn: Connection | None = None
    ) -> int:
        def run(connection: Connection) -> int:
            result = connection.execute(
                delete(workflow_dag_nodes).where(
                    workflow_dag_nodes.c.workflow_id == workflow_id,
                    workflow_dag_nodes.c.workflow_dag_node_id.in_(node_ids),
                )
            )
            return int(result.rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def list_edges(self, workflow_id: int) -> list[dict[str, object]]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(workflow_dag_edges)
                    .where(workflow_dag_edges.c.workflow_id == workflow_id)
                    .order_by(workflow_dag_edges.c.workflow_dag_edge_id.asc())
                )
                .mappings()
                .all()
            )
        return [dict(row) for row in rows]

    def fetch_edge(self, workflow_dag_edge_id: int) -> dict[str, object] | None:
        with self.engine.connect() as connection:
            row = (
                connection.execute(
                    select(workflow_dag_edges).where(
                        workflow_dag_edges.c.workflow_dag_edge_id
                        == workflow_dag_edge_id
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row is not None else None

    def insert_edge(
        self, row: dict[str, object], conn: Connection | None = None
    ) -> int:
        def run(connection: Connection) -> int:
            return int(
                connection.execute(
                    insert(workflow_dag_edges)
                    .values(**row)
                    .returning(workflow_dag_edges.c.workflow_dag_edge_id)
                ).scalar_one()
            )

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)

    def delete_edge(
        self, workflow_id: int, edge_id: int, conn: Connection | None = None
    ) -> int:
        def run(connection: Connection) -> int:
            result = connection.execute(
                delete(workflow_dag_edges).where(
                    workflow_dag_edges.c.workflow_id == workflow_id,
                    workflow_dag_edges.c.workflow_dag_edge_id == edge_id,
                )
            )
            return int(result.rowcount or 0)

        if conn is not None:
            return run(conn)
        with self.engine.begin() as connection:
            return run(connection)
