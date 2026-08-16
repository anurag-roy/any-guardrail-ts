import { Guardrail } from "../base.js";
import { fetchJson, isRecord, jsonRequest, stringValue, type Fetch } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, ChatMessage, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

const CONFIDENCE_SCORES: Readonly<Record<string, number>> = Object.freeze({
  l1_confident: 1,
  l2_very_likely: 0.8,
  l3_likely: 0.6,
  l4_less_likely: 0.4,
  l5_unlikely: 0.2,
  no_level: 0,
});

export interface LakeraGuardOptions {
  apiKey: string;
  breakdown?: boolean;
  devInfo?: boolean;
  endpoint?: string;
  fetch?: Fetch;
  metadata?: Record<string, unknown>;
  payload?: boolean;
  projectId?: string;
}

export class LakeraGuard extends Guardrail<string | ChatMessage[]> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.LakeraGuard);
  override readonly modelId = "lakera-guard";
  private readonly endpoint: string;
  private readonly fetcher: Fetch;

  constructor(private readonly options: LakeraGuardOptions) {
    super();
    if (options.apiKey.length === 0) throw new TypeError("Lakera apiKey cannot be empty.");
    this.endpoint = options.endpoint ?? "https://api.lakera.ai/v2/guard";
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  override validate(input: string | ChatMessage[]): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const requestBody: Record<string, unknown> = {
        breakdown: this.options.breakdown ?? true,
        messages: typeof input === "string" ? [{ content: input, role: "user" }] : input,
        payload: this.options.payload ?? true,
      };
      if (this.options.devInfo === true) requestBody.dev_info = true;
      if (this.options.metadata !== undefined) requestBody.metadata = this.options.metadata;
      if (this.options.projectId !== undefined) requestBody.project_id = this.options.projectId;
      const body = await fetchJson<Record<string, unknown>>(
        this.fetcher,
        "Lakera Guard",
        this.endpoint,
        jsonRequest(requestBody, { authorization: `Bearer ${this.options.apiKey}` }),
      );
      const flagged = Boolean(body.flagged);
      const breakdown = Array.isArray(body.breakdown) ? body.breakdown.filter(isRecord) : [];
      const detected = breakdown.filter((entry) => Boolean(entry.detected));
      const score =
        detected.length > 0
          ? Math.max(...detected.map((entry) => CONFIDENCE_SCORES[stringValue(entry.result) ?? ""] ?? 0))
          : flagged
            ? 1
            : 0;
      const categories: CategoryResult[] = breakdown.map((entry) => ({
        name: stringValue(entry.detector_type) ?? "unknown",
        score: CONFIDENCE_SCORES[stringValue(entry.result) ?? ""] ?? 0,
        triggered: Boolean(entry.detected),
      }));
      const extra: Record<string, unknown> = {
        detectedDetectorTypes: [
          ...new Set(detected.map((entry) => stringValue(entry.detector_type)).filter((name) => name !== undefined)),
        ].sort(),
        flagged,
        metadata: isRecord(body.metadata) ? body.metadata : {},
        payload: Array.isArray(body.payload) ? body.payload : [],
      };
      if (body.dev_info !== undefined) extra.devInfo = body.dev_info;
      return guardrailOutput({ categories, extra, raw: body, score, valid: !flagged });
    });
  }
}
