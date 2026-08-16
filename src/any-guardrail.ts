import { Guardrail } from "./base.js";
import { ContentKind, getContent, listContent } from "./content.js";
import { EvaluateArgumentError, UnsupportedGuardrailError } from "./errors.js";
import { Alinia, type AliniaOptions } from "./guardrails/alinia.js";
import { AnyLlmGuardrail, type AnyLlmGuardrailOptions } from "./guardrails/any-llm.js";
import { AzureContentSafety, type AzureContentSafetyOptions } from "./guardrails/azure-content-safety.js";
import { AzurePromptShields, type AzurePromptShieldsOptions } from "./guardrails/azure-prompt-shields.js";
import { BedrockGuardrails, type BedrockGuardrailsOptions } from "./guardrails/bedrock-guardrails.js";
import { LakeraGuard, type LakeraGuardOptions } from "./guardrails/lakera-guard.js";
import { OpenAIModeration, type OpenAIModerationOptions } from "./guardrails/openai-moderation.js";
import { Patronus, type PatronusOptions } from "./guardrails/patronus.js";
import { WatsonxGuardian, type WatsonxGuardianOptions } from "./guardrails/watsonx-guardian.js";
import { GUARDRAIL_NAMES, GuardrailName, type GuardrailName as GuardrailNameType } from "./names.js";
import { getParameterSchema, getRequirementGroups } from "./parameters.js";
import { getPrompt, listPromptVersions } from "./prompts.js";
import { GUARDRAIL_METADATA } from "./registry.js";
import type {
  BackendType,
  GuardrailCategory,
  GuardrailMetadata,
  GuardrailStage,
  OutputShape,
} from "./taxonomy.js";
import type { GuardrailOutput } from "./types.js";

export interface BuiltInOptionsMap {
  [GuardrailName.Alinia]: AliniaOptions;
  [GuardrailName.AnyLlm]: AnyLlmGuardrailOptions | undefined;
  [GuardrailName.AzureContentSafety]: AzureContentSafetyOptions;
  [GuardrailName.AzurePromptShields]: AzurePromptShieldsOptions;
  [GuardrailName.BedrockGuardrails]: BedrockGuardrailsOptions;
  [GuardrailName.LakeraGuard]: LakeraGuardOptions;
  [GuardrailName.OpenAIModeration]: OpenAIModerationOptions | undefined;
  [GuardrailName.Patronus]: PatronusOptions;
  [GuardrailName.WatsonxGuardian]: WatsonxGuardianOptions;
}

export type BuiltInGuardrailName = keyof BuiltInOptionsMap;
export type GuardrailFactory = (options: any) => Guardrail<any, any>;

export interface GuardrailFilters {
  backend?: BackendType;
  category?: GuardrailCategory | readonly GuardrailCategory[];
  multilingual?: boolean;
  multimodal?: boolean;
  outputShape?: OutputShape | readonly OutputShape[];
  requiresApiKey?: boolean;
  stage?: GuardrailStage | readonly GuardrailStage[];
  vendor?: string;
}

const factories = new Map<string, GuardrailFactory>([
  [GuardrailName.Alinia, (options: AliniaOptions) => new Alinia(options)],
  [GuardrailName.AnyLlm, (options: AnyLlmGuardrailOptions | undefined) => new AnyLlmGuardrail(options)],
  [GuardrailName.AzureContentSafety, (options: AzureContentSafetyOptions) => new AzureContentSafety(options)],
  [GuardrailName.AzurePromptShields, (options: AzurePromptShieldsOptions) => new AzurePromptShields(options)],
  [GuardrailName.BedrockGuardrails, (options: BedrockGuardrailsOptions) => new BedrockGuardrails(options)],
  [GuardrailName.LakeraGuard, (options: LakeraGuardOptions) => new LakeraGuard(options)],
  [GuardrailName.OpenAIModeration, (options: OpenAIModerationOptions | undefined) => new OpenAIModeration(options)],
  [GuardrailName.Patronus, (options: PatronusOptions) => new Patronus(options)],
  [GuardrailName.WatsonxGuardian, (options: WatsonxGuardianOptions) => new WatsonxGuardian(options)],
]);

const customMetadata = new Map<string, GuardrailMetadata>();

export class AnyGuardrail {
  static getSupportedGuardrails(): string[] {
    return [...factories.keys()];
  }

  static getCatalogGuardrails(): GuardrailNameType[] {
    return [...GUARDRAIL_NAMES];
  }

  static metadata(name: string): GuardrailMetadata {
    const builtInMetadata = (GUARDRAIL_METADATA as Partial<Record<string, GuardrailMetadata>>)[name];
    const metadata = customMetadata.get(name) ?? builtInMetadata;
    if (metadata === undefined) throw new RangeError(`Unknown guardrail ${JSON.stringify(name)}.`);
    return metadata;
  }

