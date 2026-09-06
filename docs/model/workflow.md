# Prompt Runtime Model

This model defines how a payload template becomes an immutable provider request for one execution row. It is a design record, not an implementation change.

The active execution flow is: execution row -> payload builder -> one job snapshot -> execution coordinator -> model client -> output validator -> model output.
