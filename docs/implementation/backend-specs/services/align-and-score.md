# align-and-score

## Trigger: Service

- Service file: `backend/services/align_and_score.py`
- Service type: pure scoring helper module

## Initialization

- No class initialization
- Uses module-level constants for hallucination scoring thresholds

## Integration Map

- Imported by `backend/services/scoring_client.py`
- Also used by notebook-driven evaluation flows
- Provides the low-level text alignment logic for transcription scoring

## Functions

- `tokenize_words(text)`: splits text into non-whitespace tokens
- `levenshtein_distance(seq_a, seq_b)`: computes edit distance for token or character sequences
- `align_lines(gt_lines, model_lines)`: counts line omissions and additions
- `word_alignment_ops(gt_words, model_words)`: builds the alignment operation list
- `hallucination_count_from_ops(gt_words, ops)`: counts hallucinated n-grams from alignment operations
- `normalized_char_difference(text_a, text_b)`: returns a normalized character-level distance
- `phrase_matches_ground_truth(phrase, gt_phrases, tolerance)`: checks whether a phrase is close enough to known ground truth
- `read_text(path)`: reads UTF-8 text from disk
- `align_and_score_text(sample_id, model_spec, gt_text, model_text)`: computes the full scoring payload for one sample
- `align_and_score(sample_id, model_spec, gt_path, model_path)`: file-based wrapper around `align_and_score_text`