  static listGuardrails(filters: GuardrailFilters = {}): GuardrailNameType[] {
    const requestedCategories = array(filters.category);
    const requestedStages = array(filters.stage);
    const requestedShapes = array(filters.outputShape);
    return GUARDRAIL_NAMES.filter((name) => {
      const metadata = GUARDRAIL_METADATA[name];
      return (
        overlaps(metadata.categories, requestedCategories) &&
        overlaps(metadata.stages, requestedStages) &&
        overlaps(metadata.outputShapes, requestedShapes) &&
        (filters.backend === undefined || metadata.backend === filters.backend) &&
        (filters.requiresApiKey === undefined || metadata.requiresApiKey === filters.requiresApiKey) &&
        (filters.multilingual === undefined || metadata.multilingual === filters.multilingual) &&
        (filters.multimodal === undefined || metadata.multimodal === filters.multimodal) &&
        (filters.vendor === undefined || metadata.vendor === filters.vendor)
      );
    });
  }

  static groupBy(
    dimension: "backend" | "category" | "outputShape" | "stage" | "vendor",
  ): Record<string, GuardrailNameType[]> {
    const groups: Record<string, GuardrailNameType[]> = {};
    for (const name of GUARDRAIL_NAMES) {
      const metadata = GUARDRAIL_METADATA[name];
      const values =
        dimension === "category"
          ? metadata.categories
          : dimension === "stage"
            ? metadata.stages
            : dimension === "outputShape"
              ? metadata.outputShapes
              : [dimension === "backend" ? metadata.backend : metadata.vendor];
      for (const value of values) (groups[value] ??= []).push(name);
    }
    return Object.fromEntries(Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)));
  }

  static getPrompt = getPrompt;
  static listPromptVersions = listPromptVersions;
  static getParameterSchema = getParameterSchema;
  static getRequirementGroups = getRequirementGroups;

  static listPolicies(name: GuardrailNameType): string[] {
    return listContent(name, ContentKind.Policy);
  }

  static getPolicy(name: GuardrailNameType, key: string): string {
    return getContent(name, ContentKind.Policy, key);
  }

  static listRubrics(name: GuardrailNameType): string[] {
    return listContent(name, ContentKind.Rubric);
  }

  static getRubric(name: GuardrailNameType, key: string): string {
    return getContent(name, ContentKind.Rubric, key);
  }

  static listCriteria(name: GuardrailNameType): string[] {
    return listContent(name, ContentKind.Criteria);
  }

  static getCriteria(name: GuardrailNameType, key: string): string {
    return getContent(name, ContentKind.Criteria, key);
  }

  static create<Name extends BuiltInGuardrailName>(
    name: Name,
    ...args: undefined extends BuiltInOptionsMap[Name]
      ? [options?: BuiltInOptionsMap[Name]]
      : [options: BuiltInOptionsMap[Name]]
  ): Guardrail<any, any>;
  static create(name: string, options?: unknown): Guardrail<any, any>;
  static create(name: string, options?: unknown): Guardrail<any, any> {
    const factory = factories.get(name);
    if (factory === undefined) throw new UnsupportedGuardrailError(name);
    return factory(options);
  }

  static register(name: string, factory: GuardrailFactory, metadata?: GuardrailMetadata): void {
    if (name.trim().length === 0) throw new TypeError("The guardrail name cannot be empty.");
    if (factories.has(name)) throw new TypeError(`Guardrail ${JSON.stringify(name)} is already registered.`);
    factories.set(name, factory);
    if (metadata !== undefined) customMetadata.set(name, metadata);
  }

  static async evaluate(
    name: GuardrailNameType,
    guardrail: Guardrail<any, any>,
    prompt: string,
    response?: string,
    options: Record<string, any> = {},
  ): Promise<GuardrailOutput> {
    const required = GUARDRAIL_METADATA[name].requiredValidateOptions;
    if (name === GuardrailName.Alinia) {
      return guardrail.validate(prompt, { ...options, ...(response === undefined ? {} : { output: response }) });
    }
    if (name === GuardrailName.Patronus) {
      return guardrail.validate(prompt, { ...options, ...(response === undefined ? {} : { outputText: response }) });
    }
    if (name === GuardrailName.AzurePromptShields) {
      if (response !== undefined) throw noResponse(name, response);
      return guardrail.validate({ documents: options.documents, userPrompt: prompt });
    }
    if (response !== undefined) throw noResponse(name, response);
    const missing = required.filter((option) => !(option in options));
    if (missing.length > 0) {
      throw new EvaluateArgumentError(
        `${name}.validate() requires ${missing.join(", ")}; pass them in the evaluate options object.`,
      );
    }
    return guardrail.validate(prompt, options);
  }
}

function array<T>(value: T | readonly T[] | undefined): readonly T[] | undefined {
  return value === undefined ? undefined : Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

function overlaps<T>(available: readonly T[], requested: readonly T[] | undefined): boolean {
  return requested === undefined || requested.some((value) => available.includes(value));
}

function noResponse(name: GuardrailNameType, response: string): EvaluateArgumentError {
  return new EvaluateArgumentError(
    `${name}.validate() has no response/second-text argument; got response=${JSON.stringify(response)}.`,
  );
}
