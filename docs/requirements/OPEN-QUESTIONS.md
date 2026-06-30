## Open Questions

- Should grouping membership remain stored on `samples`, or should grouping become a first-class table and relation?
- Should assembled transcription records stay sample-scoped, or should they be redesigned around workflow stage plus group-membership combinations?
- Where should `output name` live, and how should uniqueness for assembled outputs be enforced?
- Should prompt resolution stay embedded in job generation, or should it expose a preview endpoint or draft view?
- What is the intended boundary between raw transcription review, scored analysis, and cross-workflow comparison?
- Which job queue actions are first-class product behaviors versus internal state transitions?
- Should metrics live on the transcription record itself, or in a separate scoring/analysis store?
