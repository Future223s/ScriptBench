from __future__ import annotations

import ast
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DATABASE_STATEMENT_BUILDERS = {"select", "insert", "update", "delete"}
EXCLUDED_PARTS = {
    "migrations",
    "repositories",
    "tables",
    "tests",
}


class RepositoryBoundaryTests(unittest.TestCase):
    def test_database_statements_are_defined_only_in_database_layers(self) -> None:
        violations: list[str] = []
        for path in BACKEND_ROOT.rglob("*.py"):
            relative = path.relative_to(BACKEND_ROOT)
            if any(part in EXCLUDED_PARTS for part in relative.parts):
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            sqlalchemy_aliases: set[str] = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module == "sqlalchemy":
                    imported = {
                        alias.name
                        for alias in node.names
                        if alias.name in DATABASE_STATEMENT_BUILDERS
                    }
                    if imported:
                        violations.append(
                            f"{relative}:{node.lineno} imports {', '.join(sorted(imported))}"
                        )
                elif (
                    isinstance(node, ast.ImportFrom)
                    and node.module is not None
                    and node.module.startswith("backend.database.tables.")
                    and relative != Path("api/dependencies.py")
                ):
                    violations.append(
                        f"{relative}:{node.lineno} imports a database table directly"
                    )
                elif isinstance(node, ast.Import):
                    sqlalchemy_aliases.update(
                        alias.asname or alias.name
                        for alias in node.names
                        if alias.name == "sqlalchemy"
                    )
                elif (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id in sqlalchemy_aliases
                    and node.func.attr in DATABASE_STATEMENT_BUILDERS
                ):
                    violations.append(
                        f"{relative}:{node.lineno} calls sqlalchemy.{node.func.attr}"
                    )
        self.assertEqual([], violations, "\n".join(violations))


if __name__ == "__main__":
    unittest.main()
