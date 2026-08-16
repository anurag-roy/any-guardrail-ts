# Porting Mozilla.ai any-guardrail to TypeScript

## What the source project is trying to accomplish

The primary goal of `mozilla-ai/any-guardrail` is to make guardrail selection an infrastructure concern instead of an application-code concern. An application should be able to screen an input, response, or model interaction with different classifiers, judge models, or hosted safety services without adopting each backend's SDK types and verdict semantics.

The source repository achieves that with four layers:

1. `GuardrailOutput` is the shared verdict, evidence, provenance, and escape-hatch contract.
2. `Guardrail` and `ThreeStageGuardrail` give implementations a consistent execution boundary.
3. `AnyGuardrail` provides creation, metadata discovery, filtering, grouping, prompt/content lookup, and generic evaluation dispatch.
4. Per-backend adapters translate native requests and responses into the shared contract.

The static catalog is a major part of the product. It lets tooling answer “what detects prompt injection?”, “which options are secrets?”, or “which policy does this judge use?” without downloading a model or importing a provider SDK.

## What this port preserves

- The same 39 catalog names and source metadata at Python commit `2c22fb43868ae66a7e286b1a4cba6a8f6ad0c5bf`.
- The normalized verdict semantics: `valid === true` means content passed; `score` is higher-is-riskier.
- Categories, spans, actions, explanations, usage, structured extras, and raw backend payloads.
- Import-light metadata, parameter, prompt, policy, rubric, and criteria discovery.
- Fail-closed behavior for malformed guardrail responses where the Python adapter fails closed.
- A three-stage base for adapters that naturally separate preprocessing, inference, and postprocessing.
- An extension registry for downstream guardrails.

## Deliberate TypeScript differences

| Python design | TypeScript port |
| --- | --- |
| Synchronous network and model APIs | Promise-first APIs only |
| Positional arguments plus `**kwargs` | A primary input plus a typed camel-cased options object |
| Pydantic models | Structural interfaces plus small runtime parsers at untrusted boundaries |
| `StrEnum` | Frozen `as const` value objects and union types |
| Environment-variable fallback in constructors | Explicit credentials, so Worker/Deno/Bun callers pass runtime bindings safely |
| `requests` and SDK-specific HTTP wrappers | Web `fetch` for simple hosted APIs |
| Local file-path detection for Azure images | Explicit `validateImage(Blob | ArrayBuffer | Uint8Array)`; no filesystem guessing |
| Eager optional-backend imports | Lazy SDK imports or injected clients |
| Snake-cased result fields | Idiomatic camelCase; a matching JSON Schema is shipped |

`AnyGuardrail.getSupportedGuardrails()` returns adapters that can actually run in this package. `getCatalogGuardrails()` returns all source names. This distinction avoids the misleading behavior where a name appears supported but fails only after an optional import.

## Runtime strategy

The first runtime milestone focuses on hosted adapters because they map cleanly to JavaScript runtimes and production edge/server workloads:

- `any_llm`, `openai_moderation`
- `azure_content_safety`, `azure_prompt_shields`
- `bedrock_guardrails`
- `lakera_guard`, `alinia`, `patronus`
- `watsonx_guardian`

Fetch-based adapters use only `fetch`, `Headers`, `Response`, `Blob`, `btoa`, and `performance`. Requests are issued only from `validate()`. Bedrock uses the portable AWS SDK v3. watsonx accepts a narrow injected client because the Python Guardian helper has no equivalent Web-standard API surface.

## Remaining parity work

The catalog-only guardrails fall into three implementation groups:

1. Encoder classifiers: add a provider boundary supporting Hugging Face Inference, Transformers.js, and caller-supplied/Workers AI classifiers.
2. Decoder safety models: route their source prompts and parsers through `any-llm-ts` or an injected text-generation provider.
3. Python-library wrappers such as FlowJudge and LettuceDetect: implement their judging protocol directly rather than wrapping Python packages.

Each new adapter should preserve the source prompt and output mapping, add mocked request/response tests, add credential-gated integration tests, and move its name from catalog-only to runnable.

## Source tracking

`parity/python-source.json` records the pinned source commit, catalog names, runnable adapter names, and deliberate gaps. Tests assert the source catalog count and registry coverage so metadata drift is visible.
