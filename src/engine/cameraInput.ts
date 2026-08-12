import type { CameraFrame } from './types';

let latestFrame: CameraFrame | null = null;

export function publishCameraFrame(frame: CameraFrame): void {
    latestFrame = frame;
}

export function getLatestCameraFrame(): CameraFrame | null {
    return latestFrame;
}

export function clearCameraFrame(): void {
    latestFrame = null;
}
