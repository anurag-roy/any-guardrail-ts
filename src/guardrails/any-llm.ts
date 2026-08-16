import { Guardrail } from "../base.js";
import { GuardrailName } from "../names.js";
import { getPrompt, renderPrompt } from "../prompts.js";
import { getGuardrailMetadata } from "../registry.js";
import type { GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

export const DEFAULT_ANY_LLM_MODEL_ID = "openai:gpt-5-nano";

export interface AnyLlmJudgeResult {
  explanation: string;
  risk_score: number;
  valid: boolean;
}

export type CompletionFunction = (parameters: Record<string, any>) => Promise<any>;

export interface AnyLlmGuardrailOptions {
  completion?: CompletionFunction;
  defaultModelId?: string;
}

export interface AnyLlmValidateOptions {
  policy: string;
  completionOptions?: Record<string, unknown>;
  modelId?: string;
  promptVersion?: string;
  systemPrompt?: string;
}

const judgeFormat = {
  jsonSchema: {
    additionalProperties: false,
    properties: {
      explanation: { type: "string" },
      risk_score: { type: "number" },
      valid: { type: "boolean" },
    },
    required: ["valid", "explanation", "risk_score"],
    type: "object",
  },
  name: "guardrail_output",
  parse(value: unknown): AnyLlmJudgeResult {
    if (
      typeof value !== "object" ||
      value === null ||
      !("valid" in value) ||
      !("explanation" in value) ||
      !("risk_score" in value)
    ) {
      throw new TypeError("The judge response does not match the guardrail output schema.");
    }
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.valid !== "boolean" ||
      typeof candidate.explanation !== "string" ||
      typeof candidate.risk_score !== "number" ||
      !Number.isFinite(candidate.risk_score)
    ) {
      throw new TypeError("The judge response does not match the guardrail output schema.");
    }
    return {
      explanation: candidate.explanation,
      risk_score: candidate.risk_score,
      valid: candidate.valid,
    };
  },
  strict: true,
};

const providerResponseFormat = {
  json_schema: {
    name: judgeFormat.name,
    schema: judgeFormat.jsonSchema,
    strict: true,
  },
  type: "json_schema",
};

function responseText(result: any): string {
  const content = result?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export class AnyLlmGuardrail extends Guardrail<string, AnyLlmValidateOptions> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.AnyLlm);
  override readonly modelId: string;
  private readonly completion: CompletionFunction | undefined;

  constructor(options: AnyLlmGuardrailOptions = {}) {
    super();
    this.completion = options.completion;
    this.modelId = options.defaultModelId ?? DEFAULT_ANY_LLM_MODEL_ID;
  }

  override async validate(input: string, options?: AnyLlmValidateOptions): Promise<GuardrailOutput> {
    if (options === undefined || options.policy.trim().length === 0) {
      throw new TypeError("AnyLlmGuardrail.validate() requires a non-empty policy.");
    }
    const modelId = options.modelId ?? this.modelId;
    return this.timed(async () => {
      const completion = this.completion ?? ((await import("any-llm-ts")).completion as CompletionFunction);
      const systemTemplate =
        options.systemPrompt ?? getPrompt(GuardrailName.AnyLlm, options.promptVersion).segments.system;
      if (systemTemplate === undefined) throw new TypeError("The selected any_llm prompt has no system segment.");
      const result = await completion({
        ...options.completionOptions,
        messages: [
          { role: "system", content: renderPrompt(systemTemplate, { policy: options.policy }) },
          { role: "user", content: input },
        ],
        model: modelId,
        responseFormat: providerResponseFormat,
      });
      const content = responseText(result);
      const usage = result?.usage as Record<string, unknown> | undefined;
      let parsed: AnyLlmJudgeResult;
      try {
        parsed = judgeFormat.parse(JSON.parse(content) as unknown);
      } catch {
        return guardrailOutput({
          explanation: content,
          extra: { parseFailure: true },
          raw: result,
          usage: {
            ...(typeof usage?.completionTokens === "number" ? { completionTokens: usage.completionTokens } : {}),
            ...(typeof usage?.promptTokens === "number" ? { promptTokens: usage.promptTokens } : {}),
          },
          valid: false,
        });
      }
      return guardrailOutput({
        explanation: parsed.explanation,
        raw: result,
        score: parsed.risk_score,
        usage: {
          ...(typeof usage?.completionTokens === "number" ? { completionTokens: usage.completionTokens } : {}),
          ...(typeof usage?.promptTokens === "number" ? { promptTokens: usage.promptTokens } : {}),
        },
        valid: parsed.valid,
      });
    }, modelId);
  }
}
