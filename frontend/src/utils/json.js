export function safeJsonStringify(value) {
  if (value == null || value === "") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function safeJsonParse(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
