import contentData from "../schemas/guardrail_content.json" with { type: "json" };
import type { GuardrailName } from "./names.js";

export const ContentKind = {
  Criteria: "criteria",
  Policy: "policy",
  Rubric: "rubric",
} as const;
export type ContentKind = (typeof ContentKind)[keyof typeof ContentKind];

export interface AuthoredContent {
  content: string;
  description: string;
  key: string;
  kind: ContentKind;
  provenance: "adapted" | "author";
  source?: string;
}

interface RawContent extends Omit<AuthoredContent, "source"> {
  source: string | null;
}

const registry = contentData as Partial<Record<GuardrailName, RawContent[]>>;

export function listContent(name: GuardrailName, kind: ContentKind): string[] {
  return (registry[name] ?? [])
    .filter((item) => item.kind === kind)
    .map((item) => item.key)
    .sort();
}

export function getContent(name: GuardrailName, kind: ContentKind, key: string): string {
  const item = (registry[name] ?? []).find((candidate) => candidate.kind === kind && candidate.key === key);
  if (item === undefined) {
    throw new RangeError(`No ${kind} ${JSON.stringify(key)} is registered for ${name}.`);
  }
  return item.content;
}
