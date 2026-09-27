from __future__ import annotations

import unittest

from backend.services.disagreements import (
    average_disagreement_count,
    build_disagreements,
    classify_correctness,
    find_disagreement_regions,
)


class DisagreementTests(unittest.TestCase):
    def test_builds_localized_substitution_with_offsets(self):
        disagreements = build_disagreements(
            "before\nand þa cyning ferde\nafter",
            "before\nand þæt cyning ferde\nafter",
            ground_truth="before\nand þæt cyning ferde\nafter",
            correctness_outcome="correction",
        )

        self.assertEqual(1, len(disagreements))
        disagreement = disagreements[0]
        self.assertEqual("substitution", disagreement["operation_type"])
        self.assertEqual("correction", disagreement["correctness_outcome"])
        self.assertIn("and þa cyning ferde", disagreement["source_line_context"])
        self.assertIn("and þæt cyning ferde", disagreement["target_line_context"])
        self.assertEqual(
            "a",
            disagreement["source_line_context"][
                disagreement["source_span_start"] : disagreement["source_span_end"]
            ],
        )
        self.assertEqual(
            "æt",
            disagreement["target_line_context"][
                disagreement["target_span_start"] : disagreement["target_span_end"]
            ],
        )

    def test_missing_ground_truth_is_unresolved(self):
        disagreement = build_disagreements("abc", "axc")[0]
        self.assertEqual("unresolved", disagreement["correctness_outcome"])

    def test_insertion_and_deletion_are_directional(self):
        forward = build_disagreements("ac", "abc")[0]
        reverse = build_disagreements("abc", "ac")[0]
        self.assertEqual("insertion", forward["operation_type"])
        self.assertEqual("deletion", reverse["operation_type"])

    def test_displayed_count_averages_multiple_relationships(self):
        self.assertEqual(3.0, average_disagreement_count([2, 4]))
        self.assertIsNone(average_disagreement_count([]))

    def test_correctness_reuses_persisted_cer(self):
        self.assertEqual(
            "correction",
            classify_correctness(
                "þa", "þæt", ground_truth="þæt", source_cer=0.4, target_cer=0.0
            ),
        )

    def test_context_is_a_bounded_word_window(self):
        source = "zero one two three altered seven eight nine ten eleven"
        target = "zero one two three corrected seven eight nine ten eleven"
        disagreement = build_disagreements(source, target)[0]
        self.assertLessEqual(len(disagreement["source_line_context"]), 280)
        self.assertTrue(disagreement["source_line_context"].startswith("… "))
        self.assertTrue(disagreement["source_line_context"].endswith(" …"))
        highlighted = disagreement["source_line_context"][
            disagreement["source_span_start"] : disagreement["source_span_end"]
        ]
        self.assertEqual(disagreement["source_text"], highlighted)

    def test_repetitive_placeholder_output_collapses_to_one_bounded_change(self):
        runaway = "\n".join(["[unclear line]"] * 12_000)
        disagreements = build_disagreements(runaway, "short corrected text")
        self.assertEqual(1, len(disagreements))
        self.assertEqual("substitution", disagreements[0]["operation_type"])
        self.assertLessEqual(len(disagreements[0]["source_line_context"]), 284)
        self.assertEqual(len(runaway), len(disagreements[0]["source_text"]))

    def test_anchor_regions_absorb_short_internal_matches(self):
        regions = find_disagreement_regions(
            "abcXYZdef", "abcPZQdef", agreement_anchor_length=3
        )
        self.assertEqual(1, len(regions))
        self.assertEqual("XYZ", regions[0]["source_text"])
        self.assertEqual("PZQ", regions[0]["target_text"])

    def test_anchor_regions_split_on_strong_agreement(self):
        regions = find_disagreement_regions(
            "and þa cyning to lunden",
            "and þæt cining to london",
            agreement_anchor_length=3,
        )
        self.assertEqual(2, len(regions))

    def test_severity_can_filter_regions_when_raw_floor_is_higher(self):
        regions = find_disagreement_regions(
            "lunden",
            "london",
            agreement_anchor_length=3,
            severity_threshold=0.5,
            minimum_raw_edits=3,
        )
        self.assertEqual([], regions)

    def test_region_severity_uses_levenshtein_distance(self):
        regions = find_disagreement_regions(
            "kitten",
            "sitting",
            agreement_anchor_length=4,
            severity_threshold=0,
        )
        self.assertEqual(3, regions[0]["raw_edit_count"])
        self.assertAlmostEqual(3 / 7, regions[0]["normalized_distance"])


if __name__ == "__main__":
    unittest.main()
