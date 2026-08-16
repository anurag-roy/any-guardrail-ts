import { Guardrail } from "../base.js";
import { fetchJson, isRecord, jsonRequest, type Fetch } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

const API_VERSION = "2024-09-01";

export interface AzurePromptShieldsOptions {
  apiKey: string;
  endpoint: string;
  fetch?: Fetch;
}

export interface AzurePromptShieldsInput {
  documents?: string[];
  userPrompt?: string;
}

export class AzurePromptShields extends Guardrail<AzurePromptShieldsInput> {
  override readonly metadata = getGuardrailMetadata(GuardrailName.AzurePromptShields);
  override readonly modelId = "azure-prompt-shields";
  private readonly endpoint: string;
  private readonly fetcher: Fetch;

  constructor(private readonly options: AzurePromptShieldsOptions) {
    super();
    if (options.apiKey.length === 0) throw new TypeError("Azure Content Safety apiKey cannot be empty.");
    if (options.endpoint.length === 0) throw new TypeError("Azure Content Safety endpoint cannot be empty.");
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  override validate(input: AzurePromptShieldsInput): Promise<GuardrailOutput> {
    if (input.userPrompt === undefined && input.documents === undefined) {
      throw new TypeError("At least one of userPrompt or documents must be provided.");
    }
    return this.timed(async () => {
      const body = await fetchJson<Record<string, unknown>>(
        this.fetcher,
        "Azure Prompt Shields",
        `${this.endpoint}/contentsafety/text:shieldPrompt?api-version=${API_VERSION}`,
        jsonRequest(input, { "Ocp-Apim-Subscription-Key": this.options.apiKey }),
      );
      let userPromptAttack: boolean | undefined;
      if (input.userPrompt !== undefined) {
        if (!isRecord(body.userPromptAnalysis) || typeof body.userPromptAnalysis.attackDetected !== "boolean") {
          return this.malformed(body);
        }
        userPromptAttack = body.userPromptAnalysis.attackDetected;
      }
      let documentAttacks: boolean[] | undefined;
      if (input.documents !== undefined) {
        if (
          !Array.isArray(body.documentsAnalysis) ||
          body.documentsAnalysis.length !== input.documents.length ||
          !body.documentsAnalysis.every((item) => isRecord(item) && typeof item.attackDetected === "boolean")
        ) {
          return this.malformed(body);
        }
        documentAttacks = body.documentsAnalysis.map((item) => Boolean((item as Record<string, unknown>).attackDetected));
      }
      const categories: CategoryResult[] = [];
      if (userPromptAttack !== undefined) categories.push({ name: "user_prompt", triggered: userPromptAttack });
      for (const [index, attack] of (documentAttacks ?? []).entries()) {
        categories.push({ name: `document_${String(index)}`, triggered: attack });
      }
      const attackDetected = Boolean(userPromptAttack) || Boolean(documentAttacks?.some(Boolean));
      return guardrailOutput({
        categories,
        extra: {
          documentsAttacksDetected: documentAttacks,
          userPromptAttackDetected: userPromptAttack,
        },
        raw: body,
        score: attackDetected ? 1 : 0,
        valid: !attackDetected,
      });
    });
  }

  private malformed(raw: unknown): GuardrailOutput {
    return guardrailOutput({
      extra: {
        documentsAttacksDetected: undefined,
        parseFailure: true,
        userPromptAttackDetected: undefined,
      },
      raw,
      score: 1,
      valid: false,
    });
  }
}
