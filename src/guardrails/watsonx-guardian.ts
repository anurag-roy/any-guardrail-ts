import { Guardrail } from "../base.js";
import { isRecord, numberValue, stringValue } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, GuardrailOutput, SpanResult } from "../types.js";
import { guardrailOutput } from "../types.js";

export interface WatsonxGuardianClient {
  detect(parameters: { detectors?: Record<string, unknown>; text: string }): Promise<unknown>;
}

export interface WatsonxGuardianOptions {
  client: WatsonxGuardianClient;
  detectors?: Record<string, unknown>;
}

export class WatsonxGuardian extends Guardrail {
  override readonly metadata = getGuardrailMetadata(GuardrailName.WatsonxGuardian);
  override readonly modelId = "granite_guardian";

  constructor(private readonly options: WatsonxGuardianOptions) {
    super();
  }

  override validate(input: string): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const response = await this.options.client.detect({
        detectors: this.options.detectors ?? { granite_guardian: {} },
        text: input,
      });
      if (!isRecord(response) || !Array.isArray(response.detections)) {
        return guardrailOutput({ extra: { parseFailure: true }, raw: response, valid: false });
      }
      const detections = response.detections.filter(isRecord);
      const categories: CategoryResult[] = [];
      const spans: SpanResult[] = [];
      const scores: number[] = [];
      for (const detection of detections) {
        const name = stringValue(detection.detection) ?? stringValue(detection.detection_type) ?? "unknown";
        const description = stringValue(detection.detection_type);
        const score = numberValue(detection.score);
        if (score !== undefined) scores.push(score);
        categories.push({
          name,
          ...(description === undefined ? {} : { description }),
          ...(score === undefined ? {} : { score }),
          triggered: true,
        });
        const start = numberValue(detection.start);
        const end = numberValue(detection.end);
        if (start !== undefined && end !== undefined) {
          spans.push({ end, label: name, ...(score === undefined ? {} : { score }), start });
        }
      }
      const score = scores.length > 0 ? Math.max(...scores) : detections.length === 0 ? 0 : undefined;
      return guardrailOutput({
        categories,
        raw: response,
        ...(score === undefined ? {} : { score }),
        ...(spans.length === 0 ? {} : { spans }),
        valid: detections.length === 0,
      });
    });
  }
}
