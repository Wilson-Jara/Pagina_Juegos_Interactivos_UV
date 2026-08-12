import { useEffect, useRef, useState } from 'react';
import {
    DEFAULT_HAND_MODEL_ASSET_PATH,
    DEFAULT_HAND_WASM_ROOT,
    HandTracker,
} from '../engine/HandTracker';
import { clearCameraFrame, publishCameraFrame } from '../engine/cameraInput';
import type { CameraFrame } from '../engine/types';

const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
];

const overlayContexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

function drawHandOverlay(canvas: HTMLCanvasElement, frame: CameraFrame): void {
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    let context = overlayContexts.get(canvas);

    if (!context) {
        context = canvas.getContext('2d') ?? undefined;

        if (context) {
            overlayContexts.set(canvas, context);
        }
    }

    if (!context) {
        return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const landmarks = frame.hands[0]?.landmarks;

    if (!landmarks || landmarks.length < 21) {
        return;
    }

    context.strokeStyle = 'rgba(123, 212, 255, 0.9)';
    context.lineWidth = 2;
    context.lineCap = 'round';

    const sourceWidth = Math.max(1, frame.width);
    const sourceHeight = Math.max(1, frame.height);
    const coverScale = Math.max(bounds.width / sourceWidth, bounds.height / sourceHeight);
    const renderedWidth = sourceWidth * coverScale;
    const renderedHeight = sourceHeight * coverScale;
    const cropX = (renderedWidth - bounds.width) / 2;
    const cropY = (renderedHeight - bounds.height) / 2;

    for (const [from, to] of HAND_CONNECTIONS) {
        const start = landmarks[from];
        const end = landmarks[to];
        const startX = start.x * renderedWidth - cropX;
        const startY = start.y * renderedHeight - cropY;
        const endX = end.x * renderedWidth - cropX;
        const endY = end.y * renderedHeight - cropY;

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
    }

    context.fillStyle = '#b8f14b';

    for (const landmark of landmarks) {
        const x = landmark.x * renderedWidth - cropX;
        const y = landmark.y * renderedHeight - cropY;
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
    }
}

export default function HandCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const cameraReadyRef = useRef(false);
    const trackerReadyRef = useRef(false);
    const [status, setStatus] = useState('Preparando cámara...');
    const [cameraReady, setCameraReady] = useState(false);
    const [trackerReady, setTrackerReady] = useState(false);
    const [delegate, setDelegate] = useState<'GPU' | 'CPU' | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        const overlay = overlayRef.current;

        if (!video || !overlay) {
            return;
        }

        let disposed = false;
        let stream: MediaStream | null = null;
        const updateStatus = (message: string): void => {
            if (!cameraReadyRef.current || !trackerReadyRef.current) {
                setStatus(message);
            } else {
                setStatus('');
            }
        };

        const tracker = new HandTracker({
            modelAssetPath: DEFAULT_HAND_MODEL_ASSET_PATH,
            wasmRoot: DEFAULT_HAND_WASM_ROOT,
            maxHands: 2,
            delegate: 'GPU',
        });

        const unsubscribeReady = tracker.on('ready', ({ delegate: activeDelegate }) => {
            if (disposed) {
                return;
            }

            trackerReadyRef.current = true;
            setTrackerReady(true);
            setDelegate(activeDelegate);
            updateStatus('Cargando cámara...');
        });

        const unsubscribeFrame = tracker.on('frame', (frame) => {
            if (disposed) {
                return;
            }

            publishCameraFrame(frame);
            drawHandOverlay(overlay, frame);
        });

        const unsubscribeError = tracker.on('error', ({ error }) => {
            if (!disposed) {
                trackerReadyRef.current = false;
                setTrackerReady(false);
                setStatus(`Detector no disponible: ${error.message}`);
            }
        });

        const startCamera = async (): Promise<void> => {
            if (!navigator.mediaDevices?.getUserMedia) {
                updateStatus('Cámara no disponible. Usa mouse o teclado.');
                return;
            }

            try {
                updateStatus('Solicitando permiso de cámara...');
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: 'user',
                        width: { ideal: 480 },
                        height: { ideal: 360 },
                        frameRate: { ideal: 30, max: 30 },
                    },
                });

                if (disposed) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                video.srcObject = stream;
                await video.play();
                tracker.start(video);
                cameraReadyRef.current = true;
                setCameraReady(true);
                updateStatus('Cargando detección de manos...');
            } catch {
                cameraReadyRef.current = false;
                setCameraReady(false);
                setStatus('Sin cámara. Usa mouse o teclado.');
            }
        };

        void startCamera();

        return () => {
            disposed = true;
            unsubscribeReady();
            unsubscribeFrame();
            unsubscribeError();
            tracker.dispose();
            stream?.getTracks().forEach((track) => track.stop());
            video.pause();
            video.srcObject = null;
            clearCameraFrame();
        };
    }, []);

    const badge = trackerReady ? `MEDIAPIPE ${delegate ?? 'ACTIVO'}` : cameraReady ? 'CÁMARA ACTIVA' : 'SIN CÁMARA';
    const showStatus = status.length > 0 && !(cameraReady && trackerReady);

    return (
        <div className="hand-camera" aria-label="Cámara y detector de manos">
            <video ref={videoRef} autoPlay muted playsInline />
            <canvas ref={overlayRef} aria-hidden="true" />
            <span className={`hand-camera__badge ${trackerReady ? 'is-active' : ''}`}>{badge}</span>
            <span className="hand-camera__privacy" aria-label="La cámara no se está grabando">NO SE ESTÁ GRABANDO</span>
            {showStatus && <span className="hand-camera__status">{status}</span>}
        </div>
    );
}
