import { describe, expect, it, vi } from "vitest";
import { AnyLlmGuardrail, DEFAULT_ANY_LLM_MODEL_ID } from "../src/index.js";

describe("AnyLlmGuardrail", () => {
  it("uses any-llm-ts structured output and normalizes the verdict", async () => {
    const completion = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"valid":true,"explanation":"Safe","risk_score":0.1}',
          },
        },
      ],
      usage: { completionTokens: 8, promptTokens: 20 },
    });
    const result = await new AnyLlmGuardrail({ completion }).validate("What is the weather?", {
      policy: "Do not provide dangerous instructions.",
    });

    expect(result).toMatchObject({
      categories: [],
      explanation: "Safe",
      score: 0.1,
      valid: true,
      usage: { completionTokens: 8, modelId: DEFAULT_ANY_LLM_MODEL_ID, promptTokens: 20 },
    });
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({ role: "system" }),
          { content: "What is the weather?", role: "user" },
        ],
        model: DEFAULT_ANY_LLM_MODEL_ID,
        responseFormat: expect.objectContaining({ type: "json_schema" }),
      }),
    );
  });

  it("fails closed when structured output is absent", async () => {
    const result = await new AnyLlmGuardrail({
      completion: vi.fn().mockResolvedValue({ choices: [{ message: { content: "not json" } }] }),
    }).validate("input", { policy: "policy" });

    expect(result).toMatchObject({
      explanation: "not json",
      extra: { parseFailure: true },
      valid: false,
    });
  });
});
