import { Guardrail } from "../base.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

export const OPENAI_MODERATION_MODELS = [
  "omni-moderation-latest",
  "omni-moderation-2024-09-26",
  "text-moderation-latest",
] as const;

export type ModerationFunction = (parameters: Record<string, any>) => Promise<any>;

export interface OpenAIModerationOptions {
  apiBase?: string;
  apiKey?: string;
  clientOptions?: Record<string, unknown>;
  modelId?: (typeof OPENAI_MODERATION_MODELS)[number];
  moderation?: ModerationFunction;
  threshold?: number;
}

type ModerationInput = string | { type: string; [key: string]: unknown }[];

interface NormalizedModerationResult {
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  flagged: boolean;
}

export class OpenAIModeration extends Guardrail<ModerationInput> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.OpenAIModeration);
  override readonly modelId: string;
  readonly threshold: number;
  private readonly options: OpenAIModerationOptions;

  constructor(options: OpenAIModerationOptions = {}) {
    super();
    this.modelId = options.modelId ?? OPENAI_MODERATION_MODELS[0];
    if (!(OPENAI_MODERATION_MODELS as readonly string[]).includes(this.modelId)) {
      throw new RangeError(`Unsupported OpenAI moderation model ${JSON.stringify(this.modelId)}.`);
    }
    this.threshold = options.threshold ?? 0.5;
    if (this.threshold < 0 || this.threshold > 1) throw new RangeError("threshold must be between 0 and 1.");
    this.options = options;
  }

  override validate(input: ModerationInput): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const moderation = this.options.moderation ?? ((await import("any-llm-ts")).moderation as ModerationFunction);
      const response = await moderation({
        ...(this.options.apiBase === undefined ? {} : { apiBase: this.options.apiBase }),
        ...(this.options.apiKey === undefined ? {} : { apiKey: this.options.apiKey }),
        ...(this.options.clientOptions === undefined ? {} : { clientOptions: this.options.clientOptions }),
        input,
        model: this.modelId,
        provider: "openai",
      });
      const result = response?.results?.[0] as NormalizedModerationResult | undefined;
      if (result === undefined) {
        return guardrailOutput({ extra: { parseFailure: true }, raw: response, valid: false });
      }
      return this.resultToOutput(result, response);
    });
  }

  async validateBatch(inputs: string[]): Promise<GuardrailOutput[]> {
    const start = performance.now();
    const moderation = this.options.moderation ?? ((await import("any-llm-ts")).moderation as ModerationFunction);
    const response = await moderation({
      ...(this.options.apiBase === undefined ? {} : { apiBase: this.options.apiBase }),
      ...(this.options.apiKey === undefined ? {} : { apiKey: this.options.apiKey }),
      ...(this.options.clientOptions === undefined ? {} : { clientOptions: this.options.clientOptions }),
      input: inputs,
      model: this.modelId,
      provider: "openai",
    });
    const results = Array.isArray(response?.results) ? (response.results as NormalizedModerationResult[]) : [];
    if (results.length !== inputs.length) throw new TypeError("OpenAI returned an unexpected moderation result count.");
    const latencyMs = performance.now() - start;
    return results.map((result) => {
      const output = this.resultToOutput(result, response);
      output.usage = { latencyMs, modelId: this.modelId };
      return output;
    });
  }

  private resultToOutput(result: NormalizedModerationResult, raw: unknown): GuardrailOutput {
    const scores = Object.entries(result.categoryScores).filter((entry): entry is [string, number] =>
      Number.isFinite(entry[1]),
    );
    const maxScore = scores.length === 0 ? 0 : Math.max(...scores.map(([, score]) => score));
    const categories: CategoryResult[] = scores.map(([name, score]) => ({
      name,
      score,
      triggered: Boolean(result.categories[name]) || score > this.threshold,
    }));
    return guardrailOutput({
      categories,
      raw,
      score: maxScore,
      valid: !result.flagged && maxScore <= this.threshold,
    });
  }
}
