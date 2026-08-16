import { describe, expect, it, vi } from "vitest";
import { OpenAIModeration } from "../src/index.js";

describe("OpenAIModeration", () => {
  it("normalizes category scores and applies a caller threshold", async () => {
    const moderation = vi.fn().mockResolvedValue({
      id: "modr-1",
      model: "omni-moderation-latest",
      results: [
        {
          categories: { hate: false, violence: false },
          categoryScores: { hate: 0.15, violence: 0.03 },
          flagged: false,
        },
      ],
    });
    const result = await new OpenAIModeration({ moderation, threshold: 0.1 }).validate("edgy text");
    expect(result.valid).toBe(false);
    expect(result.score).toBe(0.15);
    expect(result.categories).toEqual([
      { name: "hate", score: 0.15, triggered: true },
      { name: "violence", score: 0.03, triggered: false },
    ]);
  });

  it("validates a true API batch in one request", async () => {
    const moderation = vi.fn().mockResolvedValue({
      results: [
        { categories: { hate: false }, categoryScores: { hate: 0.01 }, flagged: false },
        { categories: { hate: true }, categoryScores: { hate: 0.9 }, flagged: true },
      ],
    });
    const results = await new OpenAIModeration({ moderation }).validateBatch(["safe", "unsafe"]);
    expect(results.map((result) => result.valid)).toEqual([true, false]);
    expect(moderation).toHaveBeenCalledTimes(1);
  });
});
