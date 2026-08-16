import { Guardrail } from "../base.js";
import { fetchJson, isRecord, jsonRequest, numberValue, stringValue, type Fetch } from "../http.js";
import { GuardrailName } from "../names.js";
import { getGuardrailMetadata } from "../registry.js";
import type { CategoryResult, GuardrailOutput } from "../types.js";
import { guardrailOutput } from "../types.js";

const API_VERSION = "2024-09-01";
const AZURE_MAX_SEVERITY = 7;

export interface AzureContentSafetyOptions {
  apiKey: string;
  endpoint: string;
  blocklistNames?: string[];
  fetch?: Fetch;
  scoreType?: "avg" | "max";
  threshold?: number;
}

export class AzureContentSafety extends Guardrail {
  override readonly metadata = getGuardrailMetadata(GuardrailName.AzureContentSafety);
  override readonly modelId = "azure-content-safety";
  readonly scoreType: "avg" | "max";
  readonly threshold: number;
  private readonly endpoint: string;
  private readonly fetcher: Fetch;

  constructor(private readonly options: AzureContentSafetyOptions) {
    super();
    if (options.apiKey.length === 0) throw new TypeError("Azure Content Safety apiKey cannot be empty.");
    if (options.endpoint.length === 0) throw new TypeError("Azure Content Safety endpoint cannot be empty.");
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.scoreType = options.scoreType ?? "max";
    this.threshold = options.threshold ?? 2;
    if (this.threshold < 0 || this.threshold > AZURE_MAX_SEVERITY) {
      throw new RangeError(`threshold must be between 0 and ${String(AZURE_MAX_SEVERITY)}.`);
    }
  }

  override validate(text: string): Promise<GuardrailOutput> {
    return this.analyze("text", {
      ...(this.options.blocklistNames === undefined ? {} : { blocklistNames: this.options.blocklistNames }),
      haltOnBlocklistHit: false,
      text,
    });
  }

  async validateImage(image: ArrayBuffer | Blob | Uint8Array): Promise<GuardrailOutput> {
    const bytes = image instanceof Blob ? new Uint8Array(await image.arrayBuffer()) : new Uint8Array(image);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return this.analyze("image", { image: { content: btoa(binary) } });
  }

  private analyze(kind: "image" | "text", payload: Record<string, unknown>): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const body = await fetchJson<Record<string, unknown>>(
        this.fetcher,
        "Azure Content Safety",
        `${this.endpoint}/contentsafety/${kind}:analyze?api-version=${API_VERSION}`,
        jsonRequest(payload, { "Ocp-Apim-Subscription-Key": this.options.apiKey }),
      );
      const analyses = body.categoriesAnalysis;
      if (!Array.isArray(analyses)) {
        return guardrailOutput({ extra: { parseFailure: true }, raw: body, valid: false });
      }
      const categories: CategoryResult[] = [];
      const severities: number[] = [];
      for (const analysis of analyses) {
        if (!isRecord(analysis)) continue;
        const severity = numberValue(analysis.severity);
        const name = normalizeCategory(stringValue(analysis.category) ?? "unknown");
        if (severity !== undefined) severities.push(severity);
        categories.push({
          name,
          ...(severity === undefined
            ? {}
            : { score: severity / AZURE_MAX_SEVERITY, severity, triggered: severity >= this.threshold }),
        });
      }
      const aggregate =
        severities.length === 0
          ? 0
          : this.scoreType === "max"
            ? Math.max(...severities)
            : severities.reduce((sum, value) => sum + value, 0) / severities.length;
      const blocklistsMatch = Array.isArray(body.blocklistsMatch) ? body.blocklistsMatch : [];
      return guardrailOutput({
        categories,
        ...(this.options.blocklistNames === undefined ? {} : { extra: { blocklistsMatch } }),
        raw: body,
        score: aggregate / AZURE_MAX_SEVERITY,
        valid: aggregate < this.threshold && blocklistsMatch.length === 0,
      });
    });
  }
}

function normalizeCategory(category: string): string {
  return category.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[ -]/g, "_").toLowerCase();
}
