# any-guardrail-ts

A unified, Promise-first TypeScript interface for AI safety guardrails.

`any-guardrail-ts` lets an application screen LLM inputs and outputs for prompt injection, harmful content, PII, hallucination, and policy violations while consuming one stable `GuardrailOutput` shape. It is an independent, idiomatic TypeScript port inspired by Mozilla.ai's [`any-guardrail`](https://github.com/mozilla-ai/any-guardrail).

## Why this port exists

The Python project’s central value is not any single model. It is the boundary between application code and a changing guardrail ecosystem:

- one normalized verdict and evidence shape;
- cheap metadata discovery before loading a backend;
- adapters that keep provider-specific request and response formats out of application code;
- swappable guardrails without rewriting enforcement logic.

This port preserves that boundary and adapts it to TypeScript with async APIs, object options, structural types, Web `fetch`, and injectable clients.

## Install

```bash
npm install any-guardrail-ts
```

Node.js 20 or newer is supported. The Web-platform core and fetch-based adapters also work in runtimes such as Bun, Deno, browsers, and Cloudflare Workers, subject to the selected provider SDK's own runtime support.

## Quick start

Use `any-llm-ts` as a policy judge across any structured-output-capable LLM provider:

```ts
import { AnyLlmGuardrail } from "any-guardrail-ts";

const guardrail = new AnyLlmGuardrail();

const result = await guardrail.validate("How do I hack into a system?", {
  policy: "Reject requests for unauthorized access or cyber abuse.",
  modelId: "openai:gpt-5-nano",
  completionOptions: { apiKey: process.env.OPENAI_API_KEY },
});

if (!result.valid) {
  console.log(result.explanation, result.score);
}
```

Every adapter returns the same shape:

```ts
interface GuardrailOutput {
  valid: boolean;
  score?: number;                 // higher means riskier
  categories: CategoryResult[];
  explanation?: string;
  spans?: SpanResult[];
  modifiedText?: string;
  action?: string;
  usage?: GuardrailUsage;
  extra?: Record<string, unknown>;
  raw?: unknown;
}
```

## Built-in runtime adapters

| Guardrail | Adapter style | Typical use |
| --- | --- | --- |
| `any_llm` | `any-llm-ts` | Natural-language policy judge |
| `openai_moderation` | `any-llm-ts` moderation | Multi-label harm moderation |
| `azure_content_safety` | Web `fetch` | Harm-category severity and blocklists |
| `azure_prompt_shields` | Web `fetch` | Direct and indirect prompt injection |
| `bedrock_guardrails` | AWS SDK v3 | AWS-managed guardrail policies |
| `lakera_guard` | Web `fetch` | Prompt injection, moderation, and PII |
| `alinia` | Web `fetch` | Configurable multilingual safety policies |
| `patronus` | Web `fetch` | Hallucination and evaluator workflows |
| `watsonx_guardian` | Injected client | Granite Guardian detections and spans |

The full metadata, parameter, prompt, policy, rubric, and criteria catalogs for all 39 Python guardrails are included. Python-only local Transformers and library-wrapped backends are catalog-visible but intentionally not reported as runnable TypeScript adapters yet.

```ts
import {
  AnyGuardrail,
  BackendType,
  GuardrailCategory,
  GuardrailName,
} from "any-guardrail-ts";

const promptInjectionApis = AnyGuardrail.listGuardrails({
  backend: BackendType.HostedApi,
  category: GuardrailCategory.PromptInjection,
});

const metadata = AnyGuardrail.metadata(GuardrailName.LakeraGuard);
const parameters = AnyGuardrail.getParameterSchema(GuardrailName.LakeraGuard);
```

## Cloudflare Workers

Credentials are constructor inputs rather than implicit Node environment reads, so Worker secrets can be passed directly from `env`. Network calls happen inside `validate()`, never during module initialization.

```ts
import { LakeraGuard } from "any-guardrail-ts";

interface Env {
  LAKERA_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { text } = await request.json<{ text: string }>();
    const guardrail = new LakeraGuard({ apiKey: env.LAKERA_API_KEY });
    const result = await guardrail.validate(text);
    return Response.json(result);
  },
};
```

`raw` may contain an SDK object and is intended as an escape hatch. Omit it before persisting or serializing results when the selected adapter does not return plain JSON.

## Custom adapters

Extend `Guardrail` for a custom model or platform, then register a factory if you want to create it by name:

```ts
import { AnyGuardrail, Guardrail, guardrailOutput } from "any-guardrail-ts";

class MyGuardrail extends Guardrail<string> {
  readonly metadata = AnyGuardrail.metadata("openai_moderation");

  async validate(input: string) {
    const flagged = input.includes("blocked phrase");
    return guardrailOutput({ score: flagged ? 1 : 0, valid: !flagged });
  }
}

AnyGuardrail.register("my_guardrail", () => new MyGuardrail());
```

## Development

```bash
npm install
npm run check
```

The porting rationale and deliberate differences are documented in [`docs/PORTING.md`](docs/PORTING.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
