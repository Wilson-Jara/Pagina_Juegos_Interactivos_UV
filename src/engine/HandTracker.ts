import { EventBus } from './events';
import type { CameraFrame } from './types';
import type { HandWorkerMessage, HandWorkerResponse } from './handWorker';

export const DEFAULT_HAND_BUNDLE_URL =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs';
export const DEFAULT_HAND_MODEL_ASSET_PATH =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const DEFAULT_HAND_WASM_ROOT =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

type HandTrackerEvents = {
    ready: undefined;
    frame: CameraFrame;
    error: { error: Error };
};

type VideoFrameSource = HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

const INFERENCE_WIDTH = 320;

export type HandTrackerOptions = {
    bundleUrl?: string;
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
    private frameRequestMode: 'video' | 'animation' | null = null;
    private running = false;
    private processing = false;
    private workerReady = false;

    constructor(options: HandTrackerOptions) {
        this.worker = options.worker ?? new Worker(new URL('./handWorker.ts', import.meta.url), { type: 'module' });
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
        this.worker.postMessage({
            type: 'init',
            bundleUrl: options.bundleUrl ?? DEFAULT_HAND_BUNDLE_URL,
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
        if (this.running) {
            return;
        }

        this.video = video;
        this.running = true;
        this.processing = false;
        this.scheduleFrame();
    }

    stop(): void {
        const video = this.video as VideoFrameSource | null;
        this.running = false;
        this.video = null;

        if (this.frameRequest !== null) {
            if (this.frameRequestMode === 'video' && video?.cancelVideoFrameCallback) {
                video.cancelVideoFrameCallback(this.frameRequest);
            } else {
                cancelAnimationFrame(this.frameRequest);
            }

            this.frameRequest = null;
            this.frameRequestMode = null;
        }

        this.processing = false;
    }

    dispose(): void {
        this.stop();
        this.worker.removeEventListener('message', this.handleMessage);
        this.worker.removeEventListener('error', this.handleError);
        this.worker.terminate();
        this.workerReady = false;
        this.events.clear();
    }

    private scheduleFrame(): void {
        const video = this.video as VideoFrameSource | null;

        if (this.running && video?.requestVideoFrameCallback) {
            this.frameRequestMode = 'video';
            this.frameRequest = video.requestVideoFrameCallback(() => void this.processFrame());
        } else if (this.running) {
            this.frameRequestMode = 'animation';
            this.frameRequest = requestAnimationFrame(() => void this.processFrame());
        }
    }

    private async processFrame(): Promise<void> {
        if (!this.running || !this.video || this.processing || !this.workerReady) {
            this.scheduleFrame();
            return;
        }

        this.processing = true;
        const video = this.video;
        const sourceWidth = video.videoWidth || 640;
        const sourceHeight = video.videoHeight || 480;
        const resizeScale = Math.min(1, INFERENCE_WIDTH / sourceWidth);
        const frameWidth = Math.max(1, Math.round(sourceWidth * resizeScale));
        const frameHeight = Math.max(1, Math.round(sourceHeight * resizeScale));

        try {
            const bitmap = await createImageBitmap(video, {
                resizeWidth: frameWidth,
                resizeHeight: frameHeight,
                resizeQuality: 'medium',
            });

            if (!this.running || this.video !== video) {
                bitmap.close();
                this.processing = false;
                return;
            }

            const message: HandWorkerMessage = {
                type: 'frame',
                timestamp: performance.now(),
                width: sourceWidth,
                height: sourceHeight,
                bitmap,
            };
            this.worker.postMessage(message, [bitmap]);
        } catch (error) {
            this.processing = false;
            this.events.emit('error', { error: error instanceof Error ? error : new Error(String(error)) });
        } finally {
            this.scheduleFrame();
        }
    }

    private readonly handleMessage = (event: MessageEvent<HandWorkerResponse>): void => {
        if (event.data.type === 'ready') {
            this.workerReady = true;
            this.events.emit('ready', undefined);
        } else if (event.data.type === 'frame') {
            this.processing = false;
            this.events.emit('frame', event.data.frame);
        } else {
            this.processing = false;
            this.events.emit('error', { error: new Error(event.data.message) });
        }
    };

    private readonly handleError = (event: ErrorEvent): void => {
        this.workerReady = false;
        this.processing = false;
        this.events.emit('error', { error: new Error(event.message) });
    };
}
