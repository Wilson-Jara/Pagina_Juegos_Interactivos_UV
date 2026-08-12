import type { CameraFrame, HandLandmark, TrackedHand } from './types';

type InitMessage = {
    type: 'init';
    bundleUrl: string;
    modelAssetPath: string;
    wasmRoot: string;
    maxHands: number;
};

type FrameMessage = {
    type: 'frame';
    timestamp: number;
    width: number;
    height: number;
    bitmap: ImageBitmap;
};

export type HandWorkerMessage = InitMessage | FrameMessage;

type ReadyResponse = { type: 'ready' };
type FrameResponse = { type: 'frame'; frame: CameraFrame };
type ErrorResponse = { type: 'error'; message: string };
export type HandWorkerResponse = ReadyResponse | FrameResponse | ErrorResponse;

type WorkerScope = {
    onmessage: ((event: MessageEvent<HandWorkerMessage>) => void) | null;
    postMessage(message: HandWorkerResponse): void;
};

const scope = globalThis as unknown as WorkerScope;
let landmarker: {
    detectForVideo: (image: ImageBitmap, timestamp: number) => {
        landmarks: Array<Array<{ x: number; y: number; z: number }>>;
        handednesses: Array<Array<{ score?: number; categoryName?: string }>>;
    };
} | null = null;

scope.onmessage = async (event) => {
    try {
        if (event.data.type === 'init') {
            const { FilesetResolver, HandLandmarker } = await import(/* @vite-ignore */ event.data.bundleUrl);
            const vision = await FilesetResolver.forVisionTasks(event.data.wasmRoot, true);

            const options = {
                baseOptions: { modelAssetPath: event.data.modelAssetPath, delegate: 'GPU' as const },
                numHands: event.data.maxHands,
                runningMode: 'VIDEO' as const,
                minHandDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
            };

            try {
                landmarker = await HandLandmarker.createFromOptions(vision, options);
            } catch {
                landmarker = await HandLandmarker.createFromOptions(vision, {
                    ...options,
                    baseOptions: { ...options.baseOptions, delegate: 'CPU' },
                });
            }

            scope.postMessage({ type: 'ready' });
            return;
        }

        if (!landmarker) {
            event.data.bitmap.close();
            return;
        }

        const result = landmarker.detectForVideo(event.data.bitmap, event.data.timestamp);
        event.data.bitmap.close();

        const hands: TrackedHand[] = result.landmarks.map((landmarks, index) => {
            const normalizedLandmarks: HandLandmark[] = landmarks.map((landmark) => ({
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
            }));
            const category = result.handednesses[index]?.[0];

            return {
                landmarks: normalizedLandmarks,
                confidence: category?.score ?? 0,
                handedness: category?.categoryName,
            };
        });

        scope.postMessage({
            type: 'frame',
            frame: { timestamp: event.data.timestamp, width: event.data.width, height: event.data.height, hands },
        });
    } catch (error) {
        scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
