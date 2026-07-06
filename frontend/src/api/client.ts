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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null
        ? String((payload as JsonErrorPayload).detail || "")
        : "";
    throw new ApiError(detail || `Request failed with ${response.status}`, response.status, payload);
  }

  return payload as T;
}
