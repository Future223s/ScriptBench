import { asNumber } from "../../utils/metrics.js";

export function toneForMetric(value) {
  const number = asNumber(value);
  if (number == null) return "neutral";
  if (number <= 0.1) return "good";
  if (number <= 0.25) return "warn";
  return "bad";
}

export function transcriptionScore(transcription) {
  const cer = asNumber(transcription?.cer);
  const wer = asNumber(transcription?.wer);
  if (cer == null && wer == null) return Number.POSITIVE_INFINITY;
  if (cer == null) return wer;
  if (wer == null) return cer;
  return (cer + wer) / 2;
}

export function aggregateMetrics(transcriptions) {
  const buckets = {
    cer: [],
    wer: [],
    hallucinations: [],
    line_omission_count: [],
    line_addition_count: [],
  };

  for (const transcription of transcriptions) {
    for (const key of Object.keys(buckets)) {
      const value = asNumber(transcription?.[key]);
      if (value != null) buckets[key].push(value);
    }
  }

  const result = {};
  for (const [key, values] of Object.entries(buckets)) {
    if (!values.length) continue;
    const total = values.reduce((sum, value) => sum + value, 0);
    result[key] = {
      mean: total / values.length,
      count: values.length,
    };
  }
  return result;
}
