import { describe, expect, it } from "vitest";
import {
  AnyGuardrail,
  BackendType,
  GuardrailCategory,
  GuardrailName,
  GUARDRAIL_METADATA,
  UnsupportedGuardrailError,
} from "../src/index.js";

describe("catalog", () => {
  it("tracks every Python guardrail name and its metadata", () => {
    expect(AnyGuardrail.getCatalogGuardrails()).toHaveLength(39);
    expect(Object.keys(GUARDRAIL_METADATA)).toHaveLength(39);
    expect(AnyGuardrail.metadata(GuardrailName.LlamaGuard).vendor).toBe("Meta");
  });

  it("distinguishes runnable TypeScript adapters from catalog-only entries", () => {
    expect(AnyGuardrail.getSupportedGuardrails()).toEqual([
      "alinia",
      "any_llm",
      "azure_content_safety",
      "azure_prompt_shields",
      "bedrock_guardrails",
      "lakera_guard",
      "openai_moderation",
      "patronus",
      "watsonx_guardian",
    ]);
    expect(() => AnyGuardrail.create(GuardrailName.Deepset)).toThrow(UnsupportedGuardrailError);
  });

  it("filters and groups without loading an adapter", () => {
    const injectionApis = AnyGuardrail.listGuardrails({
      backend: BackendType.HostedApi,
      category: GuardrailCategory.PromptInjection,
    });
    expect(injectionApis).toContain(GuardrailName.AzurePromptShields);
    expect(injectionApis).toContain(GuardrailName.LakeraGuard);
    expect(injectionApis).not.toContain(GuardrailName.Deepset);
    expect(AnyGuardrail.groupBy("vendor").OpenAI).toEqual([
      GuardrailName.GptOssSafeguard,
      GuardrailName.OpenAIModeration,
    ]);
  });

  it("exposes prompts, parameters, and authored content", () => {
    expect(AnyGuardrail.getPrompt(GuardrailName.AnyLlm).segments.system).toContain("{policy}");
    expect(AnyGuardrail.listPromptVersions(GuardrailName.AnyLlm)).toEqual(["default"]);
    expect(AnyGuardrail.getParameterSchema(GuardrailName.AnyLlm).map((parameter) => parameter.name)).toContain(
      "policy",
    );
    expect(AnyGuardrail.listPolicies(GuardrailName.ShieldGemma)).toContain("dangerous_content");
    expect(AnyGuardrail.getPolicy(GuardrailName.ShieldGemma, "dangerous_content").length).toBeGreaterThan(10);
  });
});
