export type OneEuroFilterOptions = {
    minCutoff?: number;
    beta?: number;
    derivativeCutoff?: number;
};

function smoothingFactor(cutoff: number, deltaSeconds: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / deltaSeconds);
}

export class OneEuroFilter {
    private previousValue: number | null = null;
    private previousDerivative = 0;
    private previousTimestamp: number | null = null;

    private readonly minCutoff: number;
    private readonly beta: number;
    private readonly derivativeCutoff: number;

    constructor(options: OneEuroFilterOptions = {}) {
        this.minCutoff = options.minCutoff ?? 1;
        this.beta = options.beta ?? 0.007;
        this.derivativeCutoff = options.derivativeCutoff ?? 1;
    }

    filter(value: number, timestampMs: number): number {
        if (this.previousValue === null || this.previousTimestamp === null) {
            this.previousValue = value;
            this.previousTimestamp = timestampMs;
            return value;
        }

        const deltaSeconds = Math.max((timestampMs - this.previousTimestamp) / 1000, 0.0001);
        const rawDerivative = (value - this.previousValue) / deltaSeconds;
        const derivativeAlpha = smoothingFactor(this.derivativeCutoff, deltaSeconds);
        const derivative = derivativeAlpha * rawDerivative + (1 - derivativeAlpha) * this.previousDerivative;
        const cutoff = this.minCutoff + this.beta * Math.abs(derivative);
        const alpha = smoothingFactor(cutoff, deltaSeconds);
        const filteredValue = alpha * value + (1 - alpha) * this.previousValue;

        this.previousValue = filteredValue;
        this.previousDerivative = derivative;
        this.previousTimestamp = timestampMs;
        return filteredValue;
    }

    reset(): void {
        this.previousValue = null;
        this.previousDerivative = 0;
        this.previousTimestamp = null;
    }
}

export class OneEuroVector2Filter {
    private readonly x = new OneEuroFilter();
    private readonly y = new OneEuroFilter();

    filter(value: { x: number; y: number }, timestampMs: number): { x: number; y: number } {
        return {
            x: this.x.filter(value.x, timestampMs),
            y: this.y.filter(value.y, timestampMs),
        };
    }

    reset(): void {
        this.x.reset();
        this.y.reset();
    }
}
