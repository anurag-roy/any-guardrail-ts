import parameterData from "../schemas/guardrail_parameters.json" with { type: "json" };
import type { GuardrailName } from "./names.js";

export type ParameterStage = "create" | "validate";
export type ParameterType = "boolean" | "enum" | "integer" | "json" | "number" | "string";

export interface ParameterSpec {
  choices: readonly unknown[] | null;
  default: unknown;
  description: string;
  effectivelyRequired: boolean;
  envVar: string | null;
  name: string;
  required: boolean;
  secret: boolean;
  stage: ParameterStage;
  type: ParameterType;
}

export interface RequirementGroup {
  description: string;
  parameters: readonly string[];
}

interface RawParameterSpec {
  choices: unknown[] | null;
  default: unknown;
  description: string | null;
  effectively_required: boolean;
  env_var: string | null;
  name: string;
  required: boolean;
  secret: boolean;
  stage: ParameterStage;
  type: ParameterType;
}

interface RawRequirementGroup {
  description: string;
  parameters: string[];
}

interface RawParameterEntry {
  parameters: RawParameterSpec[];
  requirement_groups: RawRequirementGroup[];
}

const registry = parameterData as unknown as Record<GuardrailName, RawParameterEntry>;

export function getParameterSchema(name: GuardrailName): ParameterSpec[] {
  return registry[name].parameters.map((parameter) => ({
    choices: parameter.choices,
    default: parameter.default,
    description: parameter.description ?? "",
    effectivelyRequired: parameter.effectively_required,
    envVar: parameter.env_var,
    name: parameter.name,
    required: parameter.required,
    secret: parameter.secret,
    stage: parameter.stage,
    type: parameter.type,
  }));
}

export function getRequirementGroups(name: GuardrailName): RequirementGroup[] {
  return registry[name].requirement_groups.map((group) => ({
    description: group.description,
    parameters: group.parameters,
  }));
}
