import { Guardrail } from "../base.js";
import { isRecord, stringValue } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

export interface BedrockRuntimeClientLike {
  send(command: unknown): Promise<unknown>;
}

export interface BedrockGuardrailsOptions {
  guardrailIdentifier: string;
  client?: BedrockRuntimeClientLike;
  clientConfig?: Record<string, unknown>;
  guardrailVersion?: string;
  source?: "INPUT" | "OUTPUT";
}

export class BedrockGuardrails extends Guardrail {
  override readonly metadata = getGuardrailMetadata(GuardrailName.BedrockGuardrails);
  override readonly modelId = "bedrock-guardrails";
  private client: BedrockRuntimeClientLike | undefined;
  private readonly source: "INPUT" | "OUTPUT";

  constructor(private readonly options: BedrockGuardrailsOptions) {
    super();
    if (options.guardrailIdentifier.length === 0) throw new TypeError("guardrailIdentifier cannot be empty.");
    this.client = options.client;
    this.source = options.source ?? "INPUT";
  }

  override validate(input: string): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const sdk = await import("@aws-sdk/client-bedrock-runtime");
      this.client ??= new sdk.BedrockRuntimeClient(this.options.clientConfig ?? {});
      const response = await this.client.send(
        new sdk.ApplyGuardrailCommand({
          content: [{ text: { text: input } }],
          guardrailIdentifier: this.options.guardrailIdentifier,
          guardrailVersion: this.options.guardrailVersion ?? "DRAFT",
          source: this.source,
        }),
      );
      if (!isRecord(response)) {
        return guardrailOutput({ extra: { parseFailure: true }, raw: response, valid: false });
      }
      const action = stringValue(response.action) ?? "NONE";
      const valid = action === "NONE";
      return guardrailOutput({
        action,
        extra: {
          assessments: Array.isArray(response.assessments) ? response.assessments : [],
          outputs: Array.isArray(response.outputs) ? response.outputs : [],
        },
        raw: response,
        score: valid ? 0 : 1,
        valid,
      });
    });
  }
}
