export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ChatMessage {
  content: string;
  role: string;
}

export interface CategoryResult {
  name: string;
  description?: string;
  triggered?: boolean;
  score?: number;
  severity?: number;
}

export interface SpanResult {
  end: number;
  start: number;
  label?: string;
  score?: number;
  text?: string;
}

export interface GuardrailUsage {
  completionTokens?: number;
  latencyMs?: number;
  modelId?: string;
  promptTokens?: number;
}

export interface GuardrailOutput {
  valid: boolean;
  action?: string;
  categories: CategoryResult[];
  explanation?: string;
  extra?: Record<string, unknown>;
  modifiedText?: string;
  raw?: unknown;
  score?: number;
  spans?: SpanResult[];
  usage?: GuardrailUsage;
}

export interface GuardrailPreprocessOutput<T> {
  data: T;
}

export interface GuardrailInferenceOutput<T> {
  data: T;
}

export function guardrailOutput(
  output: Omit<GuardrailOutput, "categories"> & { categories?: CategoryResult[] },
): GuardrailOutput {
  return { ...output, categories: output.categories ?? [] };
}
