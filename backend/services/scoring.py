from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.engine import Engine

from backend.database.repositories.model_outputs_repository import (
    ModelOutputsRepository,
)
from backend.database.tables.samples_table import samples


@dataclass(frozen=True)
class OutputMetrics:
    cer: float
    wer: float


class ErrorComputationService:
    """Scores a completed transcription against its sample's ground truth."""

    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self.model_outputs = ModelOutputsRepository(engine)

    def score(self, *, model_output_id: int, sample_id: str, output_text: str) -> None:
        ground_truth = self._ground_truth(sample_id)
        if ground_truth is None:
            return
        metrics = compute_metrics(ground_truth, output_text)
        self.model_outputs.update_metrics(
            model_output_id,
            cer=metrics.cer,
            wer=metrics.wer,
        )

    def _ground_truth(self, sample_id: str) -> str | None:
        with self.engine.connect() as connection:
            value = connection.execute(
                select(samples.c.ground_truth_text).where(
                    samples.c.sample_id == sample_id
                )
            ).scalar_one_or_none()
        return str(value) if value is not None else None


def compute_metrics(ground_truth: str, output: str) -> OutputMetrics:
    ground_truth_words = tokenize_words(ground_truth)
    output_words = tokenize_words(output)
    char_edits = levenshtein_distance(list(ground_truth), list(output))
    word_edits = levenshtein_distance(ground_truth_words, output_words)
    return OutputMetrics(
        cer=char_edits / len(ground_truth) if ground_truth else 0.0,
        wer=word_edits / len(ground_truth_words) if ground_truth_words else 0.0,
    )


def tokenize_words(text: str) -> list[str]:
    return text.split()


def levenshtein_distance(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for left_index, left_value in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_value in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[right_index] + 1,
                    previous[right_index - 1] + (0 if left_value == right_value else 1),
                )
            )
        previous = current
    return previous[-1]
