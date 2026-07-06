import { transcriptionScore } from "./metrics.js";

export function transcriptionOutputName(transcription) {
  const explicit = String(transcription?.output_name || "").trim();
  if (explicit) return explicit;

  const groupName = String(transcription?.group_name || "").trim();
  const groupValue = String(transcription?.group_value || "").trim();
  if (groupName && groupValue) return `${groupName}: ${groupValue}`;

  if (Array.isArray(transcription?.sample_ids) && transcription.sample_ids.length === 1) {
    return transcription.sample_ids[0];
  }
  if (Array.isArray(transcription?.sample_ids) && transcription.sample_ids.length > 1) {
    return `${transcription.sample_ids[0]} + ${transcription.sample_ids.length - 1} more`;
  }

  return transcription?.sample_id || `Output ${transcription?.transcription_id || ""}`;
}

export function transcriptionSearchText(transcription) {
  return [
    transcriptionOutputName(transcription),
    transcription?.sample_id,
    Array.isArray(transcription?.sample_ids) ? transcription.sample_ids.join(" ") : "",
    transcription?.group_name,
    transcription?.group_value,
    transcription?.transcription_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function sortTranscriptions(transcriptions, sortKey) {
  const items = [...transcriptions];
  items.sort((left, right) => {
    if (sortKey === "created_at") {
      return String(right.created_at || "").localeCompare(String(left.created_at || ""));
    }
    if (sortKey === "sample_id") {
      return String(transcriptionOutputName(left)).localeCompare(String(transcriptionOutputName(right)));
    }
    const leftScore = transcriptionScore(left);
    const rightScore = transcriptionScore(right);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return String(transcriptionOutputName(left)).localeCompare(String(transcriptionOutputName(right)));
  });
  return items;
}

export function filterTranscriptions(transcriptions, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return transcriptions;
  return transcriptions.filter((transcription) => transcriptionSearchText(transcription).includes(normalized));
}

export function selectedTranscription(transcriptions, selectedTranscriptionId) {
  return (
    transcriptions.find((item) => Number(item.transcription_id) === Number(selectedTranscriptionId))
    || transcriptions[0]
    || null
  );
}
