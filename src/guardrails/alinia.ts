import { Guardrail } from "../base.js";
import { fetchJson, isRecord, jsonRequest, numberValue, stringValue, type Fetch } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, ChatMessage, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

export type AliniaDetectionConfig = string | Record<string, unknown>;

export interface AliniaOptions {
  apiKey: string;
  detectionConfig: AliniaDetectionConfig;
  endpoint: string;
  blockedResponse?: Record<string, string>;
  fetch?: Fetch;
  metadata?: Record<string, unknown>;
  stream?: boolean;
}

export interface AliniaValidateOptions {
  contextDocuments?: string[];
  output?: string;
}

export class Alinia extends Guardrail<string | ChatMessage[], AliniaValidateOptions> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.Alinia);
  private readonly fetcher: Fetch;

  constructor(private readonly options: AliniaOptions) {
    super();
    if (options.apiKey.length === 0) throw new TypeError("Alinia apiKey cannot be empty.");
    if (options.endpoint.length === 0) throw new TypeError("Alinia endpoint cannot be empty.");
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  override validate(input: string | ChatMessage[], validateOptions: AliniaValidateOptions = {}): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const payload: Record<string, unknown> = typeof input === "string" ? { input } : { messages: input };
      if (typeof this.options.detectionConfig === "string") {
        payload.detection_config_id = this.options.detectionConfig;
      } else {
        payload.detection_config = this.options.detectionConfig;
      }
      if (this.options.metadata !== undefined) payload.metadata = this.options.metadata;
      if (this.options.blockedResponse !== undefined) payload.blocked_response = this.options.blockedResponse;
      if (this.options.stream === true) payload.stream = true;
      if (validateOptions.output !== undefined) payload.output = validateOptions.output;
      if (validateOptions.contextDocuments !== undefined) payload.context_documents = validateOptions.contextDocuments;

      const body = await fetchJson<Record<string, unknown>>(
        this.fetcher,
        "Alinia",
        this.options.endpoint,
        jsonRequest(payload, { authorization: `Bearer ${this.options.apiKey}` }),
      );
      const result = isRecord(body.result) ? body.result : {};
      const categories: CategoryResult[] = [];
      const scores: number[] = [];
      if (isRecord(result.category_details)) {
        for (const [group, labels] of Object.entries(result.category_details)) {
          if (!isRecord(labels)) continue;
          for (const [label, value] of Object.entries(labels)) {
            if (typeof value === "boolean") categories.push({ name: `${group}/${label}`, triggered: value });
            else {
              const score = numberValue(value);
              if (score !== undefined) {
                categories.push({ name: `${group}/${label}`, score });
                scores.push(score);
              }
            }
          }
        }
      }
      const recommendation = body.recommendation ?? result.recommendation;
      const action = isRecord(recommendation) ? stringValue(recommendation.action) : undefined;
      const explanation =
        typeof recommendation === "string"
          ? recommendation
          : isRecord(recommendation)
            ? stringValue(recommendation.output)
            : undefined;
      return guardrailOutput({
        ...(action === undefined ? {} : { action }),
        categories,
        ...(explanation === undefined ? {} : { explanation }),
        ...(recommendation === undefined ? {} : { extra: { recommendation } }),
        raw: body,
        ...(scores.length === 0 ? {} : { score: Math.max(...scores) }),
        valid: !result.flagged,
      });
    });
  }
}
