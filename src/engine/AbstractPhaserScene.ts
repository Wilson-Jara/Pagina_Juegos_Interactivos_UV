import * as Phaser from 'phaser';

export abstract class AbstractPhaserScene extends Phaser.Scene {
    protected constructor(key: string) {
        super({ key });
    }

    create(): void {
        this.setupScene();
    }

    update(time: number, delta: number): void {
        this.updateScene(time, Math.min(Math.max(delta, 0), 100));
    }

    protected abstract setupScene(): void;

    protected abstract updateScene(time: number, delta: number): void;
}
