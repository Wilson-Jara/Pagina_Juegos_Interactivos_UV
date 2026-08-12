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

function drawHandOverlay(canvas: HTMLCanvasElement, frame: CameraFrame): void {
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    const context = canvas.getContext('2d');

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

    for (const [from, to] of HAND_CONNECTIONS) {
        const start = landmarks[from];
        const end = landmarks[to];

        context.beginPath();
        context.moveTo(start.x * bounds.width, start.y * bounds.height);
        context.lineTo(end.x * bounds.width, end.y * bounds.height);
        context.stroke();
    }

    context.fillStyle = '#b8f14b';

    for (const landmark of landmarks) {
        context.beginPath();
        context.arc(landmark.x * bounds.width, landmark.y * bounds.height, 3, 0, Math.PI * 2);
        context.fill();
    }
}

export default function HandCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const [status, setStatus] = useState('Preparando cámara...');
    const [cameraReady, setCameraReady] = useState(false);
    const [trackerReady, setTrackerReady] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        const overlay = overlayRef.current;

        if (!video || !overlay) {
            return;
        }

        let disposed = false;
        let stream: MediaStream | null = null;
        const tracker = new HandTracker({
            modelAssetPath: DEFAULT_HAND_MODEL_ASSET_PATH,
            wasmRoot: DEFAULT_HAND_WASM_ROOT,
            maxHands: 1,
        });

        const unsubscribeReady = tracker.on('ready', () => {
            if (disposed) {
                return;
            }

            setTrackerReady(true);
            setStatus('Mano detectada: abre la mano para volar');
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
                setStatus(`Detector no disponible: ${error.message}`);
            }
        });

        const startCamera = async (): Promise<void> => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setStatus('Cámara no disponible. Usa mouse o teclado.');
                return;
            }

            try {
                setStatus('Solicitando permiso de cámara...');
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 },
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
                setCameraReady(true);
                setStatus('Cargando detección de manos...');
            } catch {
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

    const badge = trackerReady ? 'MEDIAPIPE ACTIVO' : cameraReady ? 'CÁMARA ACTIVA' : 'SIN CÁMARA';

    return (
        <div className="hand-camera" aria-label="Cámara y detector de manos">
            <video ref={videoRef} autoPlay muted playsInline />
            <canvas ref={overlayRef} aria-hidden="true" />
            <span className={`hand-camera__badge ${trackerReady ? 'is-active' : ''}`}>{badge}</span>
            <span className="hand-camera__status">{status}</span>
        </div>
    );
}
