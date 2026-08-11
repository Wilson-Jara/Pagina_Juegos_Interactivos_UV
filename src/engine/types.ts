export type GameStatus = 'idle' | 'running' | 'stopped';

export type HandLandmark = {
    x: number;
    y: number;
    z?: number;
};

export type TrackedHand = {
    landmarks: readonly HandLandmark[];
    confidence: number;
    handedness?: string;
};

export type CameraFrame = {
    timestamp: number;
    width: number;
    height: number;
    hands: readonly TrackedHand[];
};

export type PointerInput = {
    x: number;
    y: number;
    pressed: boolean;
};

export type InputSnapshot = {
    hands: readonly TrackedHand[];
    keys: ReadonlySet<string>;
    pointer: PointerInput;
};

export type CameraGameContext = {
    canvas: HTMLCanvasElement;
};

export type GameEventMap = {
    status: { status: GameStatus };
    score: { value: number };
    error: { error: Error };
};

export interface CameraGame {
    readonly id: string;
    readonly status: GameStatus;
    start(): void;
    stop(): void;
    resize(width: number, height: number): void;
    update(deltaMs: number, input: InputSnapshot): void;
    handleCameraFrame(frame: CameraFrame): void;
    on<EventName extends keyof GameEventMap>(
        event: EventName,
        listener: (payload: GameEventMap[EventName]) => void,
    ): () => void;
}
