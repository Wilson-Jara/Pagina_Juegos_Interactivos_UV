import { EventBus } from './events';
import type { CameraFrame } from './types';
import type { HandWorkerMessage, HandWorkerResponse } from './handWorker';

type HandTrackerEvents = {
    ready: undefined;
    frame: CameraFrame;
    error: { error: Error };
};

export type HandTrackerOptions = {
    modelAssetPath: string;
    wasmRoot: string;
    maxHands?: number;
    worker?: Worker;
};

export class HandTracker {
    private readonly events = new EventBus<HandTrackerEvents>();
    private readonly worker: Worker;
    private video: HTMLVideoElement | null = null;
    private frameRequest: number | null = null;
    private running = false;
    private processing = false;

    constructor(options: HandTrackerOptions) {
        this.worker = options.worker ?? new Worker(new URL('./handWorker.ts', import.meta.url), { type: 'module' });
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
        this.worker.postMessage({
            type: 'init',
            modelAssetPath: options.modelAssetPath,
            wasmRoot: options.wasmRoot,
            maxHands: options.maxHands ?? 2,
        } satisfies HandWorkerMessage);
    }

    on<EventName extends keyof HandTrackerEvents>(
        event: EventName,
        listener: (payload: HandTrackerEvents[EventName]) => void,
    ): () => void {
        return this.events.on(event, listener);
    }

    start(video: HTMLVideoElement): void {
        this.video = video;
        this.running = true;
        this.scheduleFrame();
    }

    stop(): void {
        this.running = false;
        this.video = null;

        if (this.frameRequest !== null) {
            cancelAnimationFrame(this.frameRequest);
            this.frameRequest = null;
        }
    }

    dispose(): void {
        this.stop();
        this.worker.removeEventListener('message', this.handleMessage);
        this.worker.removeEventListener('error', this.handleError);
        this.worker.terminate();
        this.events.clear();
    }

    private scheduleFrame(): void {
        if (this.running) {
            this.frameRequest = requestAnimationFrame(() => void this.processFrame());
        }
    }

    private async processFrame(): Promise<void> {
        if (!this.running || !this.video || this.processing) {
            this.scheduleFrame();
            return;
        }

        this.processing = true;

        try {
            const bitmap = await createImageBitmap(this.video);
            const message: HandWorkerMessage = {
                type: 'frame',
                timestamp: performance.now(),
                width: this.video.videoWidth,
                height: this.video.videoHeight,
                bitmap,
            };
            this.worker.postMessage(message, [bitmap]);
        } catch (error) {
            this.events.emit('error', { error: error instanceof Error ? error : new Error(String(error)) });
        } finally {
            this.processing = false;
            this.scheduleFrame();
        }
    }

    private readonly handleMessage = (event: MessageEvent<HandWorkerResponse>): void => {
        if (event.data.type === 'ready') {
            this.events.emit('ready', undefined);
        } else if (event.data.type === 'frame') {
            this.events.emit('frame', event.data.frame);
        } else {
            this.events.emit('error', { error: new Error(event.data.message) });
        }
    };

    private readonly handleError = (event: ErrorEvent): void => {
        this.events.emit('error', { error: new Error(event.message) });
    };
}
