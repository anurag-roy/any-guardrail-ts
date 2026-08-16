import { Guardrail } from "../base.js";
import { fetchJson, isRecord, jsonRequest, numberValue, stringValue, type Fetch } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

export interface PatronusEvaluator {
  evaluator: string;
  criteria?: string;
  explain_strategy?: string;
  [key: string]: unknown;
}

export interface PatronusOptions {
  apiKey: string;
  evaluators: PatronusEvaluator[];
  endpoint?: string;
  fetch?: Fetch;
  successStrategy?: "all_pass" | "any_pass";
  tags?: Record<string, string>;
}

export interface PatronusValidateOptions {
  outputText?: string;
  retrievedContext?: string | string[];
}

export class Patronus extends Guardrail<string, PatronusValidateOptions> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.Patronus);
  override readonly modelId = "patronus-evaluate";
  private readonly endpoint: string;
  private readonly fetcher: Fetch;
  private readonly successStrategy: "all_pass" | "any_pass";

  constructor(private readonly options: PatronusOptions) {
    super();
    if (options.apiKey.length === 0) throw new TypeError("Patronus apiKey cannot be empty.");
    if (options.evaluators.length === 0) throw new TypeError("evaluators must not be empty.");
    this.endpoint = options.endpoint ?? "https://api.patronus.ai/v1/evaluate";
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.successStrategy = options.successStrategy ?? "all_pass";
  }

  override validate(input: string, validateOptions: PatronusValidateOptions = {}): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const payload: Record<string, unknown> = {
        evaluated_model_input: input,
        evaluators: this.options.evaluators,
      };
      if (validateOptions.outputText !== undefined) payload.evaluated_model_output = validateOptions.outputText;
      if (validateOptions.retrievedContext !== undefined) {
        payload.evaluated_model_retrieved_context = validateOptions.retrievedContext;
      }
      if (this.options.tags !== undefined) payload.tags = this.options.tags;
      const body = await fetchJson<Record<string, unknown>>(
        this.fetcher,
        "Patronus",
        this.endpoint,
        jsonRequest(payload, { "X-API-KEY": this.options.apiKey, accept: "application/json" }),
      );
      if (!Array.isArray(body.results) || body.results.length === 0) {
        return guardrailOutput({ extra: { parseFailure: true }, raw: body, valid: false });
      }

      const categories: CategoryResult[] = [];
      const explanations: string[] = [];
      const riskScores: number[] = [];
      const passes: boolean[] = [];
      const breakdown: Record<string, unknown>[] = [];
      for (const item of body.results) {
        if (!isRecord(item)) {
          passes.push(false);
          categories.push({ name: "evaluator", triggered: true });
          breakdown.push({ explanation: null, malformed: true, name: "evaluator", pass: false, scoreRaw: null });
          continue;
        }
        const name =
          stringValue(item.criteria) ?? stringValue(item.evaluator_id) ?? stringValue(item.evaluator) ?? "evaluator";
        if (!isRecord(item.evaluation_result)) {
          passes.push(false);
          categories.push({ name, triggered: true });
          breakdown.push({ explanation: null, malformed: true, name, pass: false, scoreRaw: null });
          continue;
        }
        const evaluation = item.evaluation_result;
        const passed = Boolean(evaluation.pass);
        const scoreRaw = numberValue(evaluation.score_raw);
        const risk = scoreRaw === undefined ? undefined : 1 - scoreRaw;
        const explanation = stringValue(evaluation.explanation);
        passes.push(passed);
        if (risk !== undefined) riskScores.push(risk);
        if (explanation !== undefined && explanation.length > 0) explanations.push(explanation);
        categories.push({ name, ...(risk === undefined ? {} : { score: risk }), triggered: !passed });
        breakdown.push({ explanation, name, pass: passed, scoreRaw });
      }
      const valid = this.successStrategy === "all_pass" ? passes.every(Boolean) : passes.some(Boolean);
      return guardrailOutput({
        categories,
        ...(explanations.length === 0 ? {} : { explanation: explanations.join("\n\n") }),
        extra: { breakdown, successStrategy: this.successStrategy },
        raw: body,
        ...(riskScores.length === 0 ? {} : { score: Math.max(...riskScores) }),
        valid,
      });
    });
  }
}
