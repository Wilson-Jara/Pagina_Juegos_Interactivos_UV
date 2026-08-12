import type { CameraFrame, HandLandmark, TrackedHand } from './types';

type InitMessage = {
    type: 'init';
    bundleUrl: string;
    modelAssetPath: string;
    wasmRoot: string;
    maxHands: number;
    delegate: 'GPU' | 'CPU';
};

type FrameMessage = {
    type: 'frame';
    timestamp: number;
    width: number;
    height: number;
    bitmap: ImageBitmap;
};

export type HandWorkerMessage = InitMessage | FrameMessage;

type ReadyResponse = { type: 'ready'; delegate: 'GPU' | 'CPU' };
type FrameResponse = { type: 'frame'; frame: CameraFrame };
type ErrorResponse = { type: 'error'; message: string };
export type HandWorkerResponse = ReadyResponse | FrameResponse | ErrorResponse;

type RawLandmark = { x: number; y: number; z?: number };

type WorkerScope = {
    onmessage: ((event: MessageEvent<HandWorkerMessage>) => void) | null;
    postMessage(message: HandWorkerResponse): void;
};

const scope = globalThis as unknown as WorkerScope;
let landmarker: {
    detectForVideo: (image: ImageBitmap, timestamp: number) => {
        landmarks: Array<RawLandmark[]>;
        handednesses: Array<Array<{ score?: number; categoryName?: string }>>;
    };
} | null = null;

function handProximity(landmarks: readonly RawLandmark[]): number {
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;

    for (const landmark of landmarks) {
        minX = Math.min(minX, landmark.x);
        maxX = Math.max(maxX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxY = Math.max(maxY, landmark.y);
    }

    const projectedArea = (maxX - minX) * (maxY - minY);
    const palmWidth = landmarks.length > 17
        ? Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y)
        : 0;

    return projectedArea + palmWidth * palmWidth * 0.35;
}

scope.onmessage = async (event) => {
    try {
        if (event.data.type === 'init') {
            const { FilesetResolver, HandLandmarker } = await import(/* @vite-ignore */ event.data.bundleUrl);
            const vision = await FilesetResolver.forVisionTasks(event.data.wasmRoot, true);

            const options = {
                baseOptions: { modelAssetPath: event.data.modelAssetPath, delegate: event.data.delegate },
                numHands: event.data.maxHands,
                runningMode: 'VIDEO' as const,
                minHandDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                minHandPresenceConfidence: 0.5,
            };

            let activeDelegate = event.data.delegate;

            try {
                landmarker = await HandLandmarker.createFromOptions(vision, options);
            } catch {
                activeDelegate = event.data.delegate === 'GPU' ? 'CPU' : 'GPU';
                landmarker = await HandLandmarker.createFromOptions(vision, {
                    ...options,
                    baseOptions: {
                        ...options.baseOptions,
                        delegate: event.data.delegate === 'GPU' ? 'CPU' : 'GPU',
                    },
                });
            }

            scope.postMessage({ type: 'ready', delegate: activeDelegate });
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

        hands.sort((first, second) => handProximity(second.landmarks) - handProximity(first.landmarks));

        scope.postMessage({
            type: 'frame',
            frame: { timestamp: event.data.timestamp, width: event.data.width, height: event.data.height, hands },
        });
    } catch (error) {
        scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
};
