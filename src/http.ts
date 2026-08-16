import { GuardrailHttpError } from "./errors.js";

export type Fetch = typeof globalThis.fetch;

export async function fetchJson<T>(
  fetcher: Fetch,
  provider: string,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<T> {
  const response = await fetcher(input, init);
  const body = await response.text();
  if (!response.ok) throw new GuardrailHttpError(provider, response.status, body);
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new TypeError(`${provider} returned invalid JSON.`, { cause: error });
  }
}

export function jsonRequest(body: unknown, headers: HeadersInit = {}): Pick<RequestInit, "body" | "headers" | "method"> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  return {
    body: JSON.stringify(body),
    headers: requestHeaders,
    method: "POST",
  };
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
