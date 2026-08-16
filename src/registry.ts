import metadataData from "../schemas/guardrail_metadata.json" with { type: "json" };
import { GUARDRAIL_NAMES, type GuardrailName } from "./names.js";
import type {
  BackendType,
  GuardrailCategory,
  GuardrailMetadata,
  GuardrailStage,
  OutputShape,
} from "./taxonomy.js";

interface RawMetadata {
  backend: string;
  categories: string[];
  default_license: string;
  description: string;
  display_name: string;
  multilingual: boolean;
  multimodal: boolean;
  optional_validate_kwargs: string[];
  output_shapes: string[];
  primary_category: string;
  required_validate_kwargs: string[];
  requires_api_key: boolean;
  stages: string[];
  supports_batch: boolean;
  variant_licenses: { license: string; model_id: string }[];
  vendor: string;
}

function normalize(raw: RawMetadata): GuardrailMetadata {
  return Object.freeze({
    backend: raw.backend as BackendType,
    categories: Object.freeze(raw.categories as GuardrailCategory[]),
    defaultLicense: raw.default_license,
    description: raw.description,
    displayName: raw.display_name,
    multilingual: raw.multilingual,
    multimodal: raw.multimodal,
    optionalValidateOptions: Object.freeze(raw.optional_validate_kwargs),
    outputShapes: Object.freeze(raw.output_shapes as OutputShape[]),
    primaryCategory: raw.primary_category as GuardrailCategory,
    requiredValidateOptions: Object.freeze(raw.required_validate_kwargs),
    requiresApiKey: raw.requires_api_key,
    stages: Object.freeze(raw.stages as GuardrailStage[]),
    supportsBatch: raw.supports_batch,
    variantLicenses: Object.freeze(
      raw.variant_licenses.map((variant) => Object.freeze({ license: variant.license, modelId: variant.model_id })),
    ),
    vendor: raw.vendor,
  });
}

export const GUARDRAIL_METADATA: Readonly<Record<GuardrailName, GuardrailMetadata>> = Object.freeze(
  Object.fromEntries(
    GUARDRAIL_NAMES.map((name) => {
      const raw = (metadataData as Record<string, RawMetadata>)[name];
      if (raw === undefined) throw new TypeError(`Missing metadata for ${name}.`);
      return [name, normalize(raw)];
    }),
  ) as Record<GuardrailName, GuardrailMetadata>,
);

export function getGuardrailMetadata(name: GuardrailName): GuardrailMetadata {
  return GUARDRAIL_METADATA[name];
}
