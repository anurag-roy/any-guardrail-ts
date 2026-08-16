export const GuardrailCategory = {
  PromptInjection: "prompt_injection",
  ContentSafety: "content_safety",
  Toxicity: "toxicity",
  Pii: "pii",
  Hallucination: "hallucination",
  OffTopic: "off_topic",
  Bias: "bias",
  ToolUse: "tool_use",
  GeneralJudge: "general_judge",
} as const;
export type GuardrailCategory = (typeof GuardrailCategory)[keyof typeof GuardrailCategory];

export const GuardrailStage = {
  Input: "input",
  Output: "output",
  RagContext: "rag_context",
} as const;
export type GuardrailStage = (typeof GuardrailStage)[keyof typeof GuardrailStage];

export const OutputShape = {
  Binary: "binary",
  MultiLabel: "multi_label",
  Categorical: "categorical",
  Score: "score",
  Rubric: "rubric",
  Span: "span",
} as const;
export type OutputShape = (typeof OutputShape)[keyof typeof OutputShape];

export const BackendType = {
  LocalEncoder: "local_encoder",
  LocalDecoder: "local_decoder",
  HostedApi: "hosted_api",
  LibraryWrapped: "library_wrapped",
} as const;
export type BackendType = (typeof BackendType)[keyof typeof BackendType];

export interface VariantLicense {
  license: string;
  modelId: string;
}

export interface GuardrailMetadata {
  backend: BackendType;
  categories: readonly GuardrailCategory[];
  defaultLicense: string;
  description: string;
  displayName: string;
  multilingual: boolean;
  multimodal: boolean;
  optionalValidateOptions: readonly string[];
  outputShapes: readonly OutputShape[];
  primaryCategory: GuardrailCategory;
  requiredValidateOptions: readonly string[];
  requiresApiKey: boolean;
  stages: readonly GuardrailStage[];
  supportsBatch: boolean;
  variantLicenses: readonly VariantLicense[];
  vendor: string;
}
