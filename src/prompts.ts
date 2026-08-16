import promptData from "../schemas/guardrail_prompts.json" with { type: "json" };
import type { GuardrailName } from "./names.js";

export type PromptAssembly = "assembled" | "chat" | "raw";
export type PromptProvenance = "adapted" | "author";

export interface PromptTemplate {
  assembly: PromptAssembly;
  description: string;
  overridable: boolean;
  provenance: PromptProvenance;
  segments: Readonly<Record<string, string>>;
  variables: readonly string[];
  source?: string;
}

export interface PromptSpec {
  defaultVersion: string;
  versions: Readonly<Record<string, PromptTemplate>>;
}

interface RawPromptTemplate {
  assembly: PromptAssembly;
  description: string;
  overridable: boolean;
  provenance: PromptProvenance;
  segments: Record<string, string>;
  source: string | null;
  variables: string[];
}

interface RawPromptSpec {
  default_version: string;
  versions: Record<string, RawPromptTemplate>;
}

const registry = Object.freeze(
  Object.fromEntries(
    Object.entries(promptData as Record<string, RawPromptSpec>).map(([name, spec]) => [
      name,
      Object.freeze({
        defaultVersion: spec.default_version,
        versions: Object.freeze(
          Object.fromEntries(
            Object.entries(spec.versions).map(([version, template]) => [
              version,
              Object.freeze({
                assembly: template.assembly,
                description: template.description,
                overridable: template.overridable,
                provenance: template.provenance,
                segments: Object.freeze({ ...template.segments }),
                variables: Object.freeze([...template.variables]),
                ...(template.source === null ? {} : { source: template.source }),
              }),
            ]),
          ),
        ),
      }),
    ]),
  ) as Partial<Record<GuardrailName, PromptSpec>>,
);

export function listPromptVersions(name: GuardrailName): string[] {
  return Object.keys(registry[name]?.versions ?? {}).sort();
}

export function getPrompt(name: GuardrailName, version?: string): PromptTemplate {
  const spec = registry[name];
  if (spec === undefined) throw new RangeError(`Guardrail ${JSON.stringify(name)} has no registered prompt.`);
  const resolvedVersion = version ?? spec.defaultVersion;
  const prompt = spec.versions[resolvedVersion];
  if (prompt === undefined) {
    throw new RangeError(
      `Unknown prompt version ${JSON.stringify(resolvedVersion)} for ${name}; expected one of ${listPromptVersions(name).join(", ")}.`,
    );
  }
  return prompt;
}

export function renderPrompt(template: string, variables: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    if (!(name in variables)) throw new TypeError(`Missing prompt variable ${JSON.stringify(name)}.`);
    return String(variables[name]);
  });
}
