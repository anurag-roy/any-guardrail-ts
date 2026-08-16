import parity from "../parity/python-source.json" with { type: "json" };
import schema from "../schemas/guardrail_output.schema.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { AnyGuardrail } from "../src/index.js";

describe("source parity manifest", () => {
  it("keeps catalog and runtime adapter lists explicit", () => {
    expect(AnyGuardrail.getCatalogGuardrails()).toHaveLength(parity.catalogCount);
    expect([...AnyGuardrail.getSupportedGuardrails()].sort()).toEqual([...parity.runtimeAdapters].sort());
    expect(parity.runtimeAdapters.length + parity.catalogOnly.length).toBe(parity.catalogCount);
    expect(new Set([...parity.runtimeAdapters, ...parity.catalogOnly]).size).toBe(parity.catalogCount);
  });

  it("ships a camel-cased result schema matching the public interface", () => {
    expect(schema.required).toEqual(["valid", "categories"]);
    expect(schema.properties).toHaveProperty("modifiedText");
    expect(schema.$defs.usage.properties).toHaveProperty("latencyMs");
  });
});
