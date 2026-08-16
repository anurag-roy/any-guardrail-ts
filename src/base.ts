import type { GuardrailMetadata } from "./taxonomy.js";
import type { GuardrailOutput, GuardrailUsage } from "./types.js";

export abstract class Guardrail<TInput = string, TOptions = undefined> {
  abstract readonly metadata: GuardrailMetadata;
  readonly modelId?: string;

  abstract validate(input: TInput, options?: TOptions): Promise<GuardrailOutput>;

  protected async timed(
    operation: () => Promise<GuardrailOutput>,
    modelId: string | undefined = this.modelId,
  ): Promise<GuardrailOutput> {
    const start = performance.now();
    const result = await operation();
    const usage: GuardrailUsage = { ...result.usage };
    usage.latencyMs ??= performance.now() - start;
    if (modelId !== undefined) usage.modelId ??= modelId;
    result.usage = usage;
    return result;
  }
}

export abstract class ThreeStageGuardrail<TInput, TOptions, TPrepared, TInference> extends Guardrail<
  TInput,
  TOptions
> {
  protected abstract preprocess(input: TInput, options?: TOptions): Promise<TPrepared> | TPrepared;
  protected abstract inference(input: TPrepared): Promise<TInference>;
  protected abstract postprocess(output: TInference): Promise<GuardrailOutput> | GuardrailOutput;

  override validate(input: TInput, options?: TOptions): Promise<GuardrailOutput> {
    return this.timed(async () => {
      const prepared = await this.preprocess(input, options);
      const inference = await this.inference(prepared);
      return this.postprocess(inference);
    });
  }
}
