export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type JsonErrorPayload = {
  detail?: unknown;
};

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item !== "object" || item === null) return String(item);
        const validation = item as { loc?: unknown[]; msg?: unknown };
        const field = Array.isArray(validation.loc)
          ? validation.loc.filter((part) => part !== "body").join(".")
          : "";
        const message =
          typeof validation.msg === "string" ? validation.msg : "Invalid value";
        return field ? `${field}: ${message}` : message;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object" && detail !== null) {
    const value = detail as { message?: unknown; detail?: unknown };
    if (typeof value.message === "string") return value.message;
    if (value.detail !== undefined) return formatErrorDetail(value.detail);
    return JSON.stringify(detail);
  }
  return "";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detailPayload =
      typeof payload === "object" && payload !== null
        ? (payload as JsonErrorPayload).detail
        : undefined;
    const detail = formatErrorDetail(detailPayload);
    throw new ApiError(
      detail || `Request failed with ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}
