import type { CameraGame, InputSnapshot } from './types';

const emptyInput: InputSnapshot = {
    hands: [],
    keys: new Set<string>(),
    pointer: { x: 0.5, y: 0.5, pressed: false },
};

/**
 * Adapter for engine input. Phaser owns the actual render/update loop.
 */
export class GameRuntime {
    private input: InputSnapshot = emptyInput;

    constructor(private readonly game: CameraGame) {}

    start(): void {
        this.game.start();
    }

    stop(): void {
        this.game.stop();
    }

    setInput(input: InputSnapshot): void {
        this.input = input;
    }

    getInput(): InputSnapshot {
        return this.input;
    }

    step(deltaMs: number): void {
        this.game.update(Math.min(Math.max(deltaMs, 0), 100), this.input);
    }
}
