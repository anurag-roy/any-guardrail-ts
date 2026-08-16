export class AnyGuardrailError extends Error {
  override readonly name: string = "AnyGuardrailError";
}

export class UnsupportedGuardrailError extends AnyGuardrailError {
  override readonly name: string = "UnsupportedGuardrailError";

  constructor(readonly guardrail: string) {
    super(`Guardrail ${JSON.stringify(guardrail)} has catalog metadata but no built-in TypeScript adapter.`);
  }
}

export class GuardrailHttpError extends AnyGuardrailError {
  override readonly name: string = "GuardrailHttpError";

  constructor(
    readonly provider: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`${provider} request failed with status ${String(status)}: ${responseBody}`);
  }
}

export class EvaluateArgumentError extends AnyGuardrailError {
  override readonly name: string = "EvaluateArgumentError";
}

export class ParseFailureError extends AnyGuardrailError {
  override readonly name: string = "ParseFailureError";
}
