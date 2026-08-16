import { describe, expect, it, vi } from "vitest";
import { BedrockGuardrails, WatsonxGuardian } from "../src/index.js";

describe("client-backed guardrails", () => {
  it("maps Bedrock ApplyGuardrail action and assessments", async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        action: "GUARDRAIL_INTERVENED",
        assessments: [{ contentPolicy: {} }],
        outputs: [{ text: "blocked" }],
      }),
    };
    const result = await new BedrockGuardrails({ guardrailIdentifier: "gr-1", client }).validate("unsafe");
    expect(result).toMatchObject({ action: "GUARDRAIL_INTERVENED", score: 1, valid: false });
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it("normalizes watsonx detections and character spans", async () => {
    const client = {
      detect: vi.fn().mockResolvedValue({
        detections: [
          { detection: "pii", detection_type: "EmailAddress", end: 16, score: 0.91, start: 3 },
        ],
      }),
    };
    const result = await new WatsonxGuardian({ client }).validate("my a@example.com");
    expect(result).toMatchObject({ score: 0.91, valid: false });
    expect(result.categories[0]).toEqual({
      description: "EmailAddress",
      name: "pii",
      score: 0.91,
      triggered: true,
    });
    expect(result.spans).toEqual([{ end: 16, label: "pii", score: 0.91, start: 3 }]);
  });

  it("fails watsonx closed when detections cannot be parsed", async () => {
    const result = await new WatsonxGuardian({
      client: { detect: vi.fn().mockResolvedValue({ nope: [] }) },
    }).validate("text");
    expect(result).toMatchObject({ extra: { parseFailure: true }, valid: false });
  });
});
