from __future__ import annotations

import json
import re
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

import pandas as pd

from backend.core.workflow_config import WorkflowConfig

HALL_MIN_WORDS = 2
HALL_MAX_WORDS = 6
HALL_CHAR_DIFF_TOLERANCE = 0.20


def tokenize_words(text: str) -> list[str]:
    return re.compile(r"\S+").findall(text)


def levenshtein_distance(seq_a: list[str], seq_b: list[str]) -> int:
    m, n = len(seq_a), len(seq_b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        ai = seq_a[i - 1]
        for j in range(1, n + 1):
            bj = seq_b[j - 1]
            cost = 0 if ai == bj else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[m][n]


def align_lines(gt_lines: list[str], model_lines: list[str]) -> tuple[int, int]:
    omissions = 0
    additions = 0
    max_len = max(len(gt_lines), len(model_lines))

    for idx in range(max_len):
        gt_line = gt_lines[idx] if idx < len(gt_lines) else ""
        model_line = model_lines[idx] if idx < len(model_lines) else ""

        gt_has_text = bool(gt_line.strip())
        model_has_text = bool(model_line.strip())

        if gt_has_text and not model_has_text:
            omissions += 1
        elif not gt_has_text and model_has_text:
            additions += 1

    return omissions, additions


def word_alignment_ops(
    gt_words: list[str],
    model_words: list[str],
) -> list[tuple[str, str, str]]:
    m, n = len(gt_words), len(model_words)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            sub_cost = 0 if gt_words[i - 1] == model_words[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + sub_cost,
            )

    ops: list[tuple[str, str, str]] = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sub_cost = 0 if gt_words[i - 1] == model_words[j - 1] else 1
            if dp[i][j] == dp[i - 1][j - 1] + sub_cost:
                op = "eq" if sub_cost == 0 else "sub"
                ops.append((op, gt_words[i - 1], model_words[j - 1]))
                i -= 1
                j -= 1
                continue
        if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append(("del", gt_words[i - 1], ""))
            i -= 1
            continue
        ops.append(("ins", "", model_words[j - 1]))
        j -= 1

    ops.reverse()
    return ops


def hallucination_count_from_ops(
    gt_words: list[str],
    ops: list[tuple[str, str, str]],
) -> int:
    gt_ngrams: dict[int, set[str]] = defaultdict(set)
    for n in range(2, 6 + 1):
        for i in range(0, max(0, len(gt_words) - n + 1)):
            gt_ngrams[n].add(" ".join(gt_words[i : i + n]))

    candidate_segments: list[list[str]] = []
    segment: list[str] = []
    for op, _gt_word, model_word in ops:
        if op in ("ins", "sub") and model_word:
            segment.append(model_word)
        else:
            if segment:
                candidate_segments.append(segment)
                segment = []
    if segment:
        candidate_segments.append(segment)

    total = 0
    for seg in candidate_segments:
        for n in range(HALL_MIN_WORDS, HALL_MAX_WORDS + 1):
            for i in range(0, max(0, len(seg) - n + 1)):
                phrase = " ".join(seg[i : i + n])
                if not phrase_matches_ground_truth(
                    phrase,
                    gt_ngrams[n],
                    HALL_CHAR_DIFF_TOLERANCE,
                ):
                    total += 1
    return total


def normalized_char_difference(text_a: str, text_b: str) -> float:
    denominator = max(len(text_a), len(text_b))
    if denominator == 0:
        return 0.0
    return levenshtein_distance(list(text_a), list(text_b)) / denominator


def phrase_matches_ground_truth(
    phrase: str,
    gt_phrases: set[str],
    tolerance: float,
) -> bool:
    if phrase in gt_phrases:
        return True

    return any(
        normalized_char_difference(phrase, gt_phrase) <= tolerance
        for gt_phrase in gt_phrases
    )


def align_and_score_text(sample_id, model_spec, gt_text: str, model_text: str) -> dict:
    gt_chars = list(gt_text)
    model_chars = list(model_text)
    gt_words = tokenize_words(gt_text)
    model_words = tokenize_words(model_text)
    gt_lines = gt_text.splitlines()
    model_lines = model_text.splitlines()

    char_edits = levenshtein_distance(gt_chars, model_chars)
    word_edits = levenshtein_distance(gt_words, model_words)
    omissions, additions = align_lines(gt_lines, model_lines)
    hall_count = hallucination_count_from_ops(
        gt_words,
        word_alignment_ops(gt_words, model_words),
    )

    return {
        "sample_id": sample_id,
        "model_family": model_spec,
        "char_gt_total": len(gt_chars),
        "char_edits": char_edits,
        "cer": (char_edits / len(gt_chars)) if gt_chars else 0.0,
        "word_gt_total": len(gt_words),
        "word_edits": word_edits,
        "wer": (word_edits / len(gt_words)) if gt_words else 0.0,
        "line_omission_count": omissions,
        "line_addition_count": additions,
        "hallucination_count": hall_count,
    }


def align_and_score(sample_id, model_spec, gt_path, model_path) -> dict:
    gt_text = Path(gt_path).read_text(encoding="utf-8")
    model_text = Path(model_path).read_text(encoding="utf-8")
    return align_and_score_text(
        sample_id=sample_id,
        model_spec=model_spec,
        gt_text=gt_text,
        model_text=model_text,
    )


class ScoringClient:
    def __init__(
        self,
        workflow_config: WorkflowConfig,
        evaluation_run_dir: Path,
        data_quality_path: Path | None = None,
    ) -> None:
        self.config = workflow_config
        self.evaluation_run_dir = evaluation_run_dir
        self.data_quality_path = data_quality_path
        self.scorers: dict[str, Callable[..., dict]] = {
            "align_and_score": self._score_with_align_and_score,
        }

    def _score_with_align_and_score(
        self,
        *,
        workflow_row: Mapping[str, Any],
        transcription_rows: Sequence[Mapping[str, Any]],
        ground_truth_by_sample_id: Mapping[str, str],
        job_samples_by_job_id: Mapping[int, Sequence[str]] | None = None,
    ) -> dict:
        workflow_id = int(workflow_row["workflow_id"])
        workflow_name = str(workflow_row["workflow_name"])
        workflow_stage = str(workflow_row["workflow_stage"])

        per_sample_metrics: list[dict[str, Any]] = []
        for transcription_row in transcription_rows:
            sample_id = str(transcription_row["sample_id"])
            ground_truth_text = ground_truth_by_sample_id.get(sample_id)
            if ground_truth_text is None:
                raise FileNotFoundError(
                    f"Missing ground truth text for sample '{sample_id}'"
                )

            metric_row = align_and_score_text(
                sample_id=sample_id,
                model_spec=self.config.model_family,
                gt_text=ground_truth_text,
                model_text=str(transcription_row["transcription_text"]),
            )
            metric_row.update(
                {
                    "workflow_id": workflow_id,
                    "workflow_name": workflow_name,
                    "workflow_stage": workflow_stage,
                    "transcription_id": int(transcription_row["transcription_id"]),
                    "transcription_text": transcription_row["transcription_text"],
                    "metrics": transcription_row.get("metrics"),
                }
            )
            per_sample_metrics.append(metric_row)

        sample_df = pd.DataFrame(per_sample_metrics)
        aggregates: dict[str, object] = {
            "all": sample_df.mean(numeric_only=True).to_dict()
        }

        return {
            "model": self.config.model_family,
            "workflow_name": workflow_name,
            "stage": workflow_stage,
            "workflow_id": workflow_id,
            "scorer": "align_and_score",
            "per_sample": sample_df.to_dict(orient="records"),
            "aggregates": aggregates,
            "job_samples_by_job_id": {
                str(job_id): list(sample_ids)
                for job_id, sample_ids in (job_samples_by_job_id or {}).items()
            },
        }

    def _data_quality_aggregation(
        self,
        sample_df: pd.DataFrame,
        data_quality_aggregations: list[str],
    ) -> dict[str, object]:
        if self.data_quality_path is None:
            raise FileNotFoundError("Missing data quality file path")

        if not self.data_quality_path.exists():
            raise FileNotFoundError(f"Missing data quality file: {self.data_quality_path}")

        quality_df = pd.read_csv(self.data_quality_path)
        quality_df.columns = quality_df.columns.str.strip()
        quality_df = quality_df.loc[:, ~quality_df.columns.str.startswith("Unnamed:")]

        if "sample_id" not in quality_df.columns:
            raise ValueError(f"{self.data_quality_path} is missing a sample_id column")

        missing_fields = [
            field for field in data_quality_aggregations if field not in quality_df.columns
        ]
        if missing_fields:
            raise ValueError(
                f"{self.data_quality_path} is missing data quality fields: "
                f"{', '.join(missing_fields)}"
            )

        merged_df = quality_df.merge(sample_df, on="sample_id")
        aggregations: dict[str, object] = {}
        for field in data_quality_aggregations:
            grouped_df = merged_df.groupby(field).mean(numeric_only=True)
            aggregations[field] = grouped_df.to_dict(orient="index")

        return aggregations

    def score_outputs(
        self,
        *,
        workflow_row: Mapping[str, Any],
        transcription_rows: Sequence[Mapping[str, Any]],
        ground_truth_by_sample_id: Mapping[str, str],
        job_samples_by_job_id: Mapping[int, Sequence[str]] | None = None,
        scorer: str = "align_and_score",
        data_quality_aggregations: list[str] | None = None,
    ) -> dict:
        if scorer not in self.scorers:
            available = ", ".join(sorted(self.scorers))
            raise ValueError(f"Unknown scorer '{scorer}'. Available scorers: {available}")

        run_results = self.scorers[scorer](
            workflow_row=workflow_row,
            transcription_rows=transcription_rows,
            ground_truth_by_sample_id=ground_truth_by_sample_id,
            job_samples_by_job_id=job_samples_by_job_id,
        )
        if data_quality_aggregations:
            run_results["aggregates"].update(
                self._data_quality_aggregation(
                    sample_df=pd.DataFrame(run_results["per_sample"]),
                    data_quality_aggregations=data_quality_aggregations,
                )
            )
        return run_results

    def write_csv(self, run_results: dict) -> None:
        sample_df = pd.DataFrame(run_results["per_sample"])
        csv_output_file = (
            self.evaluation_run_dir
            / f"{self.config.workflow_name}_{self.config.stage}.csv"
        )
        csv_output_file.parent.mkdir(parents=True, exist_ok=True)
        sample_df.to_csv(csv_output_file, index=False)

        aggregate_rows: list[dict[str, object]] = []
        for aggregation_name, value_dict in run_results["aggregates"].items():
            if aggregation_name == "all":
                if isinstance(value_dict, dict):
                    aggregate_rows.append(
                        {"aggregation": "all", "value": "all", **value_dict}
                    )
                continue

            if not isinstance(value_dict, dict):
                continue
            for value_name, metrics_dict in value_dict.items():
                if isinstance(metrics_dict, dict):
                    aggregate_rows.append(
                        {
                            "aggregation": str(aggregation_name),
                            "value": str(value_name),
                            **metrics_dict,
                        }
                    )

        aggregates_csv_output_file = (
            self.evaluation_run_dir
            / f"{self.config.workflow_name}_{self.config.stage}_aggregates.csv"
        )
        pd.DataFrame(aggregate_rows).to_csv(aggregates_csv_output_file, index=False)
        print(f"Wrote evaluation csv: {csv_output_file}")
        print(f"Wrote evaluation aggregates csv: {aggregates_csv_output_file}")

    def write_json(self, run_results: dict) -> None:
        json_output_file = (
            self.evaluation_run_dir / f"{self.config.workflow_name}_{self.config.stage}.json"
        )
        json_output_file.parent.mkdir(parents=True, exist_ok=True)
        json_output_file.write_text(json.dumps(run_results, indent=2), encoding="utf-8")
        print(f"Wrote evaluation json: {json_output_file}")
