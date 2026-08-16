# Contributing

## Setup

```bash
npm install
npm run check
```

## Adding a guardrail adapter

1. Confirm the source behavior and pin any new source commit in `parity/python-source.json`.
2. Extend `Guardrail` or `ThreeStageGuardrail` and keep provider-specific types at the adapter boundary.
3. Return a normalized higher-is-riskier `GuardrailOutput` and fail closed on malformed safety verdicts.
4. Prefer Web APIs and injected credentials/clients; do not perform network requests during module initialization.
5. Add mocked unit tests for safe, unsafe, malformed, and upstream-error paths.
6. Add the factory to `AnyGuardrail`, move the name from `catalogOnly` to `runtimeAdapters`, and update the README table.

Live integration tests must be credential-gated and must never print secrets or full sensitive prompts.
