import { EventBus } from './events';
import type {
    CameraFrame,
    CameraGame,
    CameraGameContext,
    GameEventMap,
    GameStatus,
    InputSnapshot,
} from './types';

export abstract class AbstractCameraGame implements CameraGame {
    private currentStatus: GameStatus = 'idle';

    protected readonly eventBus = new EventBus<GameEventMap>();

    protected constructor(
        public readonly id: string,
        protected readonly context: CameraGameContext,
    ) {}

    get status(): GameStatus {
        return this.currentStatus;
    }

    on<EventName extends keyof GameEventMap>(
        event: EventName,
        listener: (payload: GameEventMap[EventName]) => void,
    ): () => void {
        return this.eventBus.on(event, listener);
    }

    start(): void {
        if (this.currentStatus === 'running') {
            return;
        }

        this.setup();
        this.currentStatus = 'running';
        this.eventBus.emit('status', { status: this.currentStatus });
    }

    stop(): void {
        if (this.currentStatus !== 'running') {
            return;
        }

        this.teardown();
        this.currentStatus = 'stopped';
        this.eventBus.emit('status', { status: this.currentStatus });
    }

    resize(width: number, height: number): void {
        this.onResize(Math.max(1, width), Math.max(1, height));
    }

    update(deltaMs: number, input: InputSnapshot): void {
        if (this.currentStatus !== 'running') {
            return;
        }

        this.onUpdate(Math.min(Math.max(deltaMs, 0), 100), input);
    }

    handleCameraFrame(frame: CameraFrame): void {
        if (this.currentStatus === 'running') {
            this.onCameraFrame(frame);
        }
    }

    protected abstract setup(): void;

    protected abstract onUpdate(deltaMs: number, input: InputSnapshot): void;

    protected onCameraFrame(_frame: CameraFrame): void {
        // Games can opt into camera frames without being forced to use them.
    }

    protected onResize(_width: number, _height: number): void {
        // Games can react to canvas resizes when their layout needs it.
    }

    protected teardown(): void {
        // Games can release their own resources when stopped.
    }

    protected reportError(error: unknown): void {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        this.eventBus.emit('error', { error: normalizedError });
    }
}
